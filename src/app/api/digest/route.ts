import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/db/supabase-server';
import { dbRepo } from '@/lib/db/repo';
import { getAIProviderForUser } from '@/lib/ai/factory';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const digests = await dbRepo.getWeeklyDigests(user.id);
    return NextResponse.json({ digests });
  } catch (err: any) {
    console.error('Weekly digests fetch error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let { startDate, endDate } = body;

    // Default to past 7 days
    if (!endDate) {
      endDate = new Date().toISOString().split('T')[0];
    }
    if (!startDate) {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      startDate = past.toISOString().split('T')[0];
    }

    // 1. Fetch journal entries in timeframe
    const entries = await dbRepo.getJournalEntriesInRange(user.id, startDate, endDate);

    // 2. Fetch completed tasks in timeframe
    const completedTasks = await dbRepo.getCompletedTasksInRange(user.id, startDate, endDate);

    // 3. Get user AI Provider and synthesize Weekly Digest
    const aiProvider = await getAIProviderForUser(user.id);

    let synthesis: {
      title: string;
      summary: string;
      wins: string[];
      themes: string[];
      action_items: string[];
      mood_overview?: string;
    };

    if (aiProvider.generateWeeklyDigest) {
      synthesis = await aiProvider.generateWeeklyDigest({
        startDate,
        endDate,
        journalEntries: entries.map((e) => ({
          date: e.entry_date,
          text: e.cleaned_text || e.raw_text,
        })),
        completedTasks: completedTasks.map((t) => ({
          title: t.title,
        })),
      });
    } else {
      synthesis = {
        title: `Weekly Review (${startDate} – ${endDate})`,
        summary: `Reflected on ${entries.length} journal entries and accomplished ${completedTasks.length} tasks during this 7-day period.`,
        wins: completedTasks.map((t) => `Completed: ${t.title}`),
        themes: ['Focus', 'Consistency', 'Reflections'],
        action_items: ['Keep writing daily thoughts', 'Maintain consistent momentum'],
        mood_overview: 'Calm & Steady',
      };
    }

    // 4. Save to Database
    const savedDigest = await dbRepo.saveWeeklyDigest(user.id, {
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      title: synthesis.title,
      summary: synthesis.summary,
      wins: synthesis.wins,
      themes: synthesis.themes,
      action_items: synthesis.action_items,
      mood_overview: synthesis.mood_overview,
    });

    return NextResponse.json({ digest: savedDigest }, { status: 201 });
  } catch (err: any) {
    console.error('Generate weekly digest error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
