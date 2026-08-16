'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Trophy,
  Lightbulb,
  Target,
  Calendar,
  Smile,
  ChevronRight,
  Clock,
  RotateCcw,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { WeeklyDigest } from '@/types/database';

export default function DigestPage() {
  const [digests, setDigests] = useState<WeeklyDigest[]>([]);
  const [selectedDigest, setSelectedDigest] = useState<WeeklyDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Custom date range inputs (defaults to previous 7 days)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Set default dates
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);

    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);

    fetchDigests();
  }, []);

  async function fetchDigests() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/digest');
      const data = await res.json();
      if (data.digests && Array.isArray(data.digests)) {
        setDigests(data.digests);
        if (data.digests.length > 0) {
          setSelectedDigest(data.digests[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load digests:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerateDigest() {
    setErrorMsg(null);
    if (!startDate || !endDate) {
      setErrorMsg('Please select a valid start and end date.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg('End date cannot be earlier than start date.');
      return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });

      const data = await res.json();
      if (data.digest) {
        setDigests((prev) => [data.digest, ...prev.filter((d) => d.id !== data.digest.id)]);
        setSelectedDigest(data.digest);
      } else if (data.error) {
        setErrorMsg(data.error);
      }
    } catch (err: any) {
      console.error('Failed to generate weekly digest:', err);
      setErrorMsg(err.message || 'Failed to synthesize weekly digest.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-400" />
            Weekly AI Digest
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Holistic reflections, accomplishments, and actionable guidance synthesized from your journal.
          </p>
        </div>
      </div>

      {/* Generator Control Card */}
      <div className="glass-panel rounded-2xl p-5 md:p-6 shadow-xl border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Generate Review for Timeframe
          </h2>
          <span className="text-[11px] font-mono text-zinc-500">Past 7 Days (Default)</span>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-zinc-400 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 flex-1 md:w-40"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-zinc-400 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 flex-1 md:w-40"
            />
          </div>

          <button
            onClick={handleGenerateDigest}
            disabled={isGenerating}
            className="w-full md:w-auto md:ml-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                <span>Synthesizing Memories...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Weekly Review</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-400 font-medium pt-1">{errorMsg}</p>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-xs gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading weekly reviews...</span>
        </div>
      ) : digests.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-zinc-800/80 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200">No Weekly Reviews Yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Click <strong>"Generate Weekly Review"</strong> above to synthesize your recent journal entries into a structured life review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Active Digest View */}
          <div className="lg:col-span-2 space-y-6">
            {selectedDigest && (
              <>
                {/* Title & Summary Card */}
                <div className="glass-panel rounded-3xl p-6 md:p-8 border border-zinc-800/80 space-y-5 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-zinc-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      {new Date(selectedDigest.start_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      –{' '}
                      {new Date(selectedDigest.end_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>

                    {selectedDigest.mood_overview && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                        <Smile className="w-3.5 h-3.5 text-emerald-400" />
                        {selectedDigest.mood_overview}
                      </span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100">
                      {selectedDigest.title}
                    </h2>
                    <p className="text-sm text-zinc-300 leading-relaxed mt-3 whitespace-pre-wrap">
                      {selectedDigest.summary}
                    </p>
                  </div>
                </div>

                {/* Wins & Accomplishments */}
                {selectedDigest.wins && selectedDigest.wins.length > 0 && (
                  <div className="glass-panel rounded-2xl p-6 border border-zinc-800/80 space-y-3">
                    <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-emerald-400" />
                      Key Wins & Progress
                    </h3>
                    <ul className="space-y-2">
                      {selectedDigest.wins.map((win, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-200 leading-relaxed">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{win}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Core Themes & Reflections */}
                {selectedDigest.themes && selectedDigest.themes.length > 0 && (
                  <div className="glass-panel rounded-2xl p-6 border border-zinc-800/80 space-y-3">
                    <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-400" />
                      Themes & Mindset Patterns
                    </h3>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedDigest.themes.map((theme, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-xl bg-blue-950/40 border border-blue-800/50 text-blue-300 text-xs"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Focus for Next Week */}
                {selectedDigest.action_items && selectedDigest.action_items.length > 0 && (
                  <div className="glass-panel rounded-2xl p-6 border border-zinc-800/80 space-y-3">
                    <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-400" />
                      Suggested Focus for Next Week
                    </h3>
                    <ul className="space-y-2">
                      {selectedDigest.action_items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-200 leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Column: Digest Archive List */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 px-1">
              <Calendar className="w-4 h-4 text-zinc-400" />
              Past Weekly Digests ({digests.length})
            </h3>

            <div className="space-y-2.5">
              {digests.map((digest) => {
                const isSelected = selectedDigest?.id === digest.id;
                return (
                  <button
                    key={digest.id}
                    onClick={() => setSelectedDigest(digest)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                        : 'glass-panel border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1">
                      <span>
                        {new Date(digest.start_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        –{' '}
                        {new Date(digest.end_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {isSelected && <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <h4 className="text-xs font-semibold text-zinc-200 line-clamp-1">
                      {digest.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">
                      {digest.summary}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
