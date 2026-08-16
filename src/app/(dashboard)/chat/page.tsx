'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User, CheckCircle2, ChevronDown, ChevronUp, Layers, HelpCircle, ArrowRight } from 'lucide-react';
import { AIReasoningMode } from '@/types/database';

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
}

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your LifeOS AI companion. I have access to your private journal entries and tasks.\n\nYou can ask me to recall memories, analyze life patterns, give advice, or directly manage your to-dos in natural language.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

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
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            AI Memory Assistant
          </h1>
          <p className="text-xs text-zinc-400">RAG Semantic Search & Natural Language Task Execution</p>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {messages.map((msg) => {
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
                {/* Meta info header for AI response */}
                {!isUser && (msg.mode || msg.provider) && (
                  <div className="flex items-center gap-2 mb-2">
                    {getModeBadge(msg.mode)}
                    {msg.provider && (
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">
                        via {msg.provider}
                      </span>
                    )}
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
                <div className="whitespace-pre-wrap">{msg.content}</div>

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
                  className={`text-[10px] mt-1.5 text-right font-mono ${
                    isUser ? 'text-zinc-800/80' : 'text-zinc-500'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 text-zinc-300 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

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
      {messages.length < 3 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
          {SAMPLE_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1.5 rounded-xl text-xs bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800 whitespace-nowrap cursor-pointer transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

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
          placeholder="Ask your journal or tell AI to manage tasks..."
          className="flex-1 bg-transparent border-0 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none text-sm md:text-base"
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
    </div>
  );
}
