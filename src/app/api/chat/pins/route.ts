import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/db/supabase-server';
import { dbRepo } from '@/lib/db/repo';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pins = await dbRepo.getPinnedChats(user.id);
    return NextResponse.json({ pins });
  } catch (err: any) {
    console.error('Fetch pinned chats error:', err);
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
    const { question, response, mode, provider, messageId } = body;

    if (!question || !response) {
      return NextResponse.json(
        { error: 'Question and response are required to pin.' },
        { status: 400 }
      );
    }

    const pin = await dbRepo.savePinnedChat(user.id, {
      question,
      response,
      mode,
      provider,
      messageId,
    });

    return NextResponse.json({ pin }, { status: 201 });
  } catch (err: any) {
    console.error('Save pinned chat error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const messageId = searchParams.get('messageId');

    const target = id || messageId;
    if (!target) {
      return NextResponse.json({ error: 'Pin ID or Message ID is required' }, { status: 400 });
    }

    const success = await dbRepo.deletePinnedChat(user.id, target);
    return NextResponse.json({ success });
  } catch (err: any) {
    console.error('Delete pinned chat error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
