# LifeOS — Roadmap & To-Do List

## 🎯 Upcoming Integrations (Phase 2)

### 1. ⚡ Groq AI Provider Adapter
- [ ] Add `GroqProvider` class in `src/lib/ai/providers/groq.ts` using OpenAI-compatible SDK (`baseURL: 'https://api.groq.com/openai/v1'`).
- [ ] Support ultra-fast models:
  - `llama-3.3-70b-versatile` (Meta's flagship 70B model)
  - `deepseek-r1-distill-llama-70b` (DeepSeek reasoning model)
  - `llama-3.1-8b-instant` (Ultra-low latency)
- [ ] Add `groq_api_key` column to `user_settings` table and Settings UI key input.
- [ ] Add Groq option to Provider Switcher in `/settings`.

### 2. 🌐 OpenRouter AI Provider Adapter
- [ ] Add `OpenRouterProvider` in `src/lib/ai/providers/openrouter.ts`.
- [ ] Support free-tier model catalog (`:free` suffix):
  - `meta-llama/llama-3.3-70b-instruct:free`
  - `deepseek/deepseek-r1:free`
  - `google/gemma-2-9b-it:free`
  - `mistralai/mistral-7b-instruct:free`
- [ ] Add `openrouter_api_key` to Settings and environment configuration.
- [ ] Support dynamic model selection within OpenRouter.

---

## 🚀 Future Enhancements (Phase 3)
- [ ] **Voice Journaling**: Local on-device Whisper transcription (speech-to-text).
- [ ] **Data Export**: Full export of raw memories and embeddings into JSON/Markdown archive.
- [ ] **Weekly AI Digest**: Automated weekly life review summarizing key themes, wins, and reflections.
