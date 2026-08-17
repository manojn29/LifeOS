-- ==============================================================================
-- LIFEOS — PRODUCTION DATABASE SCHEMA WITH PGVECTOR & ROW LEVEL SECURITY (RLS)
-- Philosophy: "My data belongs to me. AI models are replaceable."
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. USER SETTINGS TABLE (Model-agnostic AI provider preferences)
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    default_ai_provider VARCHAR(50) DEFAULT 'gemini' NOT NULL, -- 'gemini' | 'groq' | 'openrouter' | 'openai' | 'claude'
    gemini_api_key TEXT,
    groq_api_key TEXT,
    openrouter_api_key TEXT,
    openai_api_key TEXT,
    claude_api_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Migrations for existing user_settings tables
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS groq_api_key TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT;

-- 3. JOURNAL ENTRIES TABLE
-- Stores both raw_text (unmodified user truth) and cleaned_text (grammar/clarity polished for AI)
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    cleaned_text TEXT NOT NULL,
    entry_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. JOURNAL EMBEDDINGS (pgvector for semantic search)
-- 1536-dimensional vector for fast cosine similarity search
CREATE TABLE IF NOT EXISTS public.journal_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    provider VARCHAR(50) DEFAULT 'gemini' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. TASK LISTS TABLE (Google Tasks model: Personal, Work, Shopping, Travel, etc.)
CREATE TABLE IF NOT EXISTS public.task_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES public.task_lists(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    notes TEXT,
    is_completed BOOLEAN DEFAULT false NOT NULL,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. AI CONVERSATIONS & CONVERSATION MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Chat' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' | 'assistant' | 'system' | 'tool'
    content TEXT NOT NULL,
    reasoning_mode VARCHAR(30), -- 'mode_1_journal_only' | 'mode_2_journal_general' | 'mode_3_journal_search'
    retrieved_entry_ids UUID[] DEFAULT '{}',
    tool_calls JSONB,
    tool_results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON public.journal_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_list ON public.tasks(user_id, list_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_task_lists_user ON public.task_lists(user_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_id ON public.conversation_messages(conversation_id, created_at ASC);

-- 9. PGVECTOR SIMILARITY MATCH FUNCTION (RAG Search)
CREATE OR REPLACE FUNCTION match_journal_entries(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    filter_user_id uuid
)
RETURNS TABLE (
    id uuid,
    raw_text text,
    cleaned_text text,
    entry_date timestamptz,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        je.id,
        je.raw_text,
        je.cleaned_text,
        je.entry_date,
        (1 - (je_emb.embedding <=> query_embedding))::float AS similarity
    FROM public.journal_embeddings je_emb
    JOIN public.journal_entries je ON je.id = je_emb.journal_entry_id
    WHERE je_emb.user_id = filter_user_id
      AND (1 - (je_emb.embedding <=> query_embedding)) > match_threshold
    ORDER BY je_emb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Helper to safely drop existing policies before recreation
DO $$
BEGIN
    -- user_settings
    DROP POLICY IF EXISTS "user_settings_owner_access" ON public.user_settings;
    CREATE POLICY "user_settings_owner_access" ON public.user_settings FOR ALL USING (auth.uid() = user_id);

    -- journal_entries
    DROP POLICY IF EXISTS "journal_entries_owner_access" ON public.journal_entries;
    CREATE POLICY "journal_entries_owner_access" ON public.journal_entries FOR ALL USING (auth.uid() = user_id);

    -- journal_embeddings
    DROP POLICY IF EXISTS "journal_embeddings_owner_access" ON public.journal_embeddings;
    CREATE POLICY "journal_embeddings_owner_access" ON public.journal_embeddings FOR ALL USING (auth.uid() = user_id);

    -- task_lists
    DROP POLICY IF EXISTS "task_lists_owner_access" ON public.task_lists;
    CREATE POLICY "task_lists_owner_access" ON public.task_lists FOR ALL USING (auth.uid() = user_id);

    -- tasks
    DROP POLICY IF EXISTS "tasks_owner_access" ON public.tasks;
    CREATE POLICY "tasks_owner_access" ON public.tasks FOR ALL USING (auth.uid() = user_id);

    -- ai_conversations
    DROP POLICY IF EXISTS "ai_conversations_owner_access" ON public.ai_conversations;
    CREATE POLICY "ai_conversations_owner_access" ON public.ai_conversations FOR ALL USING (auth.uid() = user_id);

    -- conversation_messages
    DROP POLICY IF EXISTS "conversation_messages_owner_access" ON public.conversation_messages;
    CREATE POLICY "conversation_messages_owner_access" ON public.conversation_messages FOR ALL USING (auth.uid() = user_id);

    -- weekly_digests
    DROP POLICY IF EXISTS "weekly_digests_owner_access" ON public.weekly_digests;
    CREATE POLICY "weekly_digests_owner_access" ON public.weekly_digests FOR ALL USING (auth.uid() = user_id);

    -- pinned_chats
    DROP POLICY IF EXISTS "pinned_chats_owner_access" ON public.pinned_chats;
    CREATE POLICY "pinned_chats_owner_access" ON public.pinned_chats FOR ALL USING (auth.uid() = user_id);
END $$;

-- 8c. PINNED CHATS TABLE (Pinned Question + Response pairs)
CREATE TABLE IF NOT EXISTS public.pinned_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    response TEXT NOT NULL,
    mode VARCHAR(50),
    provider VARCHAR(50),
    message_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pinned_chats_user ON public.pinned_chats(user_id, created_at DESC);

-- 8b. WEEKLY DIGESTS TABLE
CREATE TABLE IF NOT EXISTS public.weekly_digests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    wins TEXT[] DEFAULT '{}',
    themes TEXT[] DEFAULT '{}',
    action_items TEXT[] DEFAULT '{}',
    mood_overview VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_user ON public.weekly_digests(user_id, created_at DESC);

-- 11. TRIGGER: Automatically create default "Personal" and "Work" task lists for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS trigger AS $$
BEGIN
    -- Create default user settings
    INSERT INTO public.user_settings (user_id, default_ai_provider)
    VALUES (new.id, 'gemini')
    ON CONFLICT (user_id) DO NOTHING;

    -- Create default Task Lists
    INSERT INTO public.task_lists (user_id, title, is_default, sort_order)
    VALUES 
        (new.id, 'Personal', true, 1),
        (new.id, 'Work', false, 2),
        (new.id, 'Shopping', false, 3)
    ON CONFLICT DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();
