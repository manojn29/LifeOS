export type AIProviderType = 'gemini' | 'openai' | 'claude' | 'groq' | 'openrouter';

export type AIReasoningMode =
  | 'mode_1_journal_only'
  | 'mode_2_journal_general'
  | 'mode_3_journal_search';

export interface UserSettings {
  user_id: string;
  default_ai_provider: AIProviderType;
  openai_api_key?: string | null;
  gemini_api_key?: string | null;
  claude_api_key?: string | null;
  groq_api_key?: string | null;
  openrouter_api_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  raw_text: string;
  cleaned_text: string;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

export interface JournalEmbedding {
  id: string;
  journal_entry_id: string;
  user_id: string;
  embedding: number[];
  provider: string;
  created_at: string;
}

export interface TaskList {
  id: string;
  user_id: string;
  title: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  list_id: string;
  title: string;
  notes?: string | null;
  is_completed: boolean;
  due_date?: string | null;
  completed_at?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  reasoning_mode?: AIReasoningMode | null;
  retrieved_entry_ids?: string[];
  tool_calls?: any;
  tool_results?: any;
  created_at: string;
}

export interface MatchedJournalEntry {
  id: string;
  raw_text: string;
  cleaned_text: string;
  entry_date: string;
  similarity: number;
}

export interface WeeklyDigest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  title: string;
  summary: string;
  wins: string[];
  themes: string[];
  action_items: string[];
  mood_overview?: string | null;
  created_at: string;
}

export interface PinnedChat {
  id: string;
  user_id: string;
  question: string;
  response: string;
  mode?: AIReasoningMode | null;
  provider?: string | null;
  message_id?: string | null;
  created_at: string;
}
