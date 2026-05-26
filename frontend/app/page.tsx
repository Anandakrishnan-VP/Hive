"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAgentSocket } from "../hooks/useAgentSocket";
import { AgentGraph } from "../components/AgentGraph";
import { AgentTerminal } from "../components/AgentTerminal";
import { MarkdownOutput } from "../components/MarkdownOutput";
import { HumanInterrupt } from "../components/HumanInterrupt";
import { audioManager } from "../lib/audio";
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
  ChevronRight
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

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  // If loading screen is active, display the honeycomb boot sequence
  if (showBootLoader) {
    return (
      <div 
        className={`fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 hud-scanline select-none transition-all duration-500 ${
          bootFinished ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
        }`}
      >
        <div className="absolute inset-0 hud-grid opacity-15" />
        
        {/* Glow sweeps */}
        <div className="absolute w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px]" />
        
        {/* Centered Honeycomb Hexagon Structure */}
        <div className="relative mb-12 flex flex-col items-center">
          
          {/* Animated concentric loader vectors */}
          <div className="absolute w-44 h-44 rounded-full border border-indigo-500/20 border-dashed animate-[spin_10s_linear_infinite]" />
          <div className="absolute w-36 h-36 rounded-full border border-indigo-400/10 animate-[spin_5s_linear_infinite_reverse]" />
          
          {/* Hexagonal Hive Logo (SVG) */}
          <div className="w-24 h-24 flex items-center justify-center relative z-10 animate-pulse">
            <svg viewBox="0 0 100 100" className="w-full h-full text-indigo-400 filter drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]">
              {/* Outer hexagonal shell */}
              <polygon 
                points="50,5 90,27 90,73 50,95 10,73 10,27" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                className="origin-center animate-[spin_20s_linear_infinite]"
              />
              {/* Middle structural frame */}
              <polygon 
                points="50,15 80,32 80,68 50,85 20,68 20,32" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1" 
                strokeDasharray="4 4"
                className="origin-center animate-[spin_15s_linear_infinite_reverse]"
              />
              {/* Nested Honeycomb clusters (Inner Core) */}
              <polygon points="50,28 69,39 69,61 50,72 31,61 31,39" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1" />
              {/* Inner core node points */}
              <circle cx="50" cy="28" r="2" fill="currentColor" />
              <circle cx="69" cy="39" r="2" fill="currentColor" />
              <circle cx="69" cy="61" r="2" fill="currentColor" />
              <circle cx="50" cy="72" r="2" fill="currentColor" />
              <circle cx="31" cy="61" r="2" fill="currentColor" />
              <circle cx="31" cy="39" r="2" fill="currentColor" />
              
              {/* Center connecting nucleus */}
              <polygon points="50,40 59,45 59,55 50,60 41,55 41,45" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </div>
        </div>

        {/* Digital HUD Counters & Telemetry Logs */}
        <div className="w-[450px] font-mono text-center relative z-10">
          <div className="flex items-center justify-between mb-2.5 px-1 border-b border-indigo-500/10 pb-1">
            <span className="text-[10px] tracking-widest text-indigo-400 uppercase font-bold flex items-center gap-1.5 animate-pulse">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Core System Booting
            </span>
            <span className="text-xs text-indigo-400 font-bold glow-text-indigo">
              {bootProgress.toString().padStart(3, "0")}%
            </span>
          </div>

          {/* Scrolling System Initializer logs */}
          <div className="h-28 bg-slate-950/80 border border-slate-900 rounded-lg p-3 text-left overflow-hidden flex flex-col justify-end gap-1 select-none backdrop-blur-md">
            {bootLogs.slice(-4).map((log, idx) => (
              <div key={idx} className="text-[10px] text-slate-500 flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-indigo-500 flex-shrink-0" />
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
    );
  }

  // Dashboard Core Frame
  return (
    <div className="flex flex-1 overflow-hidden h-screen bg-slate-950 font-sans hud-scanline select-none relative">
      <div className="absolute inset-0 hud-grid opacity-10 pointer-events-none" />
      
      {/* Visual scanning line */}
      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/5 to-transparent animate-sweep-bar pointer-events-none z-10" />

      {/* 1. Sidebar - Run History */}
      <aside className="w-80 border-r border-slate-900 bg-slate-950 flex flex-col h-full flex-shrink-0 relative z-20">
        
        {/* Decorative corner tags */}
        <span className="absolute top-0 right-0 text-[8px] text-slate-700 font-mono pr-1 select-none">H-SYS_V.03</span>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600/10 rounded-xl text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-600/5">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-xs text-white tracking-widest uppercase font-mono">
                <ScrambledText text="HIVE CONSOLE" />
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${backendHealth === "online" ? "bg-emerald-500" : backendHealth === "checking" ? "bg-amber-500" : "bg-rose-500"}`} />
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
        <div className="p-3 border-b border-slate-900/60 bg-slate-950/20">
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
                      ? "bg-slate-900/80 border-indigo-500/50 shadow-lg shadow-indigo-600/5"
                      : "bg-slate-950/50 border-slate-900 hover:bg-slate-900/30 hover:border-slate-800"
                  }`}
                >
                  {/* Glowing vertical slider on selected */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500" />
                  )}
                  
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[11px] font-mono font-bold truncate ${isSelected ? "text-indigo-400" : "text-slate-300"}`}>
                      {run.task}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[8px] px-1.5 py-0 font-mono capitalize border-0 ${
                        run.status === "complete"
                          ? "text-emerald-400 bg-emerald-950/20"
                          : run.status === "error"
                          ? "text-rose-400 bg-rose-950/20"
                          : "text-blue-400 bg-blue-950/20 animate-pulse"
                      }`}
                    >
                      {run.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                    <span>{dateStr}</span>
                    <span>STEPS: {run.step_count}</span>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </aside>

      {/* 2. Main Content Frame */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative z-20">
        
        {/* Main Header */}
        <header className="px-6 py-4 border-b border-slate-900 bg-slate-950 flex items-center justify-between relative">
          
          {/* Intersection marks */}
          <span className="absolute bottom-[-5px] left-[-5px] text-slate-700 font-mono font-bold text-xs select-none pointer-events-none">+</span>
          <span className="absolute bottom-[-5px] right-[-5px] text-slate-700 font-mono font-bold text-xs select-none pointer-events-none">+</span>

          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-indigo-500 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.3)]" />
            <div>
              <h2 className="text-xs font-bold text-white tracking-widest uppercase font-mono">
                <ScrambledText text="MUTLI-AGENT ORCHESTRATOR HUD" delay={400} />
              </h2>
              <p className="text-[10px] text-slate-500 font-mono uppercase">Topology: Supervisor Routing v2.5</p>
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
              className={`w-8 h-8 rounded-lg border-slate-800 hover:bg-slate-900 ${soundEnabled ? "text-indigo-400 border-indigo-900/30" : "text-slate-500"}`}
              title={soundEnabled ? "Mute audio" : "Unmute audio"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>

            {selectedRunId && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-slate-900 border-slate-800 text-slate-400 text-[9px] font-mono select-all">
                  ID: {selectedRunId}
                </Badge>
                {selectedRun?.trace_url && (
                  <a
                    href={selectedRun.trace_url}
                    target="_blank"
                    rel="noreferrer"
                    onMouseEnter={handleHoverSound}
                    onClick={handleClickSound}
                    className="text-[9px] text-indigo-400 hover:text-indigo-300 font-mono uppercase tracking-wider font-semibold flex items-center gap-1.5 bg-indigo-950/20 border border-indigo-900/50 px-2 py-0.5 rounded transition"
                  >
                    <Server className="w-3. h-3" /> LangSmith Trace
                  </a>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* A. Task Entry Area (Show only if no active/selected run) */}
          {!selectedRunId && (
            <Card className="border-slate-900 bg-slate-950/40 shadow-2xl relative overflow-hidden backdrop-blur-md glow-border-indigo">
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
              
              {/* Coordinate tag */}
              <span className="absolute top-1 right-2 text-[8px] text-slate-700 font-mono">PANEL_SYS.BOOT</span>
              
              <CardHeader>
                <CardTitle className="text-xs font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <Crosshair className="w-4 h-4" /> <ScrambledText text="EXECUTE NEW DEPLOYMENT" delay={200} />
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500 font-mono uppercase">
                  Input parameters below. The orchestrator will verify execution inside a virtual python sandbox.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleStartRun}>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Enter your prompt. E.g., 'Research current Bitcoin price and run a python script to calculate +35% investment value.'"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    required
                    className="min-h-[110px] bg-slate-900 border-slate-800 text-xs font-mono text-slate-300 placeholder:text-slate-600 focus-visible:ring-indigo-600 rounded-xl"
                  />
                </CardContent>
                <CardFooter className="flex justify-between border-t border-slate-900/60 pt-4 bg-slate-950/30">
                  <div className="text-[9px] text-slate-500 flex items-center gap-1.5 font-mono">
                    <Lock className="w-3.5 h-3.5 text-indigo-500" /> SECURED INTEGRATION: GEMINI 2.5 + TAVILY + E2B SANDBOX
                  </div>
                  <Button
                    type="submit"
                    onMouseEnter={handleHoverSound}
                    disabled={!taskInput.trim() || isSubmitting || backendHealth !== "online"}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[10px] tracking-widest uppercase py-2 px-5 rounded-lg flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/15"
                  >
                    DEPLOY CORE
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
                        ? "text-indigo-400 border-indigo-500"
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
                        ? "text-indigo-400 border-indigo-500"
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
