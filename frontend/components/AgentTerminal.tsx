"use client";

import React, { useEffect, useRef } from "react";
import { AgentEvent } from "../hooks/useAgentSocket";
import { audioManager } from "../lib/audio";
import { Terminal, ShieldCheck, AlertOctagon, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AgentTerminalProps {
  events: AgentEvent[];
}

export function AgentTerminal({ events }: AgentTerminalProps) {
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const prevEventsLength = useRef(0);

  // Play audio triggers on new incoming stream events
  useEffect(() => {
    if (events.length > prevEventsLength.current) {
      const latestEvent = events[events.length - 1];
      if (latestEvent) {
        if (latestEvent.type === "error") {
          audioManager.playAlert();
        } else if (latestEvent.type === "complete") {
          audioManager.playSuccess();
        } else {
          audioManager.playDataTick();
        }
      }
    }
    prevEventsLength.current = events.length;
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const getAgentBadge = (agent: string) => {
    const config: Record<string, { label: string; style: string }> = {
      supervisor: { label: "🤖 SUPERVISOR", style: "bg-kiwi/10 border-kiwi/25 text-kiwi" },
      researcher: { label: "🔍 RESEARCHER", style: "bg-tangy/10 border-tangy/25 text-tangy" },
      coder: { label: "💻 CODER", style: "bg-limeaccent/10 border-limeaccent/25 text-limeaccent" },
      writer: { label: "✍️ WRITER", style: "bg-kiwi/20 border-kiwi/40 text-kiwi" },
      critic: { label: "⚖️ CRITIC", style: "bg-tangy/20 border-tangy/40 text-tangy" },
    };
    const matched = config[agent.toLowerCase()] || { label: agent.toUpperCase(), style: "bg-slate-900 border-slate-700 text-slate-300" };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold font-mono border tracking-wider ${matched.style}`}>
        {matched.label}
      </span>
    );
  };

  const renderEventContent = (event: AgentEvent, idx: number) => {
    const timeStr = event.timestamp
      ? new Date(event.timestamp).toLocaleTimeString()
      : new Date().toLocaleTimeString();

    switch (event.type) {
      case "agent_start":
        return (
          <div key={idx} className="flex items-start gap-3 border-b border-slate-900/60 pb-2 mb-1">
            <span className="text-[10px] text-slate-600 font-mono flex-shrink-0 mt-0.5">[{timeStr}]</span>
            <div className="flex flex-col gap-1.5">
              <div>{getAgentBadge(event.agent)}</div>
              <div className="text-slate-400 text-xs font-mono">
                {event.data?.message || "Initiating task cycle..."}
              </div>
            </div>
          </div>
        );

      case "tool_call": {
        const toolName = event.data?.tool || "Unknown Tool";
        const argsStr = JSON.stringify(event.data?.args || {}, null, 2);
        return (
          <div key={idx} className="pl-4 border-l-2 border-amber-500/40 my-3 flex flex-col gap-2">
            <div className="text-amber-400 font-mono text-xs flex items-center gap-2">
              <span className="text-slate-600 font-mono text-[10px]">[{timeStr}]</span> 
              <span className="text-amber-500">🔧 CALLING TOOL:</span> 
              <span className="font-semibold underline tracking-widest">{toolName}</span>
            </div>
            {event.data?.args?.code && (
              <pre className="mt-0.5 bg-black p-3 rounded-lg border border-slate-900 text-xs text-kiwi/90 font-mono overflow-x-auto max-h-48 shadow-inner">
                <code>{event.data.args.code}</code>
              </pre>
            )}
            {!event.data?.args?.code && Object.keys(event.data?.args || {}).length > 0 && (
              <pre className="mt-0.5 bg-black/50 p-2 rounded-lg text-[10px] text-slate-500 font-mono border border-slate-900">
                {argsStr}
              </pre>
            )}
          </div>
        );
      }

      case "tool_result": {
        const toolName = event.data?.tool || "Unknown Tool";
        let resultStr = event.data?.result || "";
        
        if (typeof resultStr === "object") {
          resultStr = JSON.stringify(resultStr, null, 2);
        }
        
        const isError = resultStr.includes("failure") || resultStr.includes("Error") || resultStr.includes("failed");
        const truncatedResult = resultStr.length > 500 ? resultStr.slice(0, 500) + "\n...[truncated]" : resultStr;
        
        return (
          <div key={idx} className={`pl-4 border-l-2 my-3 flex flex-col gap-2 ${isError ? "border-rose-500/40" : "border-emerald-500/40"}`}>
            <div className={`font-mono text-xs flex items-center gap-2 ${isError ? "text-rose-400" : "text-emerald-400"}`}>
              <span className="text-slate-600 font-mono text-[10px]">[{timeStr}]</span> 
              <span>📥 RESULT FROM:</span> 
              <span className="font-semibold underline tracking-widest">{toolName}</span>
              {isError && <Badge variant="outline" className="text-[8px] bg-rose-950/20 border-rose-500/20 text-rose-400 font-bold px-1.5 py-0">WARNING</Badge>}
            </div>
            <pre className={`mt-0.5 p-3 rounded-lg border text-xs font-mono overflow-x-auto max-h-48 shadow-inner whitespace-pre-wrap ${
              isError 
                ? "bg-rose-950/5 border-rose-900/30 text-rose-300" 
                : "bg-black border-slate-900 text-emerald-300/90"
            }`}>
              {truncatedResult}
            </pre>
          </div>
        );
      }

      case "agent_end": {
        const isWriter = event.agent === "writer";
        const outputText = typeof event.data?.output === "string" ? event.data.output : JSON.stringify(event.data?.output || "");
        const preview = isWriter 
          ? "[Markdown generated successfully. Review preview in the draft tab.]"
          : outputText.length > 300 ? outputText.slice(0, 300) + "..." : outputText;

        return (
          <div key={idx} className="flex flex-col gap-1.5 border-b border-slate-900/60 pb-3 mb-1 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 font-mono">[{timeStr}]</span>
              {getAgentBadge(event.agent)}
              <span className="text-slate-400 text-xs font-mono font-semibold">COMPLETED ITERATION</span>
            </div>
            <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900 text-slate-400 whitespace-pre-wrap text-xs font-mono shadow-md">
              {preview}
            </div>
          </div>
        );
      }

      case "complete":
        return (
          <div key={idx} className="flex items-center gap-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 mt-4 shadow-xl shadow-emerald-950/10">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 animate-pulse" />
            <div className="font-mono text-xs text-emerald-400">
              <div className="font-bold tracking-widest text-[10px] uppercase">Synapse Complete</div>
              <div className="mt-0.5 text-emerald-500/90">[{timeStr}] WORKFLOW FULLY COMPLETED. Steps run: {event.step}</div>
            </div>
          </div>
        );

      case "error":
        return (
          <div key={idx} className="flex items-center gap-3 bg-rose-950/20 border border-rose-500/20 rounded-xl p-4 mt-4 shadow-xl shadow-rose-950/10">
            <AlertOctagon className="w-5 h-5 text-rose-400 flex-shrink-0 animate-bounce" />
            <div className="font-mono text-xs text-rose-400">
              <div className="font-bold tracking-widest text-[10px] uppercase">Synapse Terminated</div>
              <div className="mt-0.5 text-rose-500/90">[{timeStr}] PIPELINE FAILED: {event.data?.message || "Internal compiler exception"}</div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[460px] bg-black border border-slate-300 dark:border-kiwi/15 rounded-xl overflow-hidden shadow-2xl relative">
      <div className="dark flex flex-col h-full w-full">
        {/* Terminal Title Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-950 select-none">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="ml-2.5 text-xs text-slate-400 font-semibold font-mono tracking-wider">hive-core@terminal:~</span>
          </div>
          <div className="text-[9px] text-kiwi font-mono font-bold tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-kiwi animate-ping" />
            STREAMING DATA
          </div>
        </div>

        {/* Terminal Logs Area */}
        <div className="flex-1 overflow-y-auto p-5 font-mono text-xs leading-relaxed space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
          {events.length === 0 ? (
            <div className="text-slate-600 italic h-full flex flex-col gap-2 items-center justify-center font-mono select-none">
              <Terminal className="w-7 h-7 text-slate-700 animate-pulse" />
              <span>CONSOLE IDLE. DEPLOY PROMPT TO STREAM EVENTS</span>
            </div>
          ) : (
            events.map((event, idx) => renderEventContent(event, idx))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}

