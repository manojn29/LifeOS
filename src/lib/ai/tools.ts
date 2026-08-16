export const TASK_TOOLS_SCHEMA = [
  {
    name: 'create_task',
    description: 'Creates a new to-do task in a specified list (defaults to Personal or Work)',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'The title or action of the task (e.g. "Apply to Meta", "Call Mom", "LeetCode for 1 hour")',
        },
        listName: {
          type: 'STRING',
          description: 'The target list title (e.g. "Personal", "Work", "Shopping", "Travel"). If list does not exist, it will be mapped or created.',
        },
        dueDate: {
          type: 'STRING',
          description: 'Optional due date or time descriptor (e.g. "tonight", "tomorrow", "2026-08-20")',
        },
        notes: {
          type: 'STRING',
          description: 'Optional additional notes or context for the task',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description: 'Marks an existing task as completed',
    parameters: {
      type: 'OBJECT',
      properties: {
        taskTitleOrId: {
          type: 'STRING',
          description: 'The title, partial keyword, or ID of the task to complete',
        },
        listName: {
          type: 'STRING',
          description: 'Optional list name to narrow down the search',
        },
      },
      required: ['taskTitleOrId'],
    },
  },
  {
    name: 'create_list',
    description: 'Creates a new task list category',
    parameters: {
      type: 'OBJECT',
      properties: {
        listName: {
          type: 'STRING',
          description: 'The name of the new list to create (e.g. "Shopping", "Travel", "Projects")',
        },
      },
      required: ['listName'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Retrieves current active or completed tasks',
    parameters: {
      type: 'OBJECT',
      properties: {
        listName: {
          type: 'STRING',
          description: 'Optional list name to filter by',
        },
        showCompleted: {
          type: 'BOOLEAN',
          description: 'Whether to include completed tasks',
        },
      },
    },
  },
];
