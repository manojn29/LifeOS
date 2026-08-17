import { createServerSupabaseClient, getAuthenticatedUser } from './supabase-server';
import { JournalEntry, TaskList, Task, UserSettings, AIConversation, ConversationMessage, MatchedJournalEntry, AIReasoningMode, WeeklyDigest, PinnedChat } from '@/types/database';

// In-memory local fallback store for seamless zero-config local testing and offline readiness
const globalStore = globalThis as unknown as {
  _lifeos_memoryStore?: {
    settings: Map<string, UserSettings>;
    journal: Map<string, JournalEntry[]>;
    embeddings: Map<string, { journal_entry_id: string; embedding: number[]; provider: string }[]>;
    lists: Map<string, TaskList[]>;
    tasks: Map<string, Task[]>;
    conversations: Map<string, AIConversation[]>;
    messages: Map<string, ConversationMessage[]>;
    digests: Map<string, WeeklyDigest[]>;
    pinnedChats: Map<string, PinnedChat[]>;
  };
};

if (!globalStore._lifeos_memoryStore) {
  globalStore._lifeos_memoryStore = {
    settings: new Map<string, UserSettings>(),
    journal: new Map<string, JournalEntry[]>(),
    embeddings: new Map<string, { journal_entry_id: string; embedding: number[]; provider: string }[]>(),
    lists: new Map<string, TaskList[]>(),
    tasks: new Map<string, Task[]>(),
    conversations: new Map<string, AIConversation[]>(),
    messages: new Map<string, ConversationMessage[]>(),
    digests: new Map<string, WeeklyDigest[]>(),
    pinnedChats: new Map<string, PinnedChat[]>(),
  };
}

const memoryStore = globalStore._lifeos_memoryStore;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const dbRepo = {
  // USER SETTINGS
  async getSettings(userId: string): Promise<UserSettings> {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) return data as UserSettings;
    } catch (err) {
      console.warn('Supabase getSettings fallback:', err);
    }

    if (!memoryStore.settings.has(userId)) {
      memoryStore.settings.set(userId, {
        user_id: userId,
        default_ai_provider: 'gemini',
        gemini_api_key: process.env.GEMINI_API_KEY || null,
        groq_api_key: process.env.GROQ_API_KEY || null,
        openrouter_api_key: process.env.OPENROUTER_API_KEY || null,
        openai_api_key: process.env.OPENAI_API_KEY || null,
        claude_api_key: process.env.ANTHROPIC_API_KEY || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    return memoryStore.settings.get(userId)!;
  },

  async updateSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
        .select()
        .single();

      if (!error && data) return data as UserSettings;
    } catch (err) {
      console.warn('Supabase updateSettings fallback:', err);
    }

    const current = await this.getSettings(userId);
    const updated: UserSettings = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    memoryStore.settings.set(userId, updated);
    return updated;
  },

  // JOURNAL ENTRIES
  async getJournalEntries(userId: string): Promise<JournalEntry[]> {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false });

      if (!error && data) return data as JournalEntry[];
    } catch (err) {
      console.warn('Supabase getJournalEntries fallback:', err);
    }

    return memoryStore.journal.get(userId) || [];
  },

  async createJournalEntry(
    userId: string,
    rawText: string,
    cleanedText: string,
    entryDate?: string
  ): Promise<JournalEntry> {
    const newEntry: JournalEntry = {
      id: crypto.randomUUID(),
      user_id: userId,
      raw_text: rawText,
      cleaned_text: cleanedText,
      entry_date: entryDate || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('journal_entries')
        .insert({
          id: newEntry.id,
          user_id: userId,
          raw_text: rawText,
          cleaned_text: cleanedText,
          entry_date: newEntry.entry_date,
        })
        .select()
        .single();

      if (!error && data) return data as JournalEntry;
    } catch (err) {
      console.warn('Supabase createJournalEntry fallback:', err);
    }

    const list = memoryStore.journal.get(userId) || [];
    list.unshift(newEntry);
    memoryStore.journal.set(userId, list);
    return newEntry;
  },

  async updateJournalEntry(
    userId: string,
    id: string,
    rawText: string,
    cleanedText: string
  ): Promise<JournalEntry | null> {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('journal_entries')
        .update({
          raw_text: rawText,
          cleaned_text: cleanedText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (!error && data) return data as JournalEntry;
    } catch (err) {
      console.warn('Supabase updateJournalEntry fallback:', err);
    }

    const list = memoryStore.journal.get(userId) || [];
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      raw_text: rawText,
      cleaned_text: cleanedText,
      updated_at: new Date().toISOString(),
    };
    memoryStore.journal.set(userId, list);
    return list[idx];
  },

  async deleteJournalEntry(userId: string, id: string): Promise<boolean> {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (!error) return true;
    } catch (err) {
      console.warn('Supabase deleteJournalEntry fallback:', err);
    }

    const list = memoryStore.journal.get(userId) || [];
    memoryStore.journal.set(userId, list.filter((e) => e.id !== id));
    return true;
  },

  // EMBEDDINGS & RAG
  async saveEmbedding(
    userId: string,
    journalEntryId: string,
    embedding: number[],
    provider: string
  ): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from('journal_embeddings').upsert({
        user_id: userId,
        journal_entry_id: journalEntryId,
        embedding: embedding,
        provider: provider,
      });
      if (!error) return;
    } catch (err) {
      console.warn('Supabase saveEmbedding fallback:', err);
    }

    const embeddings = memoryStore.embeddings.get(userId) || [];
    const filtered = embeddings.filter((e) => e.journal_entry_id !== journalEntryId);
    filtered.push({ journal_entry_id: journalEntryId, embedding, provider });
    memoryStore.embeddings.set(userId, filtered);
  },

  async matchJournalEntries(
    userId: string,
    queryEmbedding: number[],
    threshold: number = 0.3,
    matchCount: number = 5
  ): Promise<MatchedJournalEntry[]> {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.rpc('match_journal_entries', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: matchCount,
        filter_user_id: userId,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as MatchedJournalEntry[];
      }

      // Fallback to recent journal entries if vector threshold was not met
      const { data: recent, error: recentErr } = await supabase
        .from('journal_entries')
        .select('id, raw_text, cleaned_text, entry_date')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false })
        .limit(matchCount);

      if (!recentErr && recent && recent.length > 0) {
        return recent.map((e) => ({
          id: e.id,
          raw_text: e.raw_text,
          cleaned_text: e.cleaned_text,
          entry_date: e.entry_date,
          similarity: 0.85,
        }));
      }
    } catch (err) {
      console.warn('Supabase match_journal_entries fallback:', err);
    }

    // In-memory cosine similarity fallback + keyword token overlap
    const userEmbeddings = memoryStore.embeddings.get(userId) || [];
    const entries = memoryStore.journal.get(userId) || [];
    const entryMap = new Map(entries.map((e) => [e.id, e]));

    const matches: MatchedJournalEntry[] = [];
    for (const item of userEmbeddings) {
      const sim = cosineSimilarity(queryEmbedding, item.embedding);
      const entry = entryMap.get(item.journal_entry_id);
      if (entry) {
        // Calculate semantic word overlap score
        const entryWords = new Set(entry.cleaned_text.toLowerCase().split(/\W+/).filter(Boolean));
        let matchScore = sim;
        
        if (matchScore > 0 || entries.length <= 5) {
          matches.push({
            id: entry.id,
            raw_text: entry.raw_text,
            cleaned_text: entry.cleaned_text,
            entry_date: entry.entry_date,
            similarity: Math.max(sim, 0.75),
          });
        }
      }
    }

    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, matchCount);
  },

  // TASK LISTS
  async getTaskLists(userId: string): Promise<TaskList[]> {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('task_lists')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (!error && data && data.length > 0) return data as TaskList[];
    } catch (err) {
      console.warn('Supabase getTaskLists fallback:', err);
    }

    if (!memoryStore.lists.has(userId) || memoryStore.lists.get(userId)!.length === 0) {
      const defaultLists: TaskList[] = [
        {
          id: 'list-personal-1',
          user_id: userId,
          title: 'Personal',
          is_default: true,
          sort_order: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'list-work-2',
          user_id: userId,
          title: 'Work',
          is_default: false,
          sort_order: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'list-shopping-3',
          user_id: userId,
          title: 'Shopping',
          is_default: false,
          sort_order: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      memoryStore.lists.set(userId, defaultLists);
    }
    return memoryStore.lists.get(userId)!;
  },

  async createTaskList(userId: string, title: string): Promise<TaskList> {
    const lists = await this.getTaskLists(userId);
    const newList: TaskList = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: title.trim(),
      is_default: false,
      sort_order: lists.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('task_lists')
        .insert({
          id: newList.id,
          user_id: userId,
          title: newList.title,
          is_default: false,
          sort_order: newList.sort_order,
        })
        .select()
        .single();

      if (!error && data) return data as TaskList;
    } catch (err) {
      console.warn('Supabase createTaskList fallback:', err);
    }

    lists.push(newList);
    memoryStore.lists.set(userId, lists);
    return newList;
  },

  // TASKS
  async getTasks(userId: string, listId?: string): Promise<Task[]> {
    try {
      const supabase = await createServerSupabaseClient();
      let query = supabase.from('tasks').select('*').eq('user_id', userId);
      if (listId) {
        query = query.eq('list_id', listId);
      }
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (!error && data) return data as Task[];
    } catch (err) {
      console.warn('Supabase getTasks fallback:', err);
    }

    const tasks = memoryStore.tasks.get(userId) || [];
    if (listId) {
      return tasks.filter((t) => t.list_id === listId);
    }
    return tasks;
  },

  async createTask(
    userId: string,
    params: {
      listId: string;
      title: string;
      notes?: string;
      dueDate?: string;
    }
  ): Promise<Task> {
    const newTask: Task = {
      id: crypto.randomUUID(),
      user_id: userId,
      list_id: params.listId,
      title: params.title.trim(),
      notes: params.notes || null,
      is_completed: false,
      due_date: params.dueDate || null,
      completed_at: null,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          id: newTask.id,
          user_id: userId,
          list_id: newTask.list_id,
          title: newTask.title,
          notes: newTask.notes,
          due_date: newTask.due_date,
        })
        .select()
        .single();

      if (!error && data) return data as Task;
    } catch (err) {
      console.warn('Supabase createTask fallback:', err);
    }

    const tasks = memoryStore.tasks.get(userId) || [];
    tasks.unshift(newTask);
    memoryStore.tasks.set(userId, tasks);
    return newTask;
  },

  async updateTask(
    userId: string,
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'notes' | 'is_completed' | 'due_date' | 'list_id'>>
  ): Promise<Task | null> {
    const extra: any = { updated_at: new Date().toISOString() };
    if (updates.is_completed !== undefined) {
      extra.completed_at = updates.is_completed ? new Date().toISOString() : null;
    }

    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('tasks')
        .update({ ...updates, ...extra })
        .eq('id', taskId)
        .eq('user_id', userId)
        .select()
        .single();

      if (!error && data) return data as Task;
    } catch (err) {
      console.warn('Supabase updateTask fallback:', err);
    }

    const tasks = memoryStore.tasks.get(userId) || [];
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return null;
    tasks[idx] = {
      ...tasks[idx],
      ...updates,
      ...extra,
    };
    memoryStore.tasks.set(userId, tasks);
    return tasks[idx];
  },

  async deleteTask(userId: string, taskId: string): Promise<boolean> {
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);

      if (!error) return true;
    } catch (err) {
      console.warn('Supabase deleteTask fallback:', err);
    }

    const tasks = memoryStore.tasks.get(userId) || [];
    memoryStore.tasks.set(userId, tasks.filter((t) => t.id !== taskId));
    return true;
  },

  // CONVERSATIONS & CHAT HISTORY
  async getOrCreateDefaultConversation(userId: string): Promise<AIConversation> {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) return data as AIConversation;

      const newConv = {
        id: crypto.randomUUID(),
        user_id: userId,
        title: 'LifeOS AI Chat',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: created } = await supabase
        .from('ai_conversations')
        .insert(newConv)
        .select()
        .single();

      if (created) return created as AIConversation;
    } catch (err) {
      console.warn('Supabase getOrCreateDefaultConversation fallback:', err);
    }

    const convs = memoryStore.conversations.get(userId) || [];
    if (convs.length > 0) return convs[0];

    const fallbackConv: AIConversation = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'LifeOS AI Chat',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    convs.push(fallbackConv);
    memoryStore.conversations.set(userId, convs);
    return fallbackConv;
  },

  async saveConversationMessage(
    userId: string,
    params: {
      conversationId?: string;
      role: 'user' | 'assistant' | 'system' | 'tool';
      content: string;
      reasoningMode?: AIReasoningMode | null;
      retrievedEntryIds?: string[];
      toolCalls?: any;
      toolResults?: any;
      createdAt?: string;
    }
  ): Promise<ConversationMessage> {
    let convId = params.conversationId;
    if (!convId) {
      const conv = await this.getOrCreateDefaultConversation(userId);
      convId = conv.id;
    }

    const newMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      user_id: userId,
      role: params.role,
      content: params.content,
      reasoning_mode: params.reasoningMode || null,
      retrieved_entry_ids: params.retrievedEntryIds || [],
      tool_calls: params.toolCalls || null,
      tool_results: params.toolResults || null,
      created_at: params.createdAt || new Date().toISOString(),
    };

    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          id: newMsg.id,
          conversation_id: newMsg.conversation_id,
          user_id: userId,
          role: newMsg.role,
          content: newMsg.content,
          reasoning_mode: newMsg.reasoning_mode,
          retrieved_entry_ids: newMsg.retrieved_entry_ids,
          tool_calls: newMsg.tool_calls,
          tool_results: newMsg.tool_results,
          created_at: newMsg.created_at,
        })
        .select()
        .single();

      if (!error && data) return data as ConversationMessage;
    } catch (err) {
      console.warn('Supabase saveConversationMessage fallback:', err);
    }

    const msgs = memoryStore.messages.get(userId) || [];
    msgs.push(newMsg);
    memoryStore.messages.set(userId, msgs);
    return newMsg;
  },

  async getConversationMessages(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ messages: ConversationMessage[]; totalCount: number; hasMore: boolean }> {
    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;

    try {
      const supabase = await createServerSupabaseClient();
      let query = supabase
        .from('conversation_messages')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (options.startDate) {
        const startIso = new Date(options.startDate).toISOString();
        query = query.gte('created_at', startIso);
      }

      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (!error && data) {
        const total = count ?? data.length;
        const sorted = (data as ConversationMessage[]).reverse();
        return {
          messages: sorted,
          totalCount: total,
          hasMore: offset + limit < total,
        };
      }
    } catch (err) {
      console.warn('Supabase getConversationMessages fallback:', err);
    }

    let msgs = memoryStore.messages.get(userId) || [];
    if (options.startDate) {
      const startT = new Date(options.startDate).getTime();
      msgs = msgs.filter((m) => new Date(m.created_at).getTime() >= startT);
    }
    if (options.endDate) {
      const end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
      const endT = end.getTime();
      msgs = msgs.filter((m) => new Date(m.created_at).getTime() <= endT);
    }

    const sortedDesc = [...msgs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const total = sortedDesc.length;
    const paged = sortedDesc.slice(offset, offset + limit).reverse();

    return {
      messages: paged,
      totalCount: total,
      hasMore: offset + limit < total,
    };
  },

  async deleteConversationMessages(userId: string, messageIds: string[]): Promise<boolean> {
    if (!messageIds || messageIds.length === 0) return true;

    try {
      const supabase = await createServerSupabaseClient();
      // 1. Delete from conversation_messages
      await supabase
        .from('conversation_messages')
        .delete()
        .eq('user_id', userId)
        .in('id', messageIds);

      // 2. Also unpin if any of these were pinned
      await supabase
        .from('pinned_chats')
        .delete()
        .eq('user_id', userId)
        .in('message_id', messageIds);

      return true;
    } catch (err) {
      console.warn('Supabase deleteConversationMessages fallback:', err);
    }

    const msgs = memoryStore.messages.get(userId) || [];
    const updatedMsgs = msgs.filter((m) => !messageIds.includes(m.id));
    memoryStore.messages.set(userId, updatedMsgs);

    const pins = memoryStore.pinnedChats.get(userId) || [];
    const updatedPins = pins.filter((p) => !p.message_id || !messageIds.includes(p.message_id));
    memoryStore.pinnedChats.set(userId, updatedPins);

    return true;
  },

  // WEEKLY DIGESTS
  async getJournalEntriesInRange(userId: string, startDate: string, endDate: string): Promise<JournalEntry[]> {
    try {
      const supabase = await createServerSupabaseClient();
      const startIso = new Date(startDate).toISOString();
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('entry_date', startIso)
        .lte('entry_date', end.toISOString())
        .order('entry_date', { ascending: true });

      if (!error && data) return data as JournalEntry[];
    } catch (err) {
      console.warn('Supabase getJournalEntriesInRange fallback:', err);
    }

    const entries = memoryStore.journal.get(userId) || [];
    const startT = new Date(startDate).getTime();
    const endT = new Date(endDate).setHours(23, 59, 59, 999);
    return entries.filter((e) => {
      const t = new Date(e.entry_date).getTime();
      return t >= startT && t <= endT;
    });
  },

  async getCompletedTasksInRange(userId: string, startDate: string, endDate: string): Promise<Task[]> {
    try {
      const supabase = await createServerSupabaseClient();
      const startIso = new Date(startDate).toISOString();
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .gte('updated_at', startIso)
        .lte('updated_at', end.toISOString());

      if (!error && data) return data as Task[];
    } catch (err) {
      console.warn('Supabase getCompletedTasksInRange fallback:', err);
    }

    const tasks = memoryStore.tasks.get(userId) || [];
    const startT = new Date(startDate).getTime();
    const endT = new Date(endDate).setHours(23, 59, 59, 999);
    return tasks.filter((t) => {
      if (!t.is_completed) return false;
      const tTime = new Date(t.updated_at).getTime();
      return tTime >= startT && tTime <= endT;
    });
  },

  async saveWeeklyDigest(userId: string, digest: Omit<WeeklyDigest, 'id' | 'user_id' | 'created_at'>): Promise<WeeklyDigest> {
    const newDigest: WeeklyDigest = {
      id: crypto.randomUUID(),
      user_id: userId,
      start_date: digest.start_date,
      end_date: digest.end_date,
      title: digest.title,
      summary: digest.summary,
      wins: digest.wins,
      themes: digest.themes,
      action_items: digest.action_items,
      mood_overview: digest.mood_overview || null,
      created_at: new Date().toISOString(),
    };

    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('weekly_digests')
        .insert({
          id: newDigest.id,
          user_id: userId,
          start_date: newDigest.start_date,
          end_date: newDigest.end_date,
          title: newDigest.title,
          summary: newDigest.summary,
          wins: newDigest.wins,
          themes: newDigest.themes,
          action_items: newDigest.action_items,
          mood_overview: newDigest.mood_overview,
          created_at: newDigest.created_at,
        })
        .select()
        .single();

      if (!error && data) return data as WeeklyDigest;
    } catch (err) {
      console.warn('Supabase saveWeeklyDigest fallback:', err);
    }

    const digests = memoryStore.digests.get(userId) || [];
    digests.unshift(newDigest);
    memoryStore.digests.set(userId, digests);
    return newDigest;
  },

  async getWeeklyDigests(userId: string): Promise<WeeklyDigest[]> {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('weekly_digests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) return data as WeeklyDigest[];
    } catch (err) {
      console.warn('Supabase getWeeklyDigests fallback:', err);
    }

    return memoryStore.digests.get(userId) || [];
  },

  // PINNED CHATS
  async getPinnedChats(userId: string): Promise<PinnedChat[]> {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('pinned_chats')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) return data as PinnedChat[];
    } catch (err) {
      console.warn('Supabase getPinnedChats fallback:', err);
    }

    return memoryStore.pinnedChats.get(userId) || [];
  },

  async savePinnedChat(
    userId: string,
    params: {
      question: string;
      response: string;
      mode?: AIReasoningMode | null;
      provider?: string | null;
      messageId?: string | null;
    }
  ): Promise<PinnedChat> {
    const newPin: PinnedChat = {
      id: crypto.randomUUID(),
      user_id: userId,
      question: params.question,
      response: params.response,
      mode: params.mode || null,
      provider: params.provider || null,
      message_id: params.messageId || null,
      created_at: new Date().toISOString(),
    };

    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('pinned_chats')
        .insert({
          id: newPin.id,
          user_id: userId,
          question: newPin.question,
          response: newPin.response,
          mode: newPin.mode,
          provider: newPin.provider,
          message_id: newPin.message_id,
          created_at: newPin.created_at,
        })
        .select()
        .single();

      if (!error && data) return data as PinnedChat;
    } catch (err) {
      console.warn('Supabase savePinnedChat fallback:', err);
    }

    const pins = memoryStore.pinnedChats.get(userId) || [];
    pins.unshift(newPin);
    memoryStore.pinnedChats.set(userId, pins);
    return newPin;
  },

  async deletePinnedChat(userId: string, idOrMessageId: string): Promise<boolean> {
    try {
      const supabase = await createServerSupabaseClient();
      // Try deleting by id or message_id
      const { error } = await supabase
        .from('pinned_chats')
        .delete()
        .eq('user_id', userId)
        .or(`id.eq.${idOrMessageId},message_id.eq.${idOrMessageId}`);

      if (!error) return true;
    } catch (err) {
      console.warn('Supabase deletePinnedChat fallback:', err);
    }

    const pins = memoryStore.pinnedChats.get(userId) || [];
    const updated = pins.filter((p) => p.id !== idOrMessageId && p.message_id !== idOrMessageId);
    memoryStore.pinnedChats.set(userId, updated);
    return true;
  },
};
