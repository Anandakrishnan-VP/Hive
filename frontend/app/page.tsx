"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAgentSocket } from "../hooks/useAgentSocket";
import { AgentGraph } from "../components/AgentGraph";
import { AgentTerminal } from "../components/AgentTerminal";
import { MarkdownOutput } from "../components/MarkdownOutput";
import { HumanInterrupt } from "../components/HumanInterrupt";
import { audioManager } from "../lib/audio";
import { Logo } from "@/components/Logo";
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
  Cpu, 
  History, 
  Plus,
  Terminal,
  FileCode2,
  Volume2,
  VolumeX,
  Radio,
  Crosshair,
  Lock,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2
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

// 1. Text Scrambler Effect Component
function ScrambledText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayText, setDisplayText] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const chars = "[]<>//_!@#$%^&*()_+{}:|?";
    let iterations = 0;
    
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setDisplayText(
          text
            .split("")
            .map((char, index) => {
              if (char === " ") return " ";
              if (index < iterations) {
                return text[index];
              }
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join("")
        );
        
        if (iterations >= text.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
        iterations += 1;
      }, 25);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, delay]);

  return <span>{displayText || "..."}</span>;
}

export default function MainPage() {
  const [taskInput, setTaskInput] = useState("");
  const [runs, setRuns] = useState<DBRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [backendHealth, setBackendHealth] = useState<"online" | "offline" | "checking">("checking");
  const [activeTab, setActiveTab] = useState<"terminal" | "draft">("terminal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Audio Mute State
  const [soundEnabled, setSoundEnabled] = useState(true);

  // 2Advanced Boot Loading Screen States
  const [showBootLoader, setShowBootLoader] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [bootFinished, setBootFinished] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  // Sound trigger helpers
  const handleHoverSound = () => {
    audioManager.playHover();
  };

  const handleClickSound = () => {
    audioManager.playClick();
  };

  const handleToggleSound = () => {
    const newState = audioManager.toggle();
    setSoundEnabled(newState);
    audioManager.playClick();
  };

  // Hexagonal Boot Sequence Timer Loop
  useEffect(() => {
    setSoundEnabled(audioManager.isEnabled());

    const logsTemplate = [
      "[0.05s] BOOT_SEQUENCE: INITIALIZING GRAPH DIRECTORY...",
      "[0.35s] CLIENT_SOUNDS: ENABLING WEB AUDIO OSCILLATORS...",
      "[0.80s] GRAPH_TOPOLOGY: LOADED (SUPERVISOR, RESEARCHER, CODER, WRITER, CRITIC)",
      "[1.30s] SECURE_ENVIRONMENT: BINDING LOCAL DB PORT 5432...",
      "[1.85s] PORTAL_FRAMEWORK: LOADING RADIAL HUD SYSTEM...",
      "[2.40s] API_TUNNEL: ONLINE AT HTTP://LOCALHOST:8000...",
      "[2.90s] SYNAPSE COMPLETED. HIVE CONSOLE FULLY DEPLOYED."
    ];

    const totalSteps = 100;
    const intervalTime = 25; // ~2.5 seconds total boot time

    const timer = setInterval(() => {
      setBootProgress((prev) => {
        const next = prev + 1;
        
        // Dynamic logs feeding
        if (next === 5) setBootLogs([logsTemplate[0]]);
        if (next === 20) setBootLogs((prev) => [...prev, logsTemplate[1]]);
        if (next === 40) setBootLogs((prev) => [...prev, logsTemplate[2]]);
        if (next === 60) setBootLogs((prev) => [...prev, logsTemplate[3]]);
        if (next === 75) setBootLogs((prev) => [...prev, logsTemplate[4]]);
        if (next === 90) setBootLogs((prev) => [...prev, logsTemplate[5]]);
        if (next === 99) setBootLogs((prev) => [...prev, logsTemplate[6]]);

        // Micro tick sounds on progress increase
        if (next % 3 === 0) {
          audioManager.playDataTick();
        }

        if (next >= totalSteps) {
          clearInterval(timer);
          setBootFinished(true);
          audioManager.playSuccess();
          setTimeout(() => {
            setShowBootLoader(false);
          }, 600); // Wait for exit animation
          return totalSteps;
        }
        return next;
      });
    }, intervalTime);

    // Fetch config values in parallel
    checkHealth();
    fetchRuns(true);

    return () => clearInterval(timer);
  }, [checkHealth, fetchRuns]);

  // Handle click on run history item
  const handleSelectRun = async (run: DBRun) => {
    handleClickSound();
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

    handleClickSound();
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
      audioManager.playAlert();
      toast.error("Execution failed to start", {
        description: err.message || "Failed to contact the backend server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset page state to allow fresh prompt input
  const handleNewRunRequest = () => {
    handleClickSound();
    setSelectedRunId(null);
    socket.reset();
    setActiveTab("terminal");
  };

  // Delete a run from history and database
  const handleDeleteRun = async (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    handleClickSound();
    
    const previousRuns = [...runs];
    setRuns((prev) => prev.filter((r) => r.id !== runId));
    if (selectedRunId === runId) {
      setSelectedRunId(null);
      socket.reset();
    }
    
    try {
      const res = await fetch(`${apiUrl}/api/runs/${runId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("HTTP error " + res.status);
      }
      toast.success("Task deleted successfully");
    } catch (err: any) {
      console.error(err);
      audioManager.playAlert();
      setRuns(previousRuns);
      toast.error("Failed to delete task", {
        description: err.message || "An error occurred while deleting the task run.",
      });
    }
  };

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  if (showBootLoader) {
    return (
      <div 
        className={`fixed inset-0 bg-black z-50 select-none transition-all duration-500 ${
          bootFinished ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
        }`}
      >
        {/* Background Grid */}
        <div className="absolute inset-0 hud-grid opacity-15 pointer-events-none z-0" />
        
        {/* Background Scanlines */}
        <div className="absolute inset-0 hud-scanline pointer-events-none z-1" />

        {/* Glow sweeps */}
        <div className="absolute w-[600px] h-[600px] bg-kiwi/5 rounded-full blur-[120px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none" />
        
        {/* Foreground Content Container - Flex Layout */}
        <div className="absolute inset-0 flex flex-col items-center justify-between z-10 py-16">
          {/* Top spacer to balance the layout and force logo to vertical center */}
          <div className="flex-1" />
          
          {/* Main centered container for the logo and project name */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center my-4">
            <Logo className="w-56 h-auto text-kiwi" />
            
            {/* Project Name Header with Sci-Fi HUD style */}
            <div className="mt-8 flex flex-col items-center select-none">
              <h1 className="text-4xl font-extrabold tracking-[0.4em] text-white font-mono pl-[0.4em] glow-text-kiwi animate-[pulse_3s_infinite] transition-all duration-300">
                HIVE
              </h1>
              {/* Animated accent line */}
              <div className="h-[1px] w-36 bg-gradient-to-r from-transparent via-kiwi/40 to-transparent mt-3.5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-kiwi to-transparent -translate-x-full animate-laser-sweep" />
              </div>
            </div>
          </div>

          {/* Bottom HUD telemetry box wrapped in a flex-1 container aligned to the bottom */}
          <div className="flex-1 flex flex-col justify-end items-center w-full">
            <div className="w-[450px] max-w-[90%] font-mono text-center">
              <div className="flex items-center justify-between mb-2.5 px-1 border-b border-kiwi/15 pb-1">
                <span className="text-[10px] tracking-widest text-kiwi uppercase font-bold flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-kiwi" /> Core System Booting
                </span>
                <span className="text-xs text-tangy font-bold glow-text-tangy">
                  {bootProgress.toString().padStart(3, "0")}%
                </span>
              </div>

              {/* Scrolling System Initializer logs */}
              <div className="h-28 bg-black/80 border border-kiwi/15 rounded-lg p-3 text-left overflow-hidden flex flex-col justify-end gap-1 select-none backdrop-blur-md">
                {bootLogs.slice(-4).map((log, idx) => (
                  <div key={idx} className="text-[10px] text-slate-500 flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-kiwi flex-shrink-0" />
                    <span className="truncate">{log}</span>
                  </div>
                ))}
              </div>

              {/* Coordinate frames */}
              <div className="flex justify-between items-center mt-3 text-[9px] text-slate-600">
                <span>[X:043 // Y:812]</span>
                <span>SECURE LINK RESOLVED</span>
                <span>LOCALE: AP_SYS_v2.5</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Core Frame
  return (
    <div className="flex flex-1 overflow-hidden h-screen bg-black font-sans select-none relative">
      <div className="absolute inset-0 hud-grid opacity-10 pointer-events-none" />
      
      {/* Visual scanning line */}
      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-kiwi/5 to-transparent animate-sweep-bar pointer-events-none z-10" />

      {/* 1. Sidebar - Run History */}
      <aside 
        className={`bg-black flex flex-col h-full flex-shrink-0 relative z-20 border-r border-slate-900/60 transition-all duration-300 ease-in-out overflow-hidden ${
          sidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0 border-r-0 pointer-events-none"
        }`}
      >
        <div className="w-80 h-full flex flex-col flex-shrink-0 relative">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-kiwi/10 rounded-xl text-kiwi border border-kiwi/20 shadow-lg shadow-kiwi/5">
                <Logo className="w-5 h-5 text-kiwi" hideBackgroundPath />
              </div>
              <div>
                <h1 className="font-bold text-xs text-white tracking-widest uppercase font-mono">
                  <ScrambledText text="HIVE CONSOLE" />
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${backendHealth === "online" ? "bg-kiwi animate-pulse" : backendHealth === "checking" ? "bg-amber-500" : "bg-rose-500"}`} />
                  <span className="text-[9px] text-slate-500 capitalize font-mono">{backendHealth === "online" ? "port 8000 online" : backendHealth === "checking" ? "resolving..." : "offline"}</span>
                </div>
              </div>
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={handleNewRunRequest}
              onMouseEnter={handleHoverSound}
              className="w-8 h-8 rounded-lg border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white"
              title="Create new task"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Sidebar Navigation */}
          <div className="p-3 border-b border-slate-900/60 bg-black/20">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono font-bold px-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> <ScrambledText text="TASK ARCHIVES" delay={200} /></span>
              <button 
                onClick={() => { handleClickSound(); fetchRuns(); }} 
                onMouseEnter={handleHoverSound}
                className="hover:text-white transition"
              >
                <RotateCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* History List */}
          <ScrollArea className="flex-1 p-2 space-y-1.5">
            {runs.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-700 font-mono">
                No previous runs. Submit your first prompt.
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
                    onMouseEnter={handleHoverSound}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 mb-2 relative overflow-hidden group ${
                      isSelected
                        ? "bg-slate-900/80 border-kiwi/40 shadow-lg shadow-kiwi/5"
                        : "bg-black/50 border-slate-900 hover:bg-slate-900/30 hover:border-slate-800"
                    }`}
                  >
                    {/* Glowing vertical slider on selected */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-kiwi" />
                    )}
                    
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[11px] font-mono font-bold truncate ${isSelected ? "text-kiwi" : "text-slate-300"}`}>
                        {run.task}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[8px] px-1.5 py-0 font-mono capitalize border-0 ${
                          run.status === "complete"
                            ? "text-kiwi bg-kiwi/10"
                            : run.status === "error"
                            ? "text-rose-400 bg-rose-950/20"
                            : "text-tangy bg-tangy/10 animate-pulse"
                        }`}
                      >
                        {run.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                      <span>{dateStr}</span>
                      <div className="flex items-center gap-2">
                        <span>STEPS: {run.step_count}</span>
                        <button
                          onClick={(e) => handleDeleteRun(e, run.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-500 transition duration-150 p-0.5"
                          title="Delete run"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </div>
      </aside>

      {/* 2. Main Content Frame */}
      <main className="flex-1 flex flex-col h-full bg-black overflow-hidden relative z-20">
        
        {/* Main Header */}
        <header className="px-6 py-4 border-b border-slate-900 bg-black flex items-center justify-between relative">
          
          {/* Intersection marks */}
          <span className="absolute bottom-[-5px] left-[-5px] text-slate-700 font-mono font-bold text-xs select-none pointer-events-none">+</span>
          <span className="absolute bottom-[-5px] right-[-5px] text-slate-700 font-mono font-bold text-xs select-none pointer-events-none">+</span>

          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="outline"
              onClick={() => { handleClickSound(); setSidebarOpen(!sidebarOpen); }}
              onMouseEnter={handleHoverSound}
              className="w-8 h-8 rounded-lg border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-kiwi" />
              )}
            </Button>
            
            <Separator orientation="vertical" className="h-4 bg-slate-800/60" />

            <Cpu className="w-5 h-5 text-kiwi filter drop-shadow-[0_0_8px_rgba(204,255,0,0.3)]" />
            <div>
              <h2 className="text-xs font-bold text-white tracking-widest font-mono">
                <ScrambledText text="Hive — Multi-Agent AI System" delay={400} />
              </h2>
              <p className="text-[10px] text-slate-500 font-mono">Supervisor · Researcher · Coder · Writer · Critic</p>
            </div>
          </div>

          {/* Sound Mute Control & DB ID */}
          <div className="flex items-center gap-4">
            {/* Audio Toggle Switch */}
            <Button
              size="icon"
              variant="outline"
              onClick={handleToggleSound}
              onMouseEnter={handleHoverSound}
              className={`w-8 h-8 rounded-lg border-slate-800 hover:bg-slate-900 ${soundEnabled ? "text-kiwi border-kiwi/20" : "text-slate-500"}`}
              title={soundEnabled ? "Mute audio" : "Unmute audio"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>

            {selectedRunId && selectedRun?.trace_url && (
              <div className="flex items-center gap-2">
                <a
                  href={selectedRun.trace_url}
                  target="_blank"
                  rel="noreferrer"
                  onMouseEnter={handleHoverSound}
                  onClick={handleClickSound}
                  className="text-[9px] text-tangy hover:text-tangy/80 font-mono uppercase tracking-wider font-semibold flex items-center gap-1.5 bg-tangy/10 border border-tangy/30 px-2 py-0.5 rounded transition"
                >
                  <Server className="w-3 h-3" /> LangSmith Trace
                </a>
              </div>
            )}
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* A. Task Entry Area (Show only if no active/selected run) */}
          {!selectedRunId && (
            <Card className="border-slate-900 bg-black/40 shadow-2xl relative overflow-hidden backdrop-blur-md glow-border-kiwi">
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-kiwi/40 to-transparent" />
              
              <CardHeader>
                <CardTitle className="text-xs font-mono text-kiwi tracking-widest flex items-center gap-2">
                  <Crosshair className="w-4 h-4" /> <ScrambledText text="What do you want to accomplish?" delay={200} />
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500 font-mono">
                  Describe your goal. Hive's agents will research, write code, and deliver a complete answer together.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleStartRun}>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder='e.g. "Research the top AI frameworks in 2026 and write a comparison with code examples"'
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (e.ctrlKey || e.shiftKey) {
                          // Ctrl+Enter or Shift+Enter inserts a new line (default behavior)
                          return;
                        } else {
                          // Plain Enter submits the form
                          e.preventDefault();
                          if (taskInput.trim() && !isSubmitting && backendHealth === "online") {
                            const form = e.currentTarget.form;
                            if (form) {
                              form.requestSubmit();
                            }
                          }
                        }
                      }
                    }}
                    required
                    className="min-h-[110px] bg-slate-900 border-slate-800 text-xs font-mono text-slate-300 placeholder:text-slate-600 focus-visible:ring-kiwi rounded-xl"
                  />
                </CardContent>
                <CardFooter className="flex justify-between border-t border-slate-900/60 pt-4 bg-black/30">
                  <div className="text-[9px] text-slate-500 flex items-center gap-1.5 font-mono">
                    <Lock className="w-3.5 h-3.5 text-kiwi" /> Powered by Groq · Tavily · E2B
                  </div>
                  <Button
                    type="submit"
                    onMouseEnter={handleHoverSound}
                    disabled={!taskInput.trim() || isSubmitting || backendHealth !== "online"}
                    className="bg-kiwi hover:bg-kiwi/90 text-slate-950 font-bold font-mono text-[10px] tracking-widest py-2 px-5 rounded-lg flex items-center gap-1.5 transition shadow-lg shadow-kiwi/15"
                  >
                    Run Agents
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
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center gap-1">
                    <Crosshair className="w-3.5 h-3.5" /> Topology Network Mapping
                  </h3>
                  <AgentGraph currentAgent={socket.currentAgent} status={socket.status} />
                </div>

                <HumanInterrupt 
                  runId={selectedRunId} 
                  status={socket.status} 
                  onInterrupted={() => {
                    handleClickSound();
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
                    onClick={() => { handleClickSound(); setActiveTab("terminal"); }}
                    onMouseEnter={handleHoverSound}
                    className={`pb-2.5 px-4 font-bold text-[10px] tracking-widest transition-all border-b-2 flex items-center gap-1.5 font-mono uppercase ${
                      activeTab === "terminal"
                        ? "text-kiwi border-kiwi"
                        : "text-slate-500 border-transparent hover:text-slate-400"
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" /> LIVE CONSOLE FEED
                  </button>
                  <button
                    onClick={() => { handleClickSound(); setActiveTab("draft"); }}
                    onMouseEnter={handleHoverSound}
                    className={`pb-2.5 px-4 font-bold text-[10px] tracking-widest transition-all border-b-2 flex items-center gap-1.5 font-mono uppercase ${
                      activeTab === "draft"
                        ? "text-kiwi border-kiwi"
                        : "text-slate-500 border-transparent hover:text-slate-400"
                    }`}
                  >
                    <FileCode2 className="w-3.5 h-3.5" /> COMPILED REPORT
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
