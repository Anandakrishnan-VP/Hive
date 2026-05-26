"use client";

import React, { useEffect, useRef } from "react";
import { AgentEvent } from "../hooks/useAgentSocket";

interface AgentTerminalProps {
  events: AgentEvent[];
}

export function AgentTerminal({ events }: AgentTerminalProps) {
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const renderEventContent = (event: AgentEvent, idx: number) => {
    const timeStr = event.timestamp
      ? new Date(event.timestamp).toLocaleTimeString()
      : new Date().toLocaleTimeString();

    switch (event.type) {
      case "agent_start":
        return (
          <div key={idx} className="text-slate-400">
            <span className="text-indigo-400 font-semibold font-mono">[{timeStr}] [{event.agent.toUpperCase()}]</span>{" "}
            {event.data?.message || "Starting agent process..."}
          </div>
        );

      case "tool_call": {
        const toolName = event.data?.tool || "Unknown Tool";
        const argsStr = JSON.stringify(event.data?.args || {}, null, 2);
        return (
          <div key={idx} className="pl-4 border-l border-amber-600/50 my-1">
            <div className="text-amber-400 font-mono">
              <span className="text-slate-500 font-mono">[{timeStr}]</span> 🔧 calling tool: <span className="font-semibold underline">{toolName}</span>
            </div>
            {event.data?.args?.code && (
              <pre className="mt-1 bg-slate-900/80 p-2 rounded border border-slate-800 text-xs text-indigo-300 font-mono overflow-x-auto max-h-48">
                <code>{event.data.args.code}</code>
              </pre>
            )}
            {!event.data?.args?.code && Object.keys(event.data?.args || {}).length > 0 && (
              <pre className="mt-1 bg-slate-900/40 p-1.5 rounded text-[11px] text-slate-400 font-mono">
                {argsStr}
              </pre>
            )}
          </div>
        );
      }

      case "tool_result": {
        const toolName = event.data?.tool || "Unknown Tool";
        let resultStr = event.data?.result || "";
        
        // If result is large, truncate it
        if (typeof resultStr === "object") {
          resultStr = JSON.stringify(resultStr, null, 2);
        }
        const truncatedResult = resultStr.length > 500 ? resultStr.slice(0, 500) + "\n...[truncated]" : resultStr;
        
        return (
          <div key={idx} className="pl-4 border-l border-emerald-600/50 my-1">
            <div className="text-emerald-400 font-mono">
              <span className="text-slate-500 font-mono">[{timeStr}]</span> 📥 result from <span className="font-semibold underline">{toolName}</span>:
            </div>
            <pre className="mt-1 bg-slate-900/60 p-2 rounded border border-slate-800/50 text-xs text-emerald-300/90 font-mono overflow-x-auto max-h-48 whitespace-pre-wrap">
              {truncatedResult}
            </pre>
          </div>
        );
      }

      case "agent_end": {
        // If writer finishes, we don't dump the entire markdown in the terminal logs
        const isWriter = event.agent === "writer";
        const outputText = typeof event.data?.output === "string" ? event.data.output : JSON.stringify(event.data?.output || "");
        const preview = isWriter 
          ? "[Markdown generated successfully. Review preview in the draft tab.]"
          : outputText.length > 300 ? outputText.slice(0, 300) + "..." : outputText;

        return (
          <div key={idx} className="text-slate-300 font-mono mt-1 mb-2">
            <span className="text-indigo-400 font-semibold font-mono">[{timeStr}] [{event.agent.toUpperCase()}]</span> completed step. Output:
            <div className="mt-1 bg-slate-900/90 p-2 rounded border border-slate-800 text-slate-400 whitespace-pre-wrap text-xs">
              {preview}
            </div>
          </div>
        );
      }

      case "complete":
        return (
          <div key={idx} className="text-emerald-400 font-semibold font-mono border-t border-emerald-900/40 pt-2 mt-2">
            🚀 [{timeStr}] WORKFLOW FULLY COMPLETED. Steps run: {event.step}
          </div>
        );

      case "error":
        return (
          <div key={idx} className="text-rose-400 font-semibold font-mono border-t border-rose-900/40 pt-2 mt-2">
            🚨 [{timeStr}] WORKFLOW FAILED: {event.data?.message || "Internal agent error"}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[420px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 select-none">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="ml-2.5 text-xs text-slate-400 font-semibold font-mono">hive-agent-orchestrator@stream</span>
        </div>
        <div className="text-[10px] text-indigo-400/80 font-mono font-semibold animate-pulse">
          LIVE FEED
        </div>
      </div>

      {/* Terminal Logs Area */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
        {events.length === 0 ? (
          <div className="text-slate-500 italic h-full flex items-center justify-center font-sans">
            Terminal idle. Start a run to begin receiving execution logs.
          </div>
        ) : (
          events.map((event, idx) => renderEventContent(event, idx))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
