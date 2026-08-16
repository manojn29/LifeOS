'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Calendar, Trash2, Edit3, Check, Eye, EyeOff, BookOpen, Clock } from 'lucide-react';
import { JournalEntry } from '@/types/database';
import { localStore } from '@/lib/cache/local-store';

export default function JournalPage() {
  const [rawText, setRawText] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showCleanedMap, setShowCleanedMap] = useState<Record<string, boolean>>({});
  const [taskNotice, setTaskNotice] = useState<string | null>(null);

  useEffect(() => {
    // 1. Instant 0ms render from local device cache
    const cached = localStore.getJournal('current');
    if (cached && cached.length > 0) {
      setEntries(cached);
    } else {
      setIsLoading(true);
    }

    // 2. Background Sync (Stale-While-Revalidate)
    fetchEntries();
  }, []);

  async function fetchEntries() {
    try {
      const res = await fetch('/api/journal');
      const data = await res.json();
      if (data.entries && Array.isArray(data.entries)) {
        setEntries(data.entries);
        localStore.setJournal('current', data.entries);
      }
    } catch (err) {
      console.error('Failed to load journal entries from network:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!rawText.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawText.trim() }),
      });
      const data = await res.json();
      if (data.entry) {
        const updated = [data.entry, ...entries];
        setEntries(updated);
        localStore.setJournal('current', updated);
        setRawText('');

        if (data.autoCreatedTasks && data.autoCreatedTasks.length > 0) {
          const names = data.autoCreatedTasks
            .map((t: any) => `"${t.title}" → ${t.listName}`)
            .join(', ');
          setTaskNotice(`✓ Automatically added task: ${names}`);
          setTimeout(() => setTaskNotice(null), 6000);
        }
      }
    } catch (err) {
      console.error('Failed to save journal entry:', err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editText.trim()) return;
    try {
      const res = await fetch(`/api/journal/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: editText.trim() }),
      });
      const data = await res.json();
      if (data.entry) {
        const updated = entries.map((e) => (e.id === id ? data.entry : e));
        setEntries(updated);
        localStore.setJournal('current', updated);
        setEditingId(null);
      }
    } catch (err) {
      console.error('Failed to update journal entry:', err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this journal entry?')) return;
    try {
      const res = await fetch(`/api/journal/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const updated = entries.filter((e) => e.id !== id);
        setEntries(updated);
        localStore.setJournal('current', updated);
      }
    } catch (err) {
      console.error('Failed to delete journal entry:', err);
    }
  }

  const toggleCleanedView = (id: string) => {
    setShowCleanedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-400" />
          Journal
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Write freely. Your raw words remain the source of truth, while AI polishes grammar and indexes memories.
        </p>
      </div>

      {/* Task Auto-Creation Banner */}
      {taskNotice && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-sm font-medium flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 shadow-lg shadow-emerald-950/40">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{taskNotice}</span>
        </div>
      )}

      {/* Editor Card */}
      <div className="glass-panel rounded-2xl p-5 md:p-6 mb-12 shadow-xl relative focus-within:border-emerald-500/50 transition-all">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-3 font-mono">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
            {new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span>{wordCount} words</span>
        </div>

        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="What's on your mind today? Write anything — thoughts, goals, reflections, worries..."
          rows={6}
          className="w-full bg-transparent border-0 text-zinc-100 placeholder-zinc-500 focus:outline-none journal-textarea text-base md:text-lg"
        />

        <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80 mt-2">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auto-cleans spelling & embeds on save</span>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || !rawText.trim()}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              rawText.trim() && !isSaving
                ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-lg shadow-emerald-950/40 cursor-pointer'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                <span>AI Cleaning...</span>
              </>
            ) : (
              <>
                <span>Save Entry</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Previous Entries Section */}
      <div className="space-y-6">
        <h2 className="text-lg font-medium text-zinc-200 flex items-center justify-between">
          <span>Previous Entries</span>
          <span className="text-xs text-zinc-400 font-mono bg-zinc-900 px-2.5 py-1 rounded-full border border-zinc-800">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-zinc-500 text-sm animate-pulse">
            Loading your memories...
          </div>
        ) : entries.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-zinc-500">
            <p className="text-sm">No journal entries yet.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Start writing above to build your private AI-accessible memory.
            </p>
          </div>
        ) : (
          entries.map((entry) => {
            const isEditing = editingId === entry.id;
            const showCleaned = showCleanedMap[entry.id] ?? true; // defaults to cleaned view

            return (
              <div
                key={entry.id}
                className="glass-panel rounded-2xl p-5 md:p-6 transition-all hover:border-zinc-700/80 group"
              >
                <div className="flex items-center justify-between mb-3 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400/80" />
                    <span>
                      {new Date(entry.entry_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle Raw vs Cleaned version */}
                    <button
                      onClick={() => toggleCleanedView(entry.id)}
                      className="px-2 py-1 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 flex items-center gap-1.5 cursor-pointer"
                      title="Switch between AI-Cleaned and Raw truth"
                    >
                      {showCleaned ? (
                        <>
                          <Eye className="w-3 h-3 text-emerald-400" />
                          <span className="font-mono text-[10px] text-emerald-400">Cleaned</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3 text-amber-400" />
                          <span className="font-mono text-[10px] text-amber-400">Raw</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setEditingId(entry.id);
                        setEditText(entry.raw_text);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                      title="Edit Entry"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-3 mt-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={4}
                      className="w-full bg-zinc-900/90 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:outline-none focus:border-emerald-500 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdate(entry.id)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-emerald-500 text-zinc-950 font-medium hover:bg-emerald-400 flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save & Re-clean</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm md:text-base text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {showCleaned ? entry.cleaned_text : entry.raw_text}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
