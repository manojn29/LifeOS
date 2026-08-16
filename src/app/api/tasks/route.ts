import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/db/supabase-server';
import { dbRepo } from '@/lib/db/repo';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const listId = searchParams.get('listId') || undefined;

    const tasks = await dbRepo.getTasks(user.id, listId);
    return NextResponse.json({ tasks });
  } catch (err: any) {
    console.error('Error fetching tasks:', err);
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
    const { listId, title, notes, dueDate } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    let targetListId = listId;
    if (!targetListId) {
      const lists = await dbRepo.getTaskLists(user.id);
      const defaultList = lists.find((l) => l.is_default) || lists[0];
      targetListId = defaultList.id;
    }

    const task = await dbRepo.createTask(user.id, {
      listId: targetListId,
      title,
      notes,
      dueDate,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating task:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
