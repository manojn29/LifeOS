'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Calendar,
  Filter,
  RotateCcw,
  Clock,
  ArrowDown,
  BookOpen,
  Lightbulb,
  Globe,
  Pin,
  Trash2,
} from 'lucide-react';
import { AIReasoningMode, PinnedChat } from '@/types/database';
import { MarkdownRenderer } from '@/components/chat/markdown-renderer';
import { PinnedChatsDrawer } from '@/components/chat/pinned-chats-drawer';
import { VoiceRecorderButton } from '@/components/ui/voice-recorder-button';

interface Citation {
  id: string;
  date: string;
  preview: string;
  similarity: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: AIReasoningMode;
  citations?: Citation[];
  toolActions?: { tool: string; success: boolean; message: string }[];
  provider?: string;
  timestamp: string;
  createdAt?: string;
}

type SelectedMode = 'auto' | 'mode_1_journal_only' | 'mode_2_journal_general' | 'mode_3_journal_search';

const MODE_OPTIONS: {
  id: SelectedMode;
  label: string;
  shortLabel: string;
  desc: string;
  icon: any;
  badgeClass: string;
}[] = [
  {
    id: 'auto',
    label: 'Auto (Smart Detect)',
    shortLabel: 'Auto',
    desc: 'Automatically chooses the most relevant mode based on your query',
    icon: Sparkles,
    badgeClass: 'text-emerald-400 border-emerald-500/50 bg-emerald-950/70',
  },
  {
    id: 'mode_1_journal_only',
    label: 'Mode 1: Strict Journal Truth',
    shortLabel: 'Mode 1: Journal Only',
    desc: 'Strictly answers factually only from your saved journal entries',
    icon: BookOpen,
    badgeClass: 'text-emerald-400 border-emerald-500/50 bg-emerald-950/70',
  },
  {
    id: 'mode_2_journal_general',
    label: 'Mode 2: Journal + Knowledge',
    shortLabel: 'Mode 2: Advice & Ideas',
    desc: 'Combines your journal context with general reasoning, creative ideas, and frameworks',
    icon: Lightbulb,
    badgeClass: 'text-blue-400 border-blue-500/50 bg-blue-950/70',
  },
  {
    id: 'mode_3_journal_search',
    label: 'Mode 3: Journal + Search',
    shortLabel: 'Mode 3: Search',
    desc: 'Connects your journal context with external search and external world data',
    icon: Globe,
    badgeClass: 'text-purple-400 border-purple-500/50 bg-purple-950/70',
  },
];

const SAMPLE_PROMPTS = [
  'Summarize my week',
  'What goals have I mentioned?',
  'What patterns do you notice?',
  'What am I worried about?',
  'Remind me what I promised myself',
  'Add "Apply to Meta" to Work',
  'Remind me to call Mom tomorrow',
  'Create a Shopping list',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<SelectedMode>('auto');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});

  // Pinned Chats State
  const [pinnedChats, setPinnedChats] = useState<PinnedChat[]>([]);
  const [isPinnedDrawerOpen, setIsPinnedDrawerOpen] = useState(false);

  // Date Filter State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'single' | 'range'>('single');
  const [singleDate, setSingleDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeDateFilter, setActiveDateFilter] = useState<{
    startDate?: string;
    endDate?: string;
    label: string;
  } | null>(null);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initial Load: Fetch 10 most recent messages & pinned chats
  useEffect(() => {
    fetchChatHistory({ limit: 10, offset: 0 });
    fetchPinnedChats();
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!isLoadingMore && !isLoadingHistory) {
      scrollToBottom('smooth');
    }
  }, [messages.length, isSending]);

  async function fetchChatHistory(params: {
    limit: number;
    offset: number;
    startDate?: string;
    endDate?: string;
    append?: boolean;
  }) {
    if (params.append) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingHistory(true);
    }

    try {
      const url = new URL('/api/chat', window.location.origin);
      url.searchParams.set('limit', params.limit.toString());
      url.searchParams.set('offset', params.offset.toString());
      if (params.startDate) url.searchParams.set('startDate', params.startDate);
      if (params.endDate) url.searchParams.set('endDate', params.endDate);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (data.messages) {
        const mapped: Message[] = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          mode: m.reasoning_mode,
          toolActions: m.tool_results,
          timestamp: new Date(m.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          createdAt: m.created_at,
        }));

        if (params.append) {
          // Prepend older messages to top of current list
          setMessages((prev) => [...mapped, ...prev]);
        } else {
          // If fresh fetch has 0 messages and no active filter, show friendly welcome
          if (mapped.length === 0 && !params.startDate) {
            setMessages([
              {
                id: 'welcome',
                role: 'assistant',
                content:
                  'Hello! I am your LifeOS AI companion. I have access to your private journal entries and tasks.\n\nYou can ask me to recall memories, analyze life patterns, give advice, or directly manage your to-dos in natural language.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          } else {
            setMessages(mapped);
          }
        }

        setHasMore(data.hasMore || false);
        setTotalCount(data.totalCount || 0);
        setOffset(params.offset);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setIsLoadingHistory(false);
      setIsLoadingMore(false);
    }
  }

  // Load next 10 older messages
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    const nextOffset = offset + 10;
    await fetchChatHistory({
      limit: 10,
      offset: nextOffset,
      startDate: activeDateFilter?.startDate,
      endDate: activeDateFilter?.endDate,
      append: true,
    });
  };

  // Date Filter Apply handler
  const handleApplyDateFilter = () => {
    setDateRangeError(null);

    if (filterMode === 'single') {
      if (!singleDate) {
        setDateRangeError('Please pick a date.');
        return;
      }
      setActiveDateFilter({
        startDate: singleDate,
        endDate: singleDate,
        label: new Date(singleDate + 'T00:00:00').toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      });
      fetchChatHistory({
        limit: 10,
        offset: 0,
        startDate: singleDate,
        endDate: singleDate,
      });
      setIsFilterOpen(false);
    } else {
      if (!startDate || !endDate) {
        setDateRangeError('Please select both start and end dates.');
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        setDateRangeError('End date cannot be earlier than start date.');
        return;
      }

      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 7) {
        setDateRangeError('Maximum date range is 7 days.');
        return;
      }

      const label = `${start.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} – ${end.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;

      setActiveDateFilter({
        startDate,
        endDate,
        label,
      });
      fetchChatHistory({
        limit: 10,
        offset: 0,
        startDate,
        endDate,
      });
      setIsFilterOpen(false);
    }
  };

  const handleClearDateFilter = () => {
    setActiveDateFilter(null);
    setSingleDate('');
    setStartDate('');
    setEndDate('');
    setDateRangeError(null);
    setIsFilterOpen(false);
    fetchChatHistory({ limit: 10, offset: 0 });
  };

  async function fetchPinnedChats() {
    try {
      const res = await fetch('/api/chat/pins');
      const data = await res.json();
      if (data.pins && Array.isArray(data.pins)) {
        setPinnedChats(data.pins);
      }
    } catch (err) {
      console.error('Failed to load pinned chats:', err);
    }
  }

  const isMessagePinned = (msgId: string, content?: string) => {
    return pinnedChats.some(
      (p) => p.message_id === msgId || (content && p.response === content)
    );
  };

  const handleTogglePin = async (assistantMsg: Message) => {
    const existingPin = pinnedChats.find(
      (p) => p.message_id === assistantMsg.id || p.response === assistantMsg.content
    );

    if (existingPin) {
      // Optimistic unpin
      setPinnedChats((prev) => prev.filter((p) => p.id !== existingPin.id));
      try {
        await fetch(
          `/api/chat/pins?id=${existingPin.id}&messageId=${assistantMsg.id}`,
          { method: 'DELETE' }
        );
      } catch (err) {
        console.error('Failed to unpin:', err);
        fetchPinnedChats();
      }
    } else {
      // Find preceding user question
      const msgIndex = messages.findIndex((m) => m.id === assistantMsg.id);
      let question = 'Conversation';
      if (msgIndex > 0) {
        for (let i = msgIndex - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            question = messages[i].content;
            break;
          }
        }
      }

      // Optimistic pin
      const tempPin: PinnedChat = {
        id: crypto.randomUUID(),
        user_id: '',
        question,
        response: assistantMsg.content,
        mode: assistantMsg.mode,
        provider: assistantMsg.provider,
        message_id: assistantMsg.id,
        created_at: new Date().toISOString(),
      };
      setPinnedChats((prev) => [tempPin, ...prev]);

      try {
        const res = await fetch('/api/chat/pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            response: assistantMsg.content,
            mode: assistantMsg.mode,
            provider: assistantMsg.provider,
            messageId: assistantMsg.id,
          }),
        });
        const data = await res.json();
        if (data.pin) {
          setPinnedChats((prev) => [
            data.pin,
            ...prev.filter((p) => p.id !== tempPin.id),
          ]);
        }
      } catch (err) {
        console.error('Failed to save pin:', err);
        fetchPinnedChats();
      }
    }
  };

  const handleUnpinFromDrawer = async (pinId: string, messageId?: string | null) => {
    setPinnedChats((prev) => prev.filter((p) => p.id !== pinId));
    try {
      await fetch(
        `/api/chat/pins?id=${pinId}${messageId ? `&messageId=${messageId}` : ''}`,
        { method: 'DELETE' }
      );
    } catch (err) {
      console.error('Failed to unpin from drawer:', err);
      fetchPinnedChats();
    }
  };

  const handleDeleteExchange = async (msgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    const currentMsg = messages[msgIndex];
    const idsToDelete: string[] = [currentMsg.id];

    if (currentMsg.role === 'user') {
      // Look for the paired assistant message right after it
      if (messages[msgIndex + 1]?.role === 'assistant') {
        idsToDelete.push(messages[msgIndex + 1].id);
      }
    } else {
      // Look for the paired user question right before it
      if (messages[msgIndex - 1]?.role === 'user') {
        idsToDelete.push(messages[msgIndex - 1].id);
      }
    }

    // Optimistic removal from state
    setMessages((prev) => prev.filter((m) => !idsToDelete.includes(m.id)));
    // Also unpin if any of these were pinned
    setPinnedChats((prev) =>
      prev.filter((p) => !p.message_id || !idsToDelete.includes(p.message_id))
    );

    try {
      await fetch(`/api/chat?ids=${idsToDelete.join(',')}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete exchange:', err);
      fetchChatHistory({ limit: 10, offset: 0 });
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isSending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          reasoningMode: selectedMode === 'auto' ? undefined : selectedMode,
        }),
      });

      const data = await res.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || 'I processed your request.',
        mode: data.mode,
        citations: data.citations || [],
        toolActions: data.toolActions || [],
        provider: data.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat request failed:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, I encountered an error while processing your request. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const getModeBadge = (mode?: AIReasoningMode) => {
    if (!mode) return null;
    switch (mode) {
      case 'mode_1_journal_only':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            Mode 1: Journal Only (Strict Truth)
          </span>
        );
      case 'mode_2_journal_general':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-400 border border-blue-800/40">
            Mode 2: Journal + Model Reasoning
          </span>
        );
      case 'mode_3_journal_search':
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950/60 text-purple-400 border border-purple-800/40">
            Mode 3: Journal + Web Search
          </span>
        );
      default:
        return null;
    }
  };

  const toggleCitation = (msgId: string) => {
    setExpandedCitations((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-4.5rem)]">
      {/* Top Header & Filter Toolbar */}
      <div className="flex flex-col gap-3 pb-4 border-b border-zinc-800/80 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              AI Memory Assistant
            </h1>
            <p className="text-xs text-zinc-400">
              RAG Semantic Search & Natural Language Task Execution
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPinnedDrawerOpen(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                pinnedChats.length > 0
                  ? 'bg-amber-950/60 text-amber-300 border-amber-700/50 hover:bg-amber-900/60'
                  : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800'
              }`}
            >
              <Pin className={`w-3.5 h-3.5 ${pinnedChats.length > 0 ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>Pinned ({pinnedChats.length})</span>
            </button>

            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                activeDateFilter || isFilterOpen
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                  : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border-zinc-800'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{activeDateFilter ? activeDateFilter.label : 'Filter by Date'}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Date Filter Dropdown Panel */}
        {isFilterOpen && (
          <div className="glass-panel p-4 rounded-2xl border border-zinc-800 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterMode('single')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    filterMode === 'single'
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Specific Date
                </button>
                <button
                  onClick={() => setFilterMode('range')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    filterMode === 'range'
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Date Range (Max 7 Days)
                </button>
              </div>

              {activeDateFilter && (
                <button
                  onClick={handleClearDateFilter}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            {filterMode === 'single' ? (
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Select Date:</label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">From Date:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">To Date:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
            )}

            {dateRangeError && (
              <p className="text-xs text-rose-400 font-medium">{dateRangeError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsFilterOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs bg-zinc-900 hover:bg-zinc-850 text-zinc-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDateFilter}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 cursor-pointer"
              >
                Apply Filter
              </button>
            </div>
          </div>
        )}

        {/* Active Filter Indicator */}
        {activeDateFilter && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Showing conversations for <strong>{activeDateFilter.label}</strong> ({totalCount}{' '}
              {totalCount === 1 ? 'message' : 'messages'})
            </span>
            <button
              onClick={handleClearDateFilter}
              className="text-[11px] text-emerald-400 hover:text-emerald-200 underline cursor-pointer"
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>

      {/* Message Stream */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-1 mb-3">
        {/* Load 10 More Older Conversations Button */}
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-4 py-1.5 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-zinc-100 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {isLoadingMore ? (
                <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>
                {isLoadingMore ? 'Loading...' : `Load 10 older conversations (${messages.length} of ${totalCount})`}
              </span>
            </button>
          </div>
        )}

        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-xs gap-2">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading recent conversations...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs">
            No conversations found for the selected date.
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const hasCitations = msg.citations && msg.citations.length > 0;
            const isCitationExpanded = expandedCitations[msg.id];

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-emerald-500 text-zinc-950 font-medium shadow-md'
                      : 'glass-panel text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {/* Meta info & Pin header for AI response */}
                  {!isUser && (
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-zinc-800/50">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getModeBadge(msg.mode)}
                        {msg.provider && (
                          <span className="text-[10px] font-mono text-zinc-500 uppercase">
                            via {msg.provider}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(msg)}
                          title={
                            isMessagePinned(msg.id, msg.content)
                              ? 'Unpin this Q&A'
                              : 'Pin this Q&A'
                          }
                          className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1 ${
                            isMessagePinned(msg.id, msg.content)
                              ? 'bg-amber-950/70 border-amber-600/60 text-amber-300 shadow-sm'
                              : 'border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                          }`}
                        >
                          <Pin
                            className={`w-3 h-3 ${
                              isMessagePinned(msg.id, msg.content)
                                ? 'fill-amber-400 text-amber-400'
                                : ''
                            }`}
                          />
                          <span>
                            {isMessagePinned(msg.id, msg.content) ? 'Pinned' : 'Pin'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteExchange(msg.id)}
                          title="Delete question & response"
                          className="p-1 rounded-lg border border-transparent text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/80 hover:border-zinc-700/60 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tool Action Badges */}
                  {!isUser && msg.toolActions && msg.toolActions.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {msg.toolActions.map((action, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-mono"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span>{action.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Body */}
                  {isUser ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )}

                  {/* Retrieved Journal Citations Accordion */}
                  {!isUser && hasCitations && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/60">
                      <button
                        onClick={() => toggleCitation(msg.id)}
                        className="flex items-center justify-between w-full text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Layers className="w-3 h-3 text-emerald-400" />
                          {msg.citations!.length} Retrieved Journal Sources
                        </span>
                        {isCitationExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {isCitationExpanded && (
                        <div className="mt-2 space-y-2">
                          {msg.citations!.map((cit) => (
                            <div
                              key={cit.id}
                              className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-300"
                            >
                              <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono mb-1">
                                <span>{new Date(cit.date).toLocaleDateString()}</span>
                                <span className="text-emerald-400/90">{cit.similarity}% match</span>
                              </div>
                              <p className="line-clamp-2 text-zinc-300 italic">"{cit.preview}..."</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={`text-[10px] mt-1.5 flex items-center justify-between font-mono ${
                      isUser ? 'text-zinc-900/80' : 'text-zinc-500'
                    }`}
                  >
                    {isUser ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteExchange(msg.id)}
                        title="Delete question & response"
                        className="opacity-70 hover:opacity-100 p-0.5 rounded text-zinc-950 hover:text-rose-950 cursor-pointer transition-opacity flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="text-[10px]">Delete Q&A</span>
                      </button>
                    ) : (
                      <span />
                    )}
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 text-zinc-300 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isSending && (
          <div className="flex items-center gap-3 text-zinc-400 text-xs py-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Retrieving journal memories and reasoning...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Suggestions */}
      {messages.length < 3 && !isLoadingHistory && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
          {SAMPLE_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1.5 rounded-xl text-xs bg-zinc-900/80 hover:bg-zinc-850 text-zinc-300 hover:text-zinc-100 border border-zinc-800 whitespace-nowrap cursor-pointer transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* AI Reasoning Mode Selector Toolbar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-2 no-scrollbar text-xs">
        <span className="text-[11px] font-mono text-zinc-500 mr-1 flex items-center gap-1 flex-shrink-0">
          Mode:
        </span>
        {MODE_OPTIONS.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedMode === m.id;
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => setSelectedMode(m.id)}
              title={m.desc}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? `${m.badgeClass} shadow-md ring-1 ring-emerald-500/20`
                  : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'animate-pulse' : ''}`} />
              <span>{m.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="glass-panel rounded-2xl p-2 md:p-3 flex items-center gap-2 shadow-xl"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            selectedMode === 'mode_1_journal_only'
              ? 'Ask strictly about your journal memories...'
              : selectedMode === 'mode_2_journal_general'
              ? 'Ask for advice, ideas, and reflections based on your journal...'
              : selectedMode === 'mode_3_journal_search'
              ? 'Ask external questions connected to your journal...'
              : 'Ask your journal or tell AI to manage tasks...'
          }
          className="flex-1 bg-transparent border-0 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none text-sm md:text-base"
        />
        <VoiceRecorderButton
          buttonVariant="icon"
          onTranscribed={(text) => {
            setInput((prev) => (prev ? `${prev} ${text}` : text));
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className={`p-2.5 rounded-xl transition-all ${
            input.trim() && !isSending
              ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 cursor-pointer font-bold'
              : 'text-zinc-600 bg-zinc-900 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Pinned Conversations Drawer */}
      <PinnedChatsDrawer
        isOpen={isPinnedDrawerOpen}
        onClose={() => setIsPinnedDrawerOpen(false)}
        pinnedChats={pinnedChats}
        onUnpin={handleUnpinFromDrawer}
      />
    </div>
  );
}
