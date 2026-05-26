"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAgentSocket, AgentEvent } from "../hooks/useAgentSocket";
import { AgentGraph } from "../components/AgentGraph";
import { AgentTerminal } from "../components/AgentTerminal";
import { MarkdownOutput } from "../components/MarkdownOutput";
import { HumanInterrupt } from "../components/HumanInterrupt";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Play, 
  RotateCw, 
  Layers, 
  Server, 
  FileText, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  History, 
  Plus,
  Terminal,
  FileCode2,
  Settings,
  XCircle
} from "lucide-react";

interface DBRun {
  id: string;
  task: string;
  status: "running" | "complete" | "error";
  final_output: string | null;
  step_count: number;
  created_at: string;
  completed_at: string | null;
  trace_url: string | null;
}

export default function MainPage() {
  const [taskInput, setTaskInput] = useState("");
  const [runs, setRuns] = useState<DBRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [backendHealth, setBackendHealth] = useState<"online" | "offline" | "checking">("checking");
  const [activeTab, setActiveTab] = useState<"terminal" | "draft">("terminal");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const socket = useAgentSocket();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Check backend service health
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/health`);
      if (res.ok) {
        setBackendHealth("online");
      } else {
        setBackendHealth("offline");
      }
    } catch {
      setBackendHealth("offline");
    }
  }, [apiUrl]);

  // Fetch runs list from DB
  const fetchRuns = useCallback(async (silently = false) => {
    try {
      const res = await fetch(`${apiUrl}/api/runs`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
      }
    } catch (err) {
      if (!silently) {
        toast.error("Failed to load run history", {
          description: "Verify that the backend service is running on port 8000.",
        });
      }
    }
  }, [apiUrl]);

  // Initial check & load
  useEffect(() => {
    checkHealth();
    fetchRuns();
    
    // Poll health status and runs list every 10 seconds
    const interval = setInterval(() => {
      checkHealth();
      fetchRuns(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [checkHealth, fetchRuns]);

  // Handle click on run history item
  const handleSelectRun = async (run: DBRun) => {
    setSelectedRunId(run.id);
    socket.reset();
    
    if (run.status === "running") {
      socket.connect(run.id);
      setActiveTab("terminal");
    } else {
      socket.setStatus(run.status);
      socket.setStepCount(run.step_count);
      if (run.final_output) {
        socket.setFinalOutput(run.final_output);
        setActiveTab("draft");
      } else {
        setActiveTab("terminal");
      }
    }
  };

  // Start new run execution
  const handleStartRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskInput }),
      });

      if (!res.ok) {
        throw new Error("HTTP error " + res.status);
      }

      const data = await res.json();
      const newRunId = data.run_id;
      
      toast.success("Task Submitted!", {
        description: "Agent execution started in background.",
      });

      setTaskInput("");
      setSelectedRunId(newRunId);
      
      // Connect to WS immediately to listen to events
      socket.connect(newRunId);
      setActiveTab("terminal");
      
      // Refresh list immediately
      await fetchRuns(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Execution failed to start", {
        description: err.message || "Failed to contact the backend server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset page state to allow fresh prompt input
  const handleNewRunRequest = () => {
    setSelectedRunId(null);
    socket.reset();
    setActiveTab("terminal");
  };

  // Filter current active run if selected
  const selectedRun = runs.find((r) => r.id === selectedRunId);

  return (
    <div className="flex flex-1 overflow-hidden h-screen bg-slate-950 font-sans">
      {/* 1. Sidebar - Run History */}
      <aside className="w-80 border-r border-slate-900 bg-slate-950 flex flex-col h-full flex-shrink-0 select-none">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white tracking-wide">Hive Console</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${backendHealth === "online" ? "bg-emerald-500" : backendHealth === "checking" ? "bg-amber-500" : "bg-rose-500"}`} />
                <span className="text-[10px] text-slate-500 capitalize">{backendHealth === "online" ? "system active" : backendHealth === "checking" ? "resolving..." : "offline"}</span>
              </div>
            </div>
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={handleNewRunRequest}
            className="w-8 h-8 rounded-lg border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white"
            title="Create new task"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Sidebar Navigation */}
        <div className="p-3 border-b border-slate-900/60 bg-slate-950/20">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold px-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Task Runs History</span>
            <button onClick={() => fetchRuns()} className="hover:text-white transition">
              <RotateCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* History List */}
        <ScrollArea className="flex-1 p-2 space-y-1.5">
          {runs.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-600">
              No previous runs. Submit your first prompt to get started!
            </div>
          ) : (
            runs.map((run) => {
              const isSelected = selectedRunId === run.id;
              const dateStr = new Date(run.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              });

              return (
                <button
                  key={run.id}
                  onClick={() => handleSelectRun(run)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 mb-2 ${
                    isSelected
                      ? "bg-slate-900/90 border-indigo-500/50 shadow-md shadow-indigo-500/5"
                      : "bg-slate-950/50 border-slate-900 hover:bg-slate-900/40 hover:border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs font-semibold truncate ${isSelected ? "text-indigo-400" : "text-slate-300"}`}>
                      {run.task}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 font-mono capitalize border-0 ${
                        run.status === "complete"
                          ? "text-emerald-400 bg-emerald-950/30"
                          : run.status === "error"
                          ? "text-rose-400 bg-rose-950/30"
                          : "text-blue-400 bg-blue-950/30 animate-pulse"
                      }`}
                    >
                      {run.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{dateStr}</span>
                    <span>steps: {run.step_count}</span>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </aside>

      {/* 2. Main Content Frame */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
        {/* Main Header */}
        <header className="px-6 py-4 border-b border-slate-900 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Multi-Agent Researcher & Coder</h2>
              <p className="text-[11px] text-slate-500">Autonomous workflow orchestration using LangGraph</p>
            </div>
          </div>
          {selectedRunId && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-slate-900 border-slate-800 text-slate-400 text-[10px] font-mono select-all">
                ID: {selectedRunId}
              </Badge>
              {selectedRun?.trace_url && (
                <a
                  href={selectedRun.trace_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 bg-indigo-950/20 border border-indigo-900/50 px-2 py-0.5 rounded transition"
                >
                  <Server className="w-3 h-3" /> LangSmith Trace
                </a>
              )}
            </div>
          )}
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* A. Task Entry Area (Show only if no active/selected run, or when user clicks 'plus') */}
          {!selectedRunId && (
            <Card className="border-slate-900 bg-slate-950/40 shadow-2xl relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
              <CardHeader>
                <CardTitle className="text-base text-white flex items-center gap-1.5">
                  <Play className="w-4 h-4 text-indigo-400" /> Orchestrate New Agent Task
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Input a query. The supervisor will compile a structured plan, delegate search/coding tasks, execute sandbox scripts, and write a markdown report.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleStartRun}>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Enter your prompt. E.g., 'Research LangGraph vs CrewAI in 2026 and write a comparison report with code examples showing a simple LangGraph state graph'"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    required
                    className="min-h-[110px] bg-slate-900 border-slate-800 text-sm text-slate-300 placeholder:text-slate-600 focus-visible:ring-indigo-600 rounded-xl"
                  />
                </CardContent>
                <CardFooter className="flex justify-between border-t border-slate-900/60 pt-4 bg-slate-950/30">
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Server className="w-3.5 h-3.5" /> Gemini 2.0 Flash + Tavily + E2B Sandbox
                  </div>
                  <Button
                    type="submit"
                    disabled={!taskInput.trim() || isSubmitting || backendHealth !== "online"}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-5 rounded-lg flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/15"
                  >
                    Execute Workflow
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {/* B. Active Execution Control Hub (Show if active/selected run exists) */}
          {selectedRunId && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Visualizers */}
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Agent Execution Topology</h3>
                  <AgentGraph currentAgent={socket.currentAgent} status={socket.status} />
                </div>

                <HumanInterrupt 
                  runId={selectedRunId} 
                  status={socket.status} 
                  onInterrupted={() => {
                    // Update state to supervisor running, refetch runs to get correct log values
                    socket.setCurrentAgent("supervisor");
                    socket.setStatus("running");
                    fetchRuns(true);
                  }}
                />
              </div>

              {/* Right Column: Console Details */}
              <div className="lg:col-span-7 flex flex-col space-y-4">
                
                {/* Tabs Selector */}
                <div className="flex border-b border-slate-900">
                  <button
                    onClick={() => setActiveTab("terminal")}
                    className={`pb-2.5 px-4 font-semibold text-xs tracking-wide transition-all border-b-2 flex items-center gap-1.5 font-mono ${
                      activeTab === "terminal"
                        ? "text-indigo-400 border-indigo-500"
                        : "text-slate-500 border-transparent hover:text-slate-400"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" /> LIVE TERMINAL
                  </button>
                  <button
                    onClick={() => setActiveTab("draft")}
                    className={`pb-2.5 px-4 font-semibold text-xs tracking-wide transition-all border-b-2 flex items-center gap-1.5 font-mono ${
                      activeTab === "draft"
                        ? "text-indigo-400 border-indigo-500"
                        : "text-slate-500 border-transparent hover:text-slate-400"
                    }`}
                  >
                    <FileCode2 className="w-3.5 h-3.5" /> REPORT PREVIEW
                  </button>
                </div>

                {/* Tab Output Rendering */}
                {activeTab === "terminal" ? (
                  <AgentTerminal events={socket.events} />
                ) : (
                  <MarkdownOutput content={socket.finalOutput} />
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
