export interface ExtractedTask {
  title: string;
  listName: string;
  dueDate?: string;
  notes?: string;
}

export function extractTasksFromJournalText(
  text: string,
  availableLists: { id: string; title: string }[]
): ExtractedTask[] {
  const extracted: ExtractedTask[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const cleanLine = line.replace(/^[•\-\*]\s+/, '').trim();
    const lower = cleanLine.toLowerCase();

    // Pattern 1: "Add / And <task> to <list> list" (or "in <list>")
    const addToListMatch = cleanLine.match(/^(?:add|and|create task)\s+(.+?)\s+(?:to|in|for)\s+(?:the\s+)?(.+?)(?:\s+list)?$/i);
    if (addToListMatch) {
      let taskTitle = addToListMatch[1].replace(/^["']|["']$/g, '').trim();
      let targetList = addToListMatch[2].replace(/^["']|["']$/g, '').trim();

      // Capitalize list title nicely (e.g. "journal app" -> "Journal app")
      targetList = targetList.charAt(0).toUpperCase() + targetList.slice(1);

      if (taskTitle && targetList) {
        extracted.push({
          title: taskTitle,
          listName: targetList,
        });
        continue;
      }
    }

    // Pattern 2: "Remind me to <task> [tomorrow/tonight/on Friday]"
    const remindMatch = cleanLine.match(/^remind me to\s+(.+)$/i);
    if (remindMatch) {
      let fullAction = remindMatch[1].trim();
      let dueDate: string | undefined = undefined;

      if (/\btomorrow\b/i.test(fullAction)) {
        dueDate = 'Tomorrow';
        fullAction = fullAction.replace(/\btomorrow\b/i, '').trim();
      } else if (/\btonight\b/i.test(fullAction)) {
        dueDate = 'Tonight';
        fullAction = fullAction.replace(/\btonight\b/i, '').trim();
      }

      extracted.push({
        title: fullAction.charAt(0).toUpperCase() + fullAction.slice(1),
        listName: 'Personal',
        dueDate,
      });
      continue;
    }

    // Pattern 3: Explicit "Todo: <task>" or "Task: <task>"
    const todoMatch = cleanLine.match(/^(?:todo|task|action):\s*(.+)$/i);
    if (todoMatch) {
      extracted.push({
        title: todoMatch[1].trim(),
        listName: 'Personal',
      });
      continue;
    }
  }

  return extracted;
}
