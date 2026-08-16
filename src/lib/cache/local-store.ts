import { JournalEntry, TaskList, Task, WeeklyDigest } from '@/types/database';

export const localStore = {
  // JOURNAL CACHE
  getJournal(userId: string): JournalEntry[] | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(`lifeos_journal_${userId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setJournal(userId: string, entries: JournalEntry[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`lifeos_journal_${userId}`, JSON.stringify(entries));
    } catch (err) {
      console.warn('LocalStorage write error:', err);
    }
  },

  // TASKS CACHE
  getTasksData(userId: string): { lists: TaskList[]; tasks: Task[] } | null {
    if (typeof window === 'undefined') return null;
    try {
      const lists = localStorage.getItem(`lifeos_task_lists_${userId}`);
      const tasks = localStorage.getItem(`lifeos_tasks_${userId}`);
      if (lists || tasks) {
        return {
          lists: lists ? JSON.parse(lists) : [],
          tasks: tasks ? JSON.parse(tasks) : [],
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  setTasksData(userId: string, lists: TaskList[], tasks: Task[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`lifeos_task_lists_${userId}`, JSON.stringify(lists));
      localStorage.setItem(`lifeos_tasks_${userId}`, JSON.stringify(tasks));
    } catch (err) {
      console.warn('LocalStorage write error:', err);
    }
  },

  // WEEKLY DIGEST CACHE
  getDigests(userId: string): WeeklyDigest[] | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(`lifeos_digests_${userId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setDigests(userId: string, digests: WeeklyDigest[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`lifeos_digests_${userId}`, JSON.stringify(digests));
    } catch (err) {
      console.warn('LocalStorage write error:', err);
    }
  },
};
