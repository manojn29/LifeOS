import OpenAI from 'openai';
import { AIProvider, AIReasoningMode, ChatMessage, TaskToolCall, ToolExecutionResult } from '../types';
import { AI_PROMPTS } from '../prompts';
import { MatchedJournalEntry } from '@/types/database';

const OPENROUTER_FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-r1:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
];

export class OpenRouterProvider implements AIProvider {
  readonly providerName = 'openrouter' as const;
  private apiKey: string;
  private client: OpenAI | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    if (this.apiKey) {
      try {
        this.client = new OpenAI({
          apiKey: this.apiKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://lifejournal-os.netlify.app',
            'X-Title': 'LifeOS',
          },
          dangerouslyAllowBrowser: true,
        });
      } catch (err) {
        console.warn('Failed to initialize OpenRouter client:', err);
      }
    }
  }

  private async tryGenerate(messages: any[]): Promise<string> {
    if (!this.client) throw new Error('OpenRouter client not initialized');

    let lastError: any = null;
    for (const model of OPENROUTER_FREE_MODELS) {
      try {
        const res = await this.client.chat.completions.create({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 1024,
        });
        const content = res.choices[0]?.message?.content?.trim();
        if (content) return content;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('All OpenRouter models failed');
  }

  async cleanJournal(rawText: string): Promise<string> {
    if (!this.apiKey || !this.client) {
      return this.mockCleanJournal(rawText);
    }

    try {
      const messages = [
        { role: 'system', content: AI_PROMPTS.CLEAN_JOURNAL },
        { role: 'user', content: `RAW JOURNAL ENTRY:\n"""\n${rawText}\n"""` },
      ];
      const cleaned = await this.tryGenerate(messages);
      return cleaned || rawText;
    } catch (err) {
      console.warn('OpenRouter cleanJournal fallback:', err);
      return this.mockCleanJournal(rawText);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
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

    const toolActions: ToolExecutionResult[] = [];
    const classification = await this.classifyIntent(latestUserMessage);

    if (classification.needsTools && onToolCall) {
      const extractedTool = this.extractTaskActionFromText(latestUserMessage, availableTaskLists);
      if (extractedTool) {
        const result = await onToolCall(extractedTool);
        toolActions.push(result);
      }
    }

    if (!this.apiKey || !this.client) {
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

      const promptPayload = `${contextText}\n\nUSER QUERY: ${latestUserMessage}\n${
        toolActions.length > 0
          ? `\nACTIONS ALREADY EXECUTED: ${JSON.stringify(toolActions)}\nIncorporate confirmation naturally in your answer.`
          : ''
      }`;

      const chatMessages = [
        { role: 'system', content: systemInstruction },
        ...messages.slice(0, -1).map((m) => ({ role: m.role as any, content: m.content })),
        { role: 'user', content: promptPayload },
      ];

      const responseText = await this.tryGenerate(chatMessages);

      return {
        response: responseText || 'I processed your request.',
        modeUsed: mode,
        toolActions: toolActions.length > 0 ? toolActions : undefined,
      };
    } catch (err) {
      console.error('OpenRouter chat error, falling back:', err);
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
      const messages = [
        { role: 'system', content: 'You are an insightful executive assistant that outputs only valid JSON.' },
        { role: 'user', content: promptPayload },
      ];
      const responseText = await this.tryGenerate(messages);
      const parsed = JSON.parse(responseText || '{}');
      return {
        title: parsed.title || `Weekly Review (${startDate} – ${endDate})`,
        summary: parsed.summary || 'A week of continuous progress and reflection.',
        wins: Array.isArray(parsed.wins) ? parsed.wins : [],
        themes: Array.isArray(parsed.themes) ? parsed.themes : [],
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
        mood_overview: parsed.mood_overview || 'Focused & Productive',
      };
    } catch (err) {
      console.warn('OpenRouter weekly digest fallback:', err);
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

  private mockCleanJournal(raw: string): string {
    return raw
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/([.!?])([A-Za-z])/g, '$1 $2')
      .replace(/^(.)/, (c) => c.toUpperCase());
  }

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

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / norm);
  }

  private extractTaskActionFromText(
    text: string,
    availableLists: { id: string; title: string }[]
  ): TaskToolCall | null {
    const lower = text.toLowerCase();
    
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
        ).toLocaleDateString()}:\n\n"${mostRelevant.cleaned_text.slice(0, 300)}..."`,
        modeUsed: mode,
      };
    }

    return {
      response: `I've checked your journal. No specific entries match "${query}" yet.`,
      modeUsed: mode,
    };
  }
}
