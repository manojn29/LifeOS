import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/db/supabase-server';
import { dbRepo } from '@/lib/db/repo';
import { getAIProviderForUser } from '@/lib/ai/factory';
import { extractTasksFromJournalText } from '@/lib/ai/task-extractor';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entries = await dbRepo.getJournalEntries(user.id);
    return NextResponse.json({ entries });
  } catch (err: any) {
    console.error('Error fetching journal entries:', err);
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
    const { rawText, entryDate } = body;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({ error: 'Journal text cannot be empty' }, { status: 400 });
    }

    // 1. Get user AI provider
    const aiProvider = await getAIProviderForUser(user.id);

    // 2. AI Cleaning Pipeline (preserves facts & intent, fixes grammar & readability)
    const cleanedText = await aiProvider.cleanJournal(rawText);

    // 3. Save raw_text (unmodified source of truth) and cleaned_text to DB
    const newEntry = await dbRepo.createJournalEntry(user.id, rawText, cleanedText, entryDate);

    // 4. Generate Embedding for cleaned_text and index in pgvector
    try {
      const embedding = await aiProvider.generateEmbedding(cleanedText);
      await dbRepo.saveEmbedding(user.id, newEntry.id, embedding, aiProvider.providerName);
    } catch (embErr) {
      console.warn('Could not generate embedding for entry:', embErr);
    }

    // 5. Automatic Journal Task Extraction & Auto-Creation
    const autoCreatedTasks: { title: string; listName: string }[] = [];
    try {
      const availableLists = await dbRepo.getTaskLists(user.id);
      const extractedTasks = extractTasksFromJournalText(rawText, availableLists);

      for (const extracted of extractedTasks) {
        let targetList = availableLists.find(
          (l) => l.title.toLowerCase() === extracted.listName.toLowerCase()
        );

        if (!targetList) {
          targetList = await dbRepo.createTaskList(user.id, extracted.listName);
          availableLists.push(targetList);
        }

        await dbRepo.createTask(user.id, {
          listId: targetList.id,
          title: extracted.title,
          dueDate: extracted.dueDate,
          notes: extracted.notes,
        });

        autoCreatedTasks.push({
          title: extracted.title,
          listName: targetList.title,
        });
      }
    } catch (taskErr) {
      console.warn('Automatic task extraction non-fatal error:', taskErr);
    }

    return NextResponse.json({ entry: newEntry, autoCreatedTasks }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating journal entry:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
