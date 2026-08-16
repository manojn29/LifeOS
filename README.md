# LifeOS — Minimal AI Personal Memory PWA

> **"My data belongs to me. AI models are replaceable."**

LifeOS is a privacy-first, model-agnostic Personal Memory Progressive Web App (PWA). It stores your journal entries, memories, and to-do lists in your own PostgreSQL database, enabling any AI model (Gemini, OpenAI, Claude, Groq, OpenRouter) to retrieve, polish, and reason over your data without vendor lock-in.

---

## ✨ Features

- **Dual-Layer Journaling**: Raw text is preserved as the uncompromised source of truth; AI cleans spelling/grammar and indexes entries into `pgvector`.
- **RAG Semantic Search & Memory Recall**: Cosine-similarity vector search retrieves only relevant journal entries to answer personal questions without hallucinating.
- **Natural Language Task Management**: Conversational AI function calling automatically creates, checks, and manages to-do tasks across custom lists (Personal, Work, Shopping, etc.).
- **Multi-Model Provider Architecture**: Pluggable Strategy Pattern supporting **Google Gemini**, **OpenAI**, and **Anthropic Claude**.
- **Progressive Web App (PWA)**: Installable on iOS, Android, and Desktop with full-screen distraction-free UI.
- **Tenant Isolation & Security**: PostgreSQL Row Level Security (RLS) with Supabase Auth.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS
- **Database & Vectors**: PostgreSQL + `pgvector`
- **Authentication**: Supabase Auth (SSR Client `@supabase/ssr`)
- **AI Providers**: `@google/genai` (Gemini 3.5/3.7 Flash), `openai` (GPT-4o), `@anthropic-ai/sdk` (Claude 3.5)
- **Deployment**: Netlify / Vercel

---

## 🗺️ Roadmap & Upcoming Integrations

See [TODO.md](./TODO.md) for active tasks:
- [ ] **Groq Provider Adapter**: Llama 3.3 70B & DeepSeek R1 via Groq's ultra-fast LPU inference (Free tier).
- [ ] **OpenRouter Provider Adapter**: Access to OpenRouter's free-tier open models (`:free` catalog).
- [ ] **Data Export**: Full export of raw memories and embeddings into JSON/Markdown archive.

---

## 🚀 Getting Started

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   GEMINI_API_KEY=your-gemini-key
   ```

3. Run the database schema in Supabase SQL editor using `src/lib/db/schema.sql`.

4. Start the development server:
   ```bash
   npm run dev
   ```
