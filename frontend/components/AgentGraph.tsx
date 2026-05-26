"use client";

import React from "react";
import { Terminal, Shield, Search, FileCode, CheckSquare, RefreshCw } from "lucide-react";

interface AgentGraphProps {
  currentAgent: string | null;
  status: "idle" | "running" | "complete" | "error";
}

interface NodeProps {
  id: string;
  label: string;
  x: number;
  y: number;
  active: boolean;
  icon: React.ReactNode;
}

export function AgentGraph({ currentAgent, status }: AgentGraphProps) {
  const nodes: NodeProps[] = [
    {
      id: "supervisor",
      label: "Supervisor",
      x: 250,
      y: 80,
      active: currentAgent === "supervisor",
      icon: <Shield className="w-5 h-5" />,
    },
    {
      id: "researcher",
      label: "Researcher",
      x: 100,
      y: 200,
      active: currentAgent === "researcher",
      icon: <Search className="w-4 h-4" />,
    },
    {
      id: "coder",
      label: "Coder",
      x: 200,
      y: 280,
      active: currentAgent === "coder",
      icon: <FileCode className="w-4 h-4" />,
    },
    {
      id: "writer",
      label: "Writer",
      x: 300,
      y: 280,
      active: currentAgent === "writer",
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      id: "critic",
      label: "Critic Gate",
      x: 400,
      y: 200,
      active: currentAgent === "critic",
      icon: <CheckSquare className="w-4 h-4" />,
    },
  ];

  // Helper to determine edge lines between nodes
  const getLineStyle = (fromNodeId: string, toNodeId: string) => {
    const isFlowing =
      (currentAgent === fromNodeId && status === "running") ||
      (currentAgent === toNodeId && status === "running");
    return {
      stroke: isFlowing ? "#90f13b" : "#374151",
      strokeWidth: isFlowing ? 2.5 : 1.5,
      strokeDasharray: isFlowing ? "5, 5" : "none",
      className: isFlowing ? "animate-[dash_1s_linear_infinite]" : "",
    };
  };

  return (
    <div className="relative w-full h-[360px] bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* SVG Canvas for Connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#90f13b" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#90f13b" stopOpacity="0" />
          </radialGradient>
          <style>{`
            @keyframes dash {
              to {
                stroke-dashoffset: -20;
              }
            }
          `}</style>
        </defs>

        {/* Connections from Supervisor to Workers */}
        <line x1={250} y1={80} x2={100} y2={200} {...getLineStyle("supervisor", "researcher")} />
        <line x1={250} y1={80} x2={200} y2={280} {...getLineStyle("supervisor", "coder")} />
        <line x1={250} y1={80} x2={300} y2={280} {...getLineStyle("supervisor", "writer")} />
        <line x1={250} y1={80} x2={400} y2={200} {...getLineStyle("supervisor", "critic")} />

        {/* Connection from Critic to Writer (loop edge) */}
        <path
          d="M 400 200 Q 350 160 300 280"
          fill="none"
          {...getLineStyle("critic", "writer")}
        />
      </svg>

      {/* Render Node Components */}
      {nodes.map((node) => (
        <div
          key={node.id}
          style={{
            position: "absolute",
            left: `${node.x}px`,
            top: `${node.y}px`,
            transform: "translate(-50%, -50%)",
          }}
          className={`flex flex-col items-center justify-center transition-all duration-500`}
        >
          {/* Node Glow Circle for Active State */}
          {node.active && (
            <div className="absolute w-24 h-24 rounded-full bg-kiwi/15 blur-xl animate-pulse" />
          )}

          {/* Node Circle */}
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center border-2 shadow-lg transition-all duration-300 ${
              node.active
                ? "bg-kiwi border-tangy text-slate-950 scale-110 shadow-kiwi/30"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            {node.id === "supervisor" && status === "running" && !node.active ? (
              <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
            ) : (
              node.icon
            )}
          </div>

          {/* Label */}
          <span
            className={`mt-2 text-xs font-semibold px-2 py-0.5 rounded transition-all duration-300 ${
              node.active
                ? "text-kiwi bg-kiwi/5 border border-kiwi/20"
                : "text-slate-400"
            }`}
          >
            {node.label}
          </span>
        </div>
      ))}

      {/* Status Bar */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              status === "running"
                ? "bg-kiwi animate-ping"
                : status === "complete"
                ? "bg-kiwi"
                : status === "error"
                ? "bg-rose-500"
                : "bg-slate-500"
            }`}
          />
          <span className="capitalize font-mono">{status}</span>
        </div>
        <div className="font-mono">
          Active: <span className="text-kiwi font-semibold">{currentAgent || "None"}</span>
        </div>
      </div>
    </div>
  );
}
