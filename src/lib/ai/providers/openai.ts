import OpenAI from 'openai';
import { AIProvider, AIReasoningMode, ChatMessage, TaskToolCall, ToolExecutionResult } from '../types';
import { AI_PROMPTS } from '../prompts';
import { MatchedJournalEntry } from '@/types/database';

export class OpenAIProvider implements AIProvider {
  readonly providerName = 'openai' as const;
  private apiKey: string;
  private client: OpenAI | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    if (this.apiKey) {
      try {
        this.client = new OpenAI({ apiKey: this.apiKey });
      } catch (err) {
        console.warn('Failed to initialize OpenAI client:', err);
      }
    }
  }

  async cleanJournal(rawText: string): Promise<string> {
    if (!this.apiKey || !this.client) {
      return rawText.trim();
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: AI_PROMPTS.CLEAN_JOURNAL },
          { role: 'user', content: rawText },
        ],
        temperature: 0.2,
      });

      return response.choices[0]?.message?.content?.trim() || rawText;
    } catch (err) {
      console.error('OpenAI cleanJournal error:', err);
      return rawText;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey || !this.client) {
      return this.generateDeterministicVector(text, 1536);
    }

    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 1536,
      });

      return response.data[0]?.embedding || this.generateDeterministicVector(text, 1536);
    } catch (err) {
      console.warn('OpenAI embedding error, falling back:', err);
      return this.generateDeterministicVector(text, 1536);
    }
  }

  async classifyIntent(message: string): Promise<{ mode: AIReasoningMode; needsTools: boolean }> {
    const lower = message.toLowerCase();
    const isTaskQuery =
      lower.startsWith('add ') ||
      lower.startsWith('create ') ||
      lower.startsWith('remind me') ||
      lower.includes('todo') ||
      lower.includes('mark ');

    if (!this.apiKey || !this.client) {
      if (lower.includes('search') || lower.includes('find job')) {
        return { mode: 'mode_3_journal_search', needsTools: isTaskQuery };
      }
      if (lower.includes('advice') || lower.includes('recommend')) {
        return { mode: 'mode_2_journal_general', needsTools: isTaskQuery };
      }
      return { mode: 'mode_1_journal_only', needsTools: isTaskQuery };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: AI_PROMPTS.CLASSIFY_INTENT },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const json = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        mode: json.mode || 'mode_1_journal_only',
        needsTools: typeof json.needsTools === 'boolean' ? json.needsTools : isTaskQuery,
      };
    } catch {
      return { mode: 'mode_1_journal_only', needsTools: isTaskQuery };
    }
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
      return {
        response: toolActions.length > 0
          ? `Done. ${toolActions.map((a) => a.message).join(' ')}`
          : `[OpenAI Mode] Retrieval found ${journalContext.length} relevant entries for "${latestUserMessage}".`,
        modeUsed: mode,
        toolActions: toolActions.length > 0 ? toolActions : undefined,
      };
    }

    try {
      const systemInstruction = AI_PROMPTS.RAG_CHAT_SYSTEM(mode, availableTaskLists);
      const contextText =
        journalContext.length > 0
          ? journalContext
              .map(
                (e, i) =>
                  `[Entry #${i + 1} | Date: ${new Date(e.entry_date).toLocaleDateString()} | Match: ${Math.round(
                    e.similarity * 100
                  )}%]\n${e.cleaned_text}\n`
              )
              .join('\n---\n')
          : '(No matching journal entries found)';

      const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: `${systemInstruction}\n\n${contextText}` },
        ...messages.slice(0, -1).map((m) => ({
          role: (m.role === 'tool' ? 'system' : m.role) as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        {
          role: 'user',
          content: `${latestUserMessage}${
            toolActions.length > 0 ? `\n\n(Action executed: ${JSON.stringify(toolActions)})` : ''
          }`,
        },
      ];

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: chatMessages,
        temperature: 0.3,
      });

      return {
        response: response.choices[0]?.message?.content || 'I processed your request.',
        modeUsed: mode,
        toolActions: toolActions.length > 0 ? toolActions : undefined,
      };
    } catch (err) {
      console.error('OpenAI chat error:', err);
      return {
        response: 'Unable to connect to OpenAI. Please verify your API key in Settings.',
        modeUsed: mode,
      };
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

    if (!this.client) {
      return {
        title: `Weekly Review (${startDate} – ${endDate})`,
        summary: `Reflected on ${journalEntries.length} journal entries and accomplished ${completedTasks.length} tasks this week.`,
        wins: completedTasks.map((t) => `Completed: ${t.title}`),
        themes: ['Personal Growth', 'Consistency', 'LifeOS Reflections'],
        action_items: ['Continue daily journaling', 'Review upcoming priorities'],
        mood_overview: 'Calm & Consistent',
      };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an insightful assistant that responds only in valid JSON.' },
          { role: 'user', content: promptPayload },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        title: parsed.title || `Weekly Review (${startDate} – ${endDate})`,
        summary: parsed.summary || 'A week of continuous progress and reflection.',
        wins: Array.isArray(parsed.wins) ? parsed.wins : [],
        themes: Array.isArray(parsed.themes) ? parsed.themes : [],
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
        mood_overview: parsed.mood_overview || 'Focused & Productive',
      };
    } catch (err) {
      console.warn('OpenAI weekly digest error:', err);
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
    return null;
  }
}
