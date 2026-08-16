import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/db/supabase-server';
import { dbRepo } from '@/lib/db/repo';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await dbRepo.getSettings(user.id);
    return NextResponse.json({
      settings: {
        default_ai_provider: settings.default_ai_provider,
        has_gemini_key: Boolean(settings.gemini_api_key || process.env.GEMINI_API_KEY),
        has_openai_key: Boolean(settings.openai_api_key || process.env.OPENAI_API_KEY),
        has_claude_key: Boolean(settings.claude_api_key || process.env.ANTHROPIC_API_KEY),
      },
    });
  } catch (err: any) {
    console.error('Settings GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { default_ai_provider, gemini_api_key, openai_api_key, claude_api_key } = body;

    const updates: any = {};
    if (default_ai_provider) updates.default_ai_provider = default_ai_provider;
    if (gemini_api_key !== undefined) updates.gemini_api_key = gemini_api_key;
    if (openai_api_key !== undefined) updates.openai_api_key = openai_api_key;
    if (claude_api_key !== undefined) updates.claude_api_key = claude_api_key;

    const updated = await dbRepo.updateSettings(user.id, updates);

    return NextResponse.json({
      settings: {
        default_ai_provider: updated.default_ai_provider,
        has_gemini_key: Boolean(updated.gemini_api_key || process.env.GEMINI_API_KEY),
        has_openai_key: Boolean(updated.openai_api_key || process.env.OPENAI_API_KEY),
        has_claude_key: Boolean(updated.claude_api_key || process.env.ANTHROPIC_API_KEY),
      },
    });
  } catch (err: any) {
    console.error('Settings POST error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
