import { AIProviderType, AIReasoningMode, MatchedJournalEntry } from '@/types/database';

export type { AIProviderType, AIReasoningMode };

export interface JournalContextItem {
  id: string;
  cleanedText: string;
  entryDate: string;
  similarity: number;
}

export interface TaskToolCall {
  tool: 'create_task' | 'complete_task' | 'create_list' | 'list_tasks';
  arguments: Record<string, any>;
}

export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  message: string;
  data?: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface AIProviderConfig {
  apiKey?: string;
  modelName?: string;
}

export interface AIProvider {
  readonly providerName: AIProviderType;

  /**
   * Cleans raw journal text:
   * - Corrects grammar and spelling
   * - Improves readability and clarity
   * - Strictly preserves the author's intent and tone
   * - Never invents facts or hallucinates details
   * - Never removes existing information or context
   */
  cleanJournal(rawText: string): Promise<string>;

  /**
   * Generates a 1536-dimensional normalized vector embedding for RAG similarity search.
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Classifies user intent to automatically choose the reasoning mode:
   * - Mode 1: Journal only (pure memory recall, factual queries about the past)
   * - Mode 2: Journal + General Knowledge (advice, analysis, brainstorming based on journal)
   * - Mode 3: Journal + Internet Search (current events, external references, jobs, facts)
   * Also detects if natural language task actions are requested.
   */
  classifyIntent(message: string): Promise<{
    mode: AIReasoningMode;
    needsTools: boolean;
  }>;

  /**
   * Answers a chat query given RAG journal context, available task lists, and optional tool execution callback.
   */
  chatWithContext(params: {
    messages: ChatMessage[];
    journalContext: MatchedJournalEntry[];
    mode: AIReasoningMode;
    availableTaskLists: { id: string; title: string }[];
    onToolCall?: (toolCall: TaskToolCall) => Promise<ToolExecutionResult>;
  }): Promise<{
    response: string;
    modeUsed: AIReasoningMode;
    toolActions?: ToolExecutionResult[];
  }>;
}
