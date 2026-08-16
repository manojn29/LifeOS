import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIReasoningMode, ChatMessage, TaskToolCall, ToolExecutionResult } from '../types';
import { AI_PROMPTS } from '../prompts';
import { MatchedJournalEntry } from '@/types/database';

export class ClaudeProvider implements AIProvider {
  readonly providerName = 'claude' as const;
  private apiKey: string;
  private client: Anthropic | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    if (this.apiKey) {
      try {
        this.client = new Anthropic({ apiKey: this.apiKey });
      } catch (err) {
        console.warn('Failed to initialize Anthropic client:', err);
      }
    }
  }

  async cleanJournal(rawText: string): Promise<string> {
    if (!this.apiKey || !this.client) {
      return rawText.trim();
    }

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: AI_PROMPTS.CLEAN_JOURNAL,
        messages: [{ role: 'user', content: rawText }],
      });

      const firstBlock = response.content[0];
      if (firstBlock && firstBlock.type === 'text') {
        return firstBlock.text.trim();
      }
      return rawText;
    } catch (err) {
      console.error('Claude cleanJournal error:', err);
      return rawText;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Anthropic does not provide native embeddings API; we use deterministic normalized vectors or delegate
    return this.generateDeterministicVector(text, 1536);
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
      const response = await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 300,
        system: `${AI_PROMPTS.CLASSIFY_INTENT}\nReturn only the JSON object.`,
        messages: [{ role: 'user', content: message }],
      });

      const block = response.content[0];
      if (block && block.type === 'text') {
        const json = JSON.parse(block.text);
        return {
          mode: json.mode || 'mode_1_journal_only',
          needsTools: typeof json.needsTools === 'boolean' ? json.needsTools : isTaskQuery,
        };
      }
    } catch {
      // fallback
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
      return {
        response: toolActions.length > 0
          ? `Done. ${toolActions.map((a) => a.message).join(' ')}`
          : `[Claude Mode] Retained ${journalContext.length} journal items for context.`,
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
                  `[Entry #${i + 1} | Date: ${new Date(e.entry_date).toLocaleDateString()}]\n${e.cleaned_text}\n`
              )
              .join('\n---\n')
          : '(No matching journal entries found)';

      const anthropicMessages = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      if (anthropicMessages.length === 0 || anthropicMessages[anthropicMessages.length - 1].role !== 'user') {
        anthropicMessages.push({ role: 'user', content: latestUserMessage });
      }

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 3000,
        system: `${systemInstruction}\n\n${contextText}`,
        messages: anthropicMessages,
      });

      const block = response.content[0];
      const text = block && block.type === 'text' ? block.text : 'I processed your request.';

      return {
        response: text,
        modeUsed: mode,
        toolActions: toolActions.length > 0 ? toolActions : undefined,
      };
    } catch (err) {
      console.error('Claude chat error:', err);
      return {
        response: 'Unable to connect to Claude. Please verify your Anthropic API key in Settings.',
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
      const response = await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        system: 'You are an insightful executive assistant. Respond ONLY with valid JSON matching the requested schema.',
        messages: [{ role: 'user', content: promptPayload }],
      });

      const block = response.content[0];
      const text = block && block.type === 'text' ? block.text : '{}';
      const parsed = JSON.parse(text || '{}');

      return {
        title: parsed.title || `Weekly Review (${startDate} – ${endDate})`,
        summary: parsed.summary || 'A week of continuous progress and reflection.',
        wins: Array.isArray(parsed.wins) ? parsed.wins : [],
        themes: Array.isArray(parsed.themes) ? parsed.themes : [],
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
        mood_overview: parsed.mood_overview || 'Focused & Productive',
      };
    } catch (err) {
      console.warn('Claude weekly digest error:', err);
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
