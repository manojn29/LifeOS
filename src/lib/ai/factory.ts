import { AIProvider, AIProviderType } from './types';
import { GeminiProvider } from './providers/gemini';
import { OpenAIProvider } from './providers/openai';
import { ClaudeProvider } from './providers/claude';
import { dbRepo } from '../db/repo';

export async function getAIProviderForUser(userId: string): Promise<AIProvider> {
  const settings = await dbRepo.getSettings(userId);
  const providerType: AIProviderType = settings.default_ai_provider || 'gemini';

  switch (providerType) {
    case 'openai':
      return new OpenAIProvider(settings.openai_api_key || process.env.OPENAI_API_KEY);
    case 'claude':
      return new ClaudeProvider(settings.claude_api_key || process.env.ANTHROPIC_API_KEY);
    case 'gemini':
    default:
      return new GeminiProvider(settings.gemini_api_key || process.env.GEMINI_API_KEY);
  }
}
