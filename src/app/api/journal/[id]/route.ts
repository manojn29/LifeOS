import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/db/supabase-server';
import { dbRepo } from '@/lib/db/repo';
import { getAIProviderForUser } from '@/lib/ai/factory';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { rawText } = body;

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json({ error: 'Journal text cannot be empty' }, { status: 400 });
    }

    const aiProvider = await getAIProviderForUser(user.id);
    const cleanedText = await aiProvider.cleanJournal(rawText);

    const updatedEntry = await dbRepo.updateJournalEntry(user.id, id, rawText, cleanedText);
    if (!updatedEntry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Re-embed and update vector
    try {
      const embedding = await aiProvider.generateEmbedding(cleanedText);
      await dbRepo.saveEmbedding(user.id, id, embedding, aiProvider.providerName);
    } catch (embErr) {
      console.warn('Re-embedding failed:', embErr);
    }

    return NextResponse.json({ entry: updatedEntry });
  } catch (err: any) {
    console.error('Error updating journal entry:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const success = await dbRepo.deleteJournalEntry(user.id, id);

    return NextResponse.json({ success });
  } catch (err: any) {
    console.error('Error deleting journal entry:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
