# LifeOS — Roadmap & To-Do List

## ✅ Completed Features

### 1. ⚡ Groq AI Provider Adapter (Phase 2)
- [x] `GroqProvider` class in `src/lib/ai/providers/groq.ts` with OpenAI SDK compatibility.
- [x] Ultra-fast models: `llama-3.3-70b-versatile`, `deepseek-r1-distill-llama-70b`, `llama-3.1-8b-instant`.
- [x] `groq_api_key` support in Settings UI and database.

### 2. 🌐 OpenRouter AI Provider Adapter (Phase 2)
- [x] `OpenRouterProvider` in `src/lib/ai/providers/openrouter.ts`.
- [x] Free catalog models (`llama-3.3-70b:free`, `deepseek-r1:free`, `gemma-2-9b:free`, `mistral-7b:free`).
- [x] `openrouter_api_key` support in Settings and factory.

### 3. ✨ Weekly AI Digest (Phase 3)
- [x] `weekly_digests` table schema & RLS policies in PostgreSQL.
- [x] Cross-model `generateWeeklyDigest` synthesis pipeline (Gemini, Groq, OpenRouter, OpenAI, Claude).
- [x] `/api/digest` endpoint with custom timeframe and previous 7 days default.
- [x] Dedicated `/digest` dashboard with Wins 🏆, Themes 💡, Action Items 🎯, Mood overview, and past review archive.

---

## 🚀 Future Enhancements
- [ ] **Voice Journaling**: Local on-device Whisper transcription (speech-to-text).
- [ ] **Data Export**: Full export of raw memories and embeddings into JSON/Markdown archive.
