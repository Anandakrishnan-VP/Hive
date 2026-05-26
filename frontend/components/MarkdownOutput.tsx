"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

interface MarkdownOutputProps {
  content: string;
}

export function MarkdownOutput({ content }: MarkdownOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] border border-dashed border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 font-sans">
        <p className="text-sm">No report draft has been generated yet.</p>
        <p className="text-xs text-slate-600 mt-1">Once the Writer agent completes its step, the output will appear here.</p>
      </div>
    );
  }

  return (
    <div className="relative border border-slate-800 rounded-xl bg-slate-950/80 shadow-2xl overflow-hidden flex flex-col h-[500px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 select-none">
        <span className="text-xs text-slate-400 font-semibold font-mono">REPORT DRAFT PREVIEW (.md)</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 rounded transition-all"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Markdown</span>
            </>
          )}
        </button>
      </div>

      {/* Markdown Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800 text-slate-300 font-sans leading-relaxed text-sm prose prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || "");
              return !inline && match ? (
                <div className="my-4 rounded-lg overflow-hidden border border-slate-800">
                  <div className="bg-slate-900 px-4 py-1.5 border-b border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between">
                    <span>{match[1].toUpperCase()}</span>
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus as any}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: "12px", background: "#020617" }}
                    {...props}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className="bg-slate-900 border border-slate-800 text-indigo-400 px-1.5 py-0.5 rounded font-mono text-xs" {...props}>
                  {children}
                </code>
              );
            },
            h1: ({ children }) => <h1 className="text-xl font-bold text-white border-b border-slate-800 pb-2 mb-4 mt-6">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-semibold text-slate-100 mb-3 mt-5">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-semibold text-slate-200 mb-2 mt-4">{children}</h3>,
            ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="text-slate-300">{children}</li>,
            p: ({ children }) => <p className="mb-4 text-slate-300">{children}</p>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 italic bg-indigo-950/20 text-slate-400 my-4 rounded-r">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-4 rounded-lg border border-slate-800">
                <table className="min-w-full divide-y divide-slate-800 font-sans text-xs">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-slate-900">{children}</thead>,
            tbody: ({ children }) => <tbody className="divide-y divide-slate-800 bg-slate-950/40">{children}</tbody>,
            tr: ({ children }) => <tr>{children}</tr>,
            th: ({ children }) => <th className="px-4 py-2 text-left font-semibold text-slate-300">{children}</th>,
            td: ({ children }) => <td className="px-4 py-2 text-slate-400">{children}</td>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
