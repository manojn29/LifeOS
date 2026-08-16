import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/db/supabase-server';
import { dbRepo } from '@/lib/db/repo';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lists = await dbRepo.getTaskLists(user.id);
    return NextResponse.json({ lists });
  } catch (err: any) {
    console.error('Error fetching task lists:', err);
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
    const { title } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'List title is required' }, { status: 400 });
    }

    const newList = await dbRepo.createTaskList(user.id, title);
    return NextResponse.json({ list: newList }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating task list:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
