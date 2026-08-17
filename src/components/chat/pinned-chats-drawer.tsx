'use client';

import { useState } from 'react';
import { Pin, X, User, Bot, Copy, Check, Trash2, Calendar, Clock, Layers, Sparkles } from 'lucide-react';
import { PinnedChat } from '@/types/database';
import { MarkdownRenderer } from './markdown-renderer';

interface PinnedChatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pinnedChats: PinnedChat[];
  onUnpin: (pinId: string, messageId?: string | null) => Promise<void>;
}

export function PinnedChatsDrawer({
  isOpen,
  onClose,
  pinnedChats,
  onUnpin,
}: PinnedChatsDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (pin: PinnedChat) => {
    const text = `Q: ${pin.question}\n\nA:\n${pin.response}`;
    navigator.clipboard.writeText(text);
    setCopiedId(pin.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-xl bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-700/50 text-amber-400">
              <Pin className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                Pinned Conversations
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {pinnedChats.length}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Saved questions & answers for quick access.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 cursor-pointer transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {pinnedChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-950/30 border border-amber-700/40 flex items-center justify-center text-amber-400">
                <Pin className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200">No Pinned Chats Yet</h3>
              <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                Click the <strong>Pin</strong> icon on any AI response in chat to bookmark questions and answers here for quick reference.
              </p>
            </div>
          ) : (
            pinnedChats.map((pin) => (
              <div
                key={pin.id}
                className="glass-panel rounded-2xl border border-zinc-800/80 p-5 space-y-4 shadow-lg hover:border-zinc-700 transition-all group"
              >
                {/* Question Section */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 text-zinc-300 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                      Question
                    </span>
                    <p className="text-sm font-semibold text-zinc-100 leading-snug">
                      {pin.question}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-zinc-800/60" />

                {/* Response Section */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        Response {pin.provider ? `(via ${pin.provider})` : ''}
                      </span>

                      <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(pin)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === pin.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => onUnpin(pin.id, pin.message_id)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer transition-colors"
                          title="Unpin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-zinc-200">
                      <MarkdownRenderer content={pin.response} />
                    </div>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-2 border-t border-zinc-800/40">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {new Date(pin.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  {pin.mode && (
                    <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                      {pin.mode.replace('mode_', 'Mode ').replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
