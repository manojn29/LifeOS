import { GoogleGenAI } from '@google/genai';
import { AIProvider, AIReasoningMode, ChatMessage, TaskToolCall, ToolExecutionResult } from '../types';
import { AI_PROMPTS } from '../prompts';
import { MatchedJournalEntry } from '@/types/database';

const GEMINI_GENERATION_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
];

const GEMINI_EMBEDDING_MODELS = [
  'gemini-embedding-001',
  'gemini-embedding-2-preview',
];

export class GeminiProvider implements AIProvider {
  readonly providerName = 'gemini' as const;
  private apiKey: string;
  private aiClient: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    if (this.apiKey) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: this.apiKey });
      } catch (err) {
        console.warn('Failed to initialize GoogleGenAI client:', err);
      }
    }
  }

  private async tryGenerate(prompt: string, config?: any): Promise<string> {
    if (!this.aiClient) throw new Error('No AI client initialized');

    let lastError: any = null;
    for (const modelName of GEMINI_GENERATION_MODELS) {
      try {
        const response = await this.aiClient.models.generateContent({
          model: modelName,
          contents: prompt,
          config,
        });
        const text = response.text?.trim();
        if (text) return text;
      } catch (err: any) {
        lastError = err;
        // Continue to next available model in pool
      }
    }
    throw lastError || new Error('All Gemini generation models failed');
  }

  async cleanJournal(rawText: string): Promise<string> {
    if (!this.apiKey || !this.aiClient) {
      return this.mockCleanJournal(rawText);
    }

    try {
      const prompt = `${AI_PROMPTS.CLEAN_JOURNAL}\n\nRAW JOURNAL ENTRY:\n"""\n${rawText}\n"""`;
      const cleaned = await this.tryGenerate(prompt);
      return cleaned || rawText;
    } catch (err) {
      console.warn('Gemini cleaning pool fallback:', err);
      return this.mockCleanJournal(rawText);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey || !this.aiClient) {
      return this.generateDeterministicVector(text, 1536);
    }

    for (const embModel of GEMINI_EMBEDDING_MODELS) {
      try {
        const result = await this.aiClient.models.embedContent({
          model: embModel,
          contents: text,
        });

        const resAny = result as any;
        const values: number[] =
          resAny.embeddings?.[0]?.values ||
          resAny.embedding?.values ||
          [];

        if (values.length > 0) {
          return this.normalizeTo1536(values);
        }
      } catch {
        // Try next embedding model
      }
    }

    return this.generateDeterministicVector(text, 1536);
  }

  async classifyIntent(message: string): Promise<{ mode: AIReasoningMode; needsTools: boolean }> {
    const lower = message.toLowerCase();
    const isTaskQuery =
      lower.startsWith('add ') ||
      lower.startsWith('create ') ||
      lower.startsWith('remind me') ||
      lower.includes('todo') ||
      lower.includes('to-do') ||
      lower.includes('mark ') ||
      lower.includes('complete task');

    if (lower.includes('search') || lower.includes('find job') || lower.includes('latest news') || lower.includes('in london')) {
      return { mode: 'mode_3_journal_search', needsTools: isTaskQuery };
    }
    if (lower.includes('advice') || lower.includes('recommend') || lower.includes('suggest') || lower.includes('fit my experience') || lower.includes('summarize')) {
      return { mode: 'mode_2_journal_general', needsTools: isTaskQuery };
    }
    return { mode: 'mode_1_journal_only', needsTools: isTaskQuery };
  }

  async chatWithContext(params: {
    messages: ChatMessage[];
    journalContext: MatchedJournalEntry[];
    mode: AIReasoningMode;
    availableTaskLists: { id: string; title: string }[];
    onToolCall?: (toolCall: TaskToolCall) => Promise<ToolExecutionResult>;
  }): Promise<{
    response: string;
    modeUsed: AIReasoningMode;
    toolActions?: ToolExecutionResult[];
  }> {
    const { messages, journalContext, mode, availableTaskLists, onToolCall } = params;
    const latestUserMessage = messages[messages.length - 1]?.content || '';

    // Check if task tool execution is needed
    const toolActions: ToolExecutionResult[] = [];
    const classification = await this.classifyIntent(latestUserMessage);

    if (classification.needsTools && onToolCall) {
      const extractedTool = this.extractTaskActionFromText(latestUserMessage, availableTaskLists);
      if (extractedTool) {
        const result = await onToolCall(extractedTool);
        toolActions.push(result);
      }
    }

    if (!this.apiKey || !this.aiClient) {
      return this.mockChatResponse(latestUserMessage, journalContext, mode, toolActions);
    }

    try {
      const systemInstruction = AI_PROMPTS.RAG_CHAT_SYSTEM(mode, availableTaskLists);
      let contextText = '';
      if (journalContext.length > 0) {
        contextText = journalContext
          .map(
            (e, i) =>
              `[Entry #${i + 1} | Date: ${new Date(e.entry_date).toLocaleDateString()} | Match: ${Math.round(
                e.similarity * 100
              )}%]\n${e.cleaned_text}\n`
          )
          .join('\n---\n');
      } else {
        contextText = '(No matching journal entries found for this query.)';
      }

      const promptPayload = `${systemInstruction}\n\n${contextText}\n\nUSER QUERY: ${latestUserMessage}\n${
        toolActions.length > 0
          ? `\nACTIONS ALREADY EXECUTED: ${JSON.stringify(toolActions)}\nIncorporate confirmation naturally in your answer.`
          : ''
      }`;

      const responseText = await this.tryGenerate(promptPayload);

      return {
        response: responseText || 'I processed your request.',
        modeUsed: mode,
        toolActions: toolActions.length > 0 ? toolActions : undefined,
      };
    } catch (err) {
      console.error('Gemini chat error, falling back:', err);
      return this.mockChatResponse(latestUserMessage, journalContext, mode, toolActions);
    }
  }

  async generateWeeklyDigest(params: {
    startDate: string;
    endDate: string;
    journalEntries: { date: string; text: string }[];
    completedTasks: { title: string; listName?: string }[];
  }): Promise<{
    title: string;
    summary: string;
    wins: string[];
    themes: string[];
    action_items: string[];
    mood_overview?: string;
  }> {
    const { startDate, endDate, journalEntries, completedTasks } = params;

    const entriesContext =
      journalEntries.length > 0
        ? journalEntries
            .map((e, i) => `[Entry ${i + 1} (${new Date(e.date).toLocaleDateString()})]:\n${e.text}`)
            .join('\n\n')
        : '(No journal entries written this week.)';

    const tasksContext =
      completedTasks.length > 0
        ? completedTasks.map((t) => `- ${t.title} (${t.listName || 'General'})`).join('\n')
        : '(No tasks completed this week.)';

    const promptPayload = `${AI_PROMPTS.WEEKLY_DIGEST}\n\nTIMEFRAME: ${startDate} to ${endDate}\n\nJOURNAL ENTRIES:\n${entriesContext}\n\nCOMPLETED TASKS:\n${tasksContext}`;

    try {
      const responseText = await this.tryGenerate(promptPayload, {
        responseMimeType: 'application/json',
      });
      const parsed = JSON.parse(responseText || '{}');
      return {
        title: parsed.title || `Weekly Review (${startDate} – ${endDate})`,
        summary: parsed.summary || 'A week of continuous progress and reflection.',
        wins: Array.isArray(parsed.wins) ? parsed.wins : [],
        themes: Array.isArray(parsed.themes) ? parsed.themes : [],
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
        mood_overview: parsed.mood_overview || 'Reflective and Steady',
      };
    } catch (err) {
      console.warn('Gemini weekly digest error, using fallback synthesis:', err);
      return {
        title: `Weekly Review (${startDate} – ${endDate})`,
        summary: `Reflected on ${journalEntries.length} journal entries and accomplished ${completedTasks.length} tasks this week.`,
        wins: completedTasks.map((t) => `Completed: ${t.title}`),
        themes: ['Personal Growth', 'Consistency', 'LifeOS Reflections'],
        action_items: ['Continue daily journaling', 'Review upcoming priorities'],
        mood_overview: 'Calm & Consistent',
      };
    }
  }

  // Fallback text cleaner
  private mockCleanJournal(raw: string): string {
    return raw
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/([.!?])([A-Za-z])/g, '$1 $2')
      .replace(/^(.)/, (c) => c.toUpperCase());
  }

  // Deterministic 1536-dim vector generator for offline/local RAG
  private generateDeterministicVector(text: string, dimensions = 1536): number[] {
    const vector = new Array(dimensions).fill(0);
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);
    if (words.length === 0) return vector;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = (hash << 5) - hash + word.charCodeAt(j);
        hash |= 0;
      }
      const idx = Math.abs(hash) % dimensions;
      vector[idx] += 1;
    }

    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / norm);
  }

  private normalizeTo1536(values: number[]): number[] {
    if (values.length === 1536) return values;
    const res = new Array(1536).fill(0);
    for (let i = 0; i < 1536; i++) {
      res[i] = values[i % values.length] || 0;
    }
    const norm = Math.sqrt(res.reduce((sum, v) => sum + v * v, 0)) || 1;
    return res.map((v) => v / norm);
  }

  private extractTaskActionFromText(
    text: string,
    availableLists: { id: string; title: string }[]
  ): TaskToolCall | null {
    const lower = text.toLowerCase();
    
    // Create task
    if (lower.startsWith('add ') || lower.startsWith('create task') || lower.startsWith('remind me to ')) {
      let taskTitle = text
        .replace(/^(add|create task|remind me to)\s+/i, '')
        .replace(/["']/g, '')
        .trim();

      let targetListName = 'Personal';
      for (const list of availableLists) {
        const regex = new RegExp(`\\s+(in|to|for)\\s+(${list.title})$`, 'i');
        if (regex.test(taskTitle)) {
          targetListName = list.title;
          taskTitle = taskTitle.replace(regex, '').trim();
          break;
        }
      }

      return {
        tool: 'create_task',
        arguments: {
          title: taskTitle,
          listName: targetListName,
          dueDate: lower.includes('tomorrow') ? 'Tomorrow' : lower.includes('tonight') ? 'Tonight' : undefined,
        },
      };
    }

    // Create list
    if (lower.startsWith('create ') && lower.includes('list')) {
      const listName = text.replace(/create\s+(a\s+)?/i, '').replace(/\s+list.*$/i, '').trim();
      if (listName) {
        return {
          tool: 'create_list',
          arguments: { listName },
        };
      }
    }

    return null;
  }

  private mockChatResponse(
    query: string,
    entries: MatchedJournalEntry[],
    mode: AIReasoningMode,
    toolActions: ToolExecutionResult[]
  ) {
    if (toolActions.length > 0) {
      const actionMsg = toolActions.map((a) => a.message).join(' ');
      return {
        response: `Done. ${actionMsg}`,
        modeUsed: mode,
        toolActions,
      };
    }

    if (entries.length > 0) {
      const mostRelevant = entries[0];
      return {
        response: `Based on your journal from ${new Date(
          mostRelevant.entry_date
        ).toLocaleDateString()}:\n\n"${mostRelevant.cleaned_text.slice(0, 300)}..."\n\nYou previously reflected on these themes.`,
        modeUsed: mode,
      };
    }

    return {
      response: `I've checked your journal. No specific entries match "${query}" yet. As you write more entries, I will connect patterns and remind you of your thoughts.`,
      modeUsed: mode,
    };
  }
}
