'use client';

import { useState, useEffect } from 'react';
import { Plus, Check, Trash2, Calendar, FolderPlus, ListTodo, MoreVertical, Clock } from 'lucide-react';
import { TaskList, Task } from '@/types/database';

export default function TasksPage() {
  const [lists, setLists] = useState<TaskList[]>([]);
  const [activeListId, setActiveListId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchLists();
  }, []);

  useEffect(() => {
    if (activeListId) {
      fetchTasks(activeListId);
    }
  }, [activeListId]);

  async function fetchLists() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tasks/lists');
      const data = await res.json();
      if (data.lists && data.lists.length > 0) {
        setLists(data.lists);
        if (!activeListId) {
          const defaultList = data.lists.find((l: TaskList) => l.is_default) || data.lists[0];
          setActiveListId(defaultList.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchTasks(listId: string) {
    try {
      const res = await fetch(`/api/tasks?listId=${listId}`);
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeListId) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId: activeListId,
          title: newTaskTitle.trim(),
          notes: newTaskNotes.trim() || undefined,
          dueDate: newTaskDueDate.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks([data.task, ...tasks]);
        setNewTaskTitle('');
        setNewTaskNotes('');
        setNewTaskDueDate('');
        setShowNotesInput(false);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  }

  async function handleToggleComplete(task: Task) {
    const updatedStatus = !task.is_completed;
    // Optimistic UI update
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, is_completed: updatedStatus } : t)));

    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: updatedStatus }),
      });
    } catch (err) {
      console.error('Failed to toggle task:', err);
      // Revert on error
      fetchTasks(activeListId);
    }
  }

  async function handleDeleteTask(taskId: string) {
    setTasks(tasks.filter((t) => t.id !== taskId));
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete task:', err);
      fetchTasks(activeListId);
    }
  }

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await fetch('/api/tasks/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newListName.trim() }),
      });
      const data = await res.json();
      if (data.list) {
        setLists([...lists, data.list]);
        setActiveListId(data.list.id);
        setNewListName('');
        setIsAddingList(false);
      }
    } catch (err) {
      console.error('Failed to create list:', err);
    }
  }

  const activeTasks = tasks.filter((t) => !t.is_completed);
  const completedTasks = tasks.filter((t) => t.is_completed);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
          <ListTodo className="w-6 h-6 text-emerald-400" />
          Tasks
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Distraction-free task management with multi-list support and AI integration.
        </p>
      </div>

      {/* List Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        {lists.map((list) => {
          const isActive = list.id === activeListId;
          return (
            <button
              key={list.id}
              onClick={() => setActiveListId(list.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 hover:bg-zinc-800/40'
              }`}
            >
              {list.title}
            </button>
          );
        })}

        {isAddingList ? (
          <form onSubmit={handleCreateList} className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              placeholder="List name..."
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="bg-zinc-900 border border-emerald-500/50 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none w-32"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 rounded-xl text-xs bg-emerald-500 text-zinc-950 font-semibold cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAddingList(false)}
              className="px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingList(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 border border-dashed border-zinc-800 hover:border-zinc-700 whitespace-nowrap cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New List</span>
          </button>
        )}
      </div>

      {/* Task Input Box (Google Tasks style) */}
      <form onSubmit={handleCreateTask} className="glass-panel rounded-2xl p-4 mb-8 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-zinc-700 flex items-center justify-center text-transparent" />
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a task (e.g. 'Apply to Meta', 'Call Mom')..."
            className="flex-1 bg-transparent border-0 text-zinc-100 placeholder-zinc-500 focus:outline-none text-base"
          />
          <button
            type="submit"
            disabled={!newTaskTitle.trim()}
            className={`p-2 rounded-xl transition-all ${
              newTaskTitle.trim()
                ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 cursor-pointer font-bold'
                : 'text-zinc-600 cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Optional Extra Fields toggle */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-zinc-800/60 text-xs text-zinc-400">
          <button
            type="button"
            onClick={() => setShowNotesInput(!showNotesInput)}
            className="hover:text-zinc-200 cursor-pointer"
          >
            {showNotesInput ? 'Hide details' : '+ Add details / notes'}
          </button>
        </div>

        {showNotesInput && (
          <div className="mt-3 space-y-2 pt-2 border-t border-zinc-800/40">
            <input
              type="text"
              placeholder="Notes or context..."
              value={newTaskNotes}
              onChange={(e) => setNewTaskNotes(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
            />
            <input
              type="text"
              placeholder="Due date (e.g. 'Tonight', 'Tomorrow', 'Friday')..."
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
            />
          </div>
        )}
      </form>

      {/* Active Tasks List */}
      <div className="space-y-2.5">
        {activeTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-zinc-500">
            <p className="text-sm">No tasks in this list.</p>
            <p className="text-xs text-zinc-600 mt-1">Add one above or ask LifeOS AI in Chat.</p>
          </div>
        ) : (
          activeTasks.map((task) => (
            <div
              key={task.id}
              className="glass-panel rounded-xl p-3.5 flex items-start gap-3 transition-all hover:border-zinc-700/80 group"
            >
              <button
                onClick={() => handleToggleComplete(task)}
                className="mt-0.5 w-5 h-5 rounded-full border-2 border-zinc-600 hover:border-emerald-400 flex items-center justify-center transition-colors cursor-pointer"
              />

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-100">{task.title}</div>
                {task.notes && <p className="text-xs text-zinc-400 mt-0.5">{task.notes}</p>}
                {task.due_date && (
                  <div className="flex items-center gap-1 text-[11px] text-amber-400/90 mt-1 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{task.due_date}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleDeleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                title="Delete task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}

        {/* Completed Tasks section */}
        {completedTasks.length > 0 && (
          <div className="pt-6">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 font-mono">
              Completed ({completedTasks.length})
            </h3>
            <div className="space-y-2 opacity-60">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="glass-panel rounded-xl p-3 flex items-center gap-3 line-through text-zinc-400 group"
                >
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className="w-5 h-5 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center cursor-pointer text-emerald-400"
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </button>
                  <span className="text-sm flex-1">{task.title}</span>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
