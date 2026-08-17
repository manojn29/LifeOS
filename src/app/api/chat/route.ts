import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/db/supabase-server';
import { dbRepo } from '@/lib/db/repo';
import { getAIProviderForUser } from '@/lib/ai/factory';
import { TaskToolCall, ToolExecutionResult } from '@/lib/ai/types';
import { AIReasoningMode } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const result = await dbRepo.getConversationMessages(user.id, {
      limit,
      offset,
      startDate,
      endDate,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Chat history fetch error:', err);
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
    const { message, messages = [], reasoningMode } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    // Save user message to persistent DB
    await dbRepo.saveConversationMessage(user.id, {
      role: 'user',
      content: message.trim(),
    });

    const aiProvider = await getAIProviderForUser(user.id);
    const availableTaskLists = await dbRepo.getTaskLists(user.id);

    // 1. Generate query embedding
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await aiProvider.generateEmbedding(message);
    } catch (embErr) {
      console.warn('Chat query embedding error:', embErr);
    }

    // 2. Vector RAG Search: Retrieve relevant journal entries
    let matchedEntries: any[] = [];
    if (queryEmbedding.length > 0) {
      try {
        matchedEntries = await dbRepo.matchJournalEntries(user.id, queryEmbedding, 0.3, 4);
      } catch (matchErr) {
        console.warn('Vector match error:', matchErr);
      }
    }

    // 3. Determine Reasoning Mode (User-Specified Mode or Smart Auto-Classification)
    let mode: AIReasoningMode;
    if (
      reasoningMode === 'mode_1_journal_only' ||
      reasoningMode === 'mode_2_journal_general' ||
      reasoningMode === 'mode_3_journal_search'
    ) {
      mode = reasoningMode;
    } else {
      const classification = await aiProvider.classifyIntent(message);
      mode = classification.mode;
    }

    // 4. Define Tool Execution callback to perform real DB operations
    const handleToolCall = async (toolCall: TaskToolCall): Promise<ToolExecutionResult> => {
      try {
        if (toolCall.tool === 'create_task') {
          const { title, listName, dueDate, notes } = toolCall.arguments;
          let targetList = availableTaskLists.find(
            (l) => l.title.toLowerCase() === (listName || '').toLowerCase()
          );

          if (!targetList) {
            if (listName && listName.toLowerCase() !== 'personal') {
              targetList = await dbRepo.createTaskList(user.id, listName);
              availableTaskLists.push(targetList);
            } else {
              targetList = availableTaskLists.find((l) => l.is_default) || availableTaskLists[0];
            }
          }

          const created = await dbRepo.createTask(user.id, {
            listId: targetList.id,
            title,
            notes,
            dueDate,
          });

          return {
            tool: 'create_task',
            success: true,
            message: `Added "${title}" to ${targetList.title}${dueDate ? ` (${dueDate})` : ''}.`,
            data: created,
          };
        }

        if (toolCall.tool === 'create_list') {
          const { listName } = toolCall.arguments;
          const newList = await dbRepo.createTaskList(user.id, listName);
          availableTaskLists.push(newList);
          return {
            tool: 'create_list',
            success: true,
            message: `Created new list "${listName}".`,
            data: newList,
          };
        }

        if (toolCall.tool === 'complete_task') {
          const { taskTitleOrId } = toolCall.arguments;
          const allTasks = await dbRepo.getTasks(user.id);
          const target = allTasks.find(
            (t) =>
              t.id === taskTitleOrId ||
              t.title.toLowerCase().includes(taskTitleOrId.toLowerCase())
          );

          if (target) {
            const updated = await dbRepo.updateTask(user.id, target.id, { is_completed: true });
            return {
              tool: 'complete_task',
              success: true,
              message: `Marked "${target.title}" as completed.`,
              data: updated,
            };
          }
          return {
            tool: 'complete_task',
            success: false,
            message: `Could not find task matching "${taskTitleOrId}".`,
          };
        }

        return {
          tool: toolCall.tool,
          success: false,
          message: `Unknown tool: ${toolCall.tool}`,
        };
      } catch (err: any) {
        return {
          tool: toolCall.tool,
          success: false,
          message: `Failed to execute ${toolCall.tool}: ${err.message}`,
        };
      }
    };

    // 5. Generate Answer via AI Provider with RAG context and Tool execution
    const chatResult = await aiProvider.chatWithContext({
      messages: [...messages, { role: 'user', content: message }],
      journalContext: matchedEntries,
      mode,
      availableTaskLists,
      onToolCall: handleToolCall,
    });

    const citations = matchedEntries.map((e) => ({
      id: e.id,
      date: e.entry_date,
      preview: e.cleaned_text.slice(0, 150),
      similarity: Math.round(e.similarity * 100),
    }));

    // Save assistant reply to persistent DB
    await dbRepo.saveConversationMessage(user.id, {
      role: 'assistant',
      content: chatResult.response,
      reasoningMode: chatResult.modeUsed || mode,
      retrievedEntryIds: matchedEntries.map((e) => e.id),
      toolResults: chatResult.toolActions,
    });

    return NextResponse.json({
      reply: chatResult.response,
      mode: chatResult.modeUsed || mode,
      citations,
      toolActions: chatResult.toolActions || [],
      provider: aiProvider.providerName,
    });
  } catch (err: any) {
    console.error('Chat API route error:', err);
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
    const idsParam = searchParams.get('ids');
    let messageIds: string[] = [];

    if (idsParam) {
      messageIds = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body.ids)) {
        messageIds = body.ids;
      } else if (body.id) {
        messageIds = [body.id];
      }
    }

    if (messageIds.length === 0) {
      return NextResponse.json({ error: 'No message IDs provided' }, { status: 400 });
    }

    const success = await dbRepo.deleteConversationMessages(user.id, messageIds);
    return NextResponse.json({ success, deletedIds: messageIds });
  } catch (err: any) {
    console.error('Delete chat message error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
