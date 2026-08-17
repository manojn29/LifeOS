'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content text-sm leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base md:text-lg font-bold text-zinc-100 mt-4 mb-2 pb-1 border-b border-zinc-800/80 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm md:text-base font-semibold text-zinc-100 mt-3 mb-1.5 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs md:text-sm font-semibold text-emerald-400 mt-2.5 mb-1 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0 leading-relaxed text-zinc-200">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 mb-2.5 space-y-1 text-zinc-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 mb-2.5 space-y-1 text-zinc-200">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed text-zinc-200 pl-0.5">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-100">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-zinc-300">{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-emerald-500 pl-3 py-1 my-2 italic text-zinc-300 bg-emerald-950/20 rounded-r">
              {children}
            </blockquote>
          ),
          code: ({ node, className, children, ...props }: any) => {
            const isInline = !className && !props.inline;
            return (
              <code
                className={
                  isInline
                    ? 'font-mono text-[11px] bg-zinc-900 border border-zinc-800 text-emerald-300 px-1.5 py-0.5 rounded'
                    : 'font-mono text-xs text-emerald-300'
                }
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="p-3.5 rounded-xl bg-zinc-950/90 border border-zinc-800 font-mono text-xs my-3 overflow-x-auto text-emerald-300">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border-collapse text-xs border border-zinc-800 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-zinc-900/90 px-3 py-2 text-left font-semibold text-zinc-200 border-b border-zinc-800">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-zinc-800/60 text-zinc-300 bg-zinc-900/40">
              {children}
            </td>
          ),
          hr: () => <hr className="my-4 border-zinc-800/80" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
