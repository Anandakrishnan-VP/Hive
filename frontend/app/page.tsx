"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";


import { toast } from "sonner";
import {
  History,
  Plus,
  Terminal,
  FileCode2,
  Radio,
  RotateCw,
  Cpu,
  ChevronRight,
  Crosshair,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  Settings,
  Sun,
  Moon,
  GitCompare,
  TrendingUp,
  Coins,
  Bug,
  Target,
  BookOpen,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  Copy
} from "lucide-react";

interface DBRun {
  id: string;
  task: string;
  status: "running" | "complete" | "error" | "cancelled";
  final_output: string | null;
  step_count: number;
  created_at: string;
  completed_at: string | null;
  trace_url: string | null;
  rating?: "up" | "down" | null;
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

const PRESET_USE_CASES = [
  {
    title: "Compare two technologies",
    prompt: "Compare Next.js vs Remix for a startup in 2026",
    icon: GitCompare,
  },
  {
    title: "Market analysis",
    prompt: "Analyze SWE job market in Bangalore vs Hyderabad",
    icon: TrendingUp,
  },
  {
    title: "Investment research",
    prompt: "Research Nvidia stock — buy, hold, or sell right now?",
    icon: Coins,
  },
  {
    title: "Debug my code",
    prompt: "Debug this Python function and explain what's wrong: [paste]",
    icon: Bug,
  },
  {
    title: "Competitive analysis",
    prompt: "Compare Notion vs Linear for a dev team of 5",
    icon: Target,
  },
  {
    title: "Learn a topic",
    prompt: "Explain RAG architecture with a working Python example",
    icon: BookOpen,
  },
];

export default function MainPage() {
  const [taskInput, setTaskInput] = useState("");
  const [runs, setRuns] = useState<DBRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [backendHealth, setBackendHealth] = useState<"online" | "offline" | "checking">("checking");
  const [activeTab, setActiveTab] = useState<"terminal" | "draft">("terminal");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authentication State
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Password Update State (in settings)
  const [newPassword, setNewPassword] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    
    handleClickSound();
    setPasswordUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully!");
      setNewPassword("");
      setShowChangePassword(false);
    } catch (err: any) {
      console.error(err);
      audioManager.playAlert();
      toast.error("Failed to update password", {
        description: err.message || "An error occurred.",
      });
    } finally {
      setPasswordUpdating(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (authMode !== "forgot" && !password.trim()) return;

    handleClickSound();
    setAuthSubmitting(true);
    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Successfully logged in!");
      } else if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Signup successful! Operator registered.");
      } else if (authMode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}`,
        });
        if (error) throw error;
        toast.success("Password reset email sent! Please check your inbox.");
        setAuthMode("login");
      }
    } catch (err: any) {
      console.error(err);
      audioManager.playAlert();
      toast.error("Authentication failed", {
        description: err.message || "Please check your credentials and try again.",
      });
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Audio Mute State
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Settings & Theme State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("hive_theme");
    if (savedTheme === "light") {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Click outside to close settings
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [settingsOpen]);

  const toggleTheme = () => {
    handleClickSound();
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("hive_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("hive_theme", "light");
    }
  };

  // 2Advanced Boot Loading Screen States
  const [showBootLoader, setShowBootLoader] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [bootFinished, setBootFinished] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { user, session, loading: authLoading, logout, loginAsGuest } = useAuth();
  const socket = useAgentSocket();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitResetTime, setRateLimitResetTime] = useState<string | null>(null);
  const [showGuestLimitModal, setShowGuestLimitModal] = useState(false);

  const formatResetTime = (isoString: string | null) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "";
    }
  };

  const fetchRateLimitStatus = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiUrl}/api/rate-limit-status`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRateLimited(data.rate_limited);
        setRateLimitResetTime(data.reset_at || null);
        // Automatically open the guest modal if they are a guest and rate limited
        if (data.rate_limited && user?.id === "guest_user") {
          setShowGuestLimitModal(true);
        }
      }
    } catch (err) {
      console.error("Error fetching rate limit status:", err);
    }
  }, [apiUrl, session, user]);

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
    if (!session?.access_token) return;
    if (session.access_token === "guest_token") {
      // Guest runs are in-memory only and not fetched from the DB
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/api/runs`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
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
  }, [apiUrl, session]);

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

    // Fetch config values in parallel
    checkHealth();
    fetchRuns(true);
    fetchRateLimitStatus();

    if (typeof window !== "undefined" && sessionStorage.getItem("hive_booted") === "true") {
      setShowBootLoader(false);
      setBootFinished(true);
      setBootProgress(100);
      return;
    }

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
          if (typeof window !== "undefined") {
            sessionStorage.setItem("hive_booted", "true");
          }
          setTimeout(() => {
            setShowBootLoader(false);
          }, 600); // Wait for exit animation
          return totalSteps;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [checkHealth, fetchRuns, fetchRateLimitStatus]);

  useEffect(() => {
    if (session?.access_token) {
      fetchRateLimitStatus();
    } else {
      setRateLimited(false);
      setRateLimitResetTime(null);
    }
  }, [session, fetchRateLimitStatus]);

  // Sync selected run state with socket status updates (critical for guests/real-time updates)
  useEffect(() => {
    if (selectedRunId && socket.status !== "idle") {
      setRuns((prevRuns) =>
        prevRuns.map((r) =>
          r.id === selectedRunId
            ? {
                ...r,
                status: socket.status === "running" ? "running" : socket.status === "error" ? "error" : socket.status === "cancelled" ? "cancelled" : "complete",
                step_count: socket.stepCount,
                final_output: socket.finalOutput || r.final_output,
              }
            : r
        )
      );
    }
  }, [selectedRunId, socket.status, socket.stepCount, socket.finalOutput]);

  // Handle click on run history item
  const handleSelectRun = async (run: DBRun) => {
    handleClickSound();
    setSelectedRunId(run.id);
    socket.reset();

    if (run.status === "running") {
      socket.connect(run.id, session?.access_token);
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
    if (!taskInput.trim() || isSubmitting || rateLimited) return;

    handleClickSound();
    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${apiUrl}/api/runs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ task: taskInput }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const errData = await res.json();
          const detail = errData.detail || {};
          setRateLimited(true);
          setRateLimitResetTime(detail.reset_at || null);
          if (user?.id === "guest_user") {
            setShowGuestLimitModal(true);
          }
          throw new Error(detail.message || "You are out of free messages");
        }
        throw new Error("HTTP error " + res.status);
      }

      const data = await res.json();
      const newRunId = data.run_id;

      toast.success("Task Submitted!", {
        description: "Agent execution started in background.",
      });

      // Append new run to list (essential for in-memory guest runs)
      const newRun: DBRun = {
        id: newRunId,
        task: taskInput,
        status: "running",
        step_count: 0,
        created_at: new Date().toISOString(),
        final_output: null,
        completed_at: null,
        trace_url: null,
      };
      setRuns((prev) => [newRun, ...prev]);

      setTaskInput("");
      setSelectedRunId(newRunId);

      // Connect to WS immediately to listen to events
      socket.connect(newRunId, session?.access_token);
      setActiveTab("terminal");

      // Refresh list immediately
      await fetchRuns(true);
      fetchRateLimitStatus();
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
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${apiUrl}/api/runs/${runId}`, {
        method: "DELETE",
        headers
      });
      if (!res.ok) {
        throw new Error("HTTP error " + res.status);
      }
      toast.success("Task deleted successfully");
      fetchRateLimitStatus();
    } catch (err: any) {
      console.error(err);
      audioManager.playAlert();
      setRuns(previousRuns);
      toast.error("Failed to delete task", {
        description: err.message || "An error occurred while deleting the task run.",
      });
    }
  };

  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelRun = async () => {
    if (!selectedRunId || isCancelling) return;
    handleClickSound();
    setIsCancelling(true);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${apiUrl}/api/runs/${selectedRunId}/cancel`, {
        method: "POST",
        headers
      });
      if (res.ok) {
        toast.success("Execution stopped by operator");
        setRuns((prev) =>
          prev.map((r) => (r.id === selectedRunId ? { ...r, status: "cancelled" } : r))
        );
        socket.setStatus("cancelled");
      } else {
        const data = await res.json();
        throw new Error(data.detail || "Failed to cancel run");
      }
    } catch (err: any) {
      console.error(err);
      audioManager.playAlert();
      toast.error("Failed to cancel run", {
        description: err.message
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleVote = async (rating: "up" | "down") => {
    if (!selectedRunId) return;
    handleClickSound();
    
    // Optimistically update local state
    setRuns((prev) =>
      prev.map((r) => (r.id === selectedRunId ? { ...r, rating } : r))
    );
    
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch(`${apiUrl}/api/runs/${selectedRunId}/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({ rating }),
      });
      
      if (res.ok) {
        toast.success("Thank you for your feedback!", {
          description: "Feedback saved to improve future model routing decisions."
        });
      } else {
        throw new Error("HTTP error " + res.status);
      }
    } catch (err: any) {
      console.error("Error submitting feedback:", err);
      toast.error("Failed to save feedback");
    }
  };

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  if (showBootLoader) {
    return (
      <div
        className={`fixed inset-0 bg-black z-50 select-none transition-all duration-500 ${bootFinished ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
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
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono gap-4 select-none">
        <div className="absolute inset-0 hud-grid opacity-15 pointer-events-none z-0" />
        <div className="absolute inset-0 hud-scanline pointer-events-none z-1" />
        <Logo className="w-28 h-auto text-kiwi animate-pulse z-10" />
        <div className="text-xs text-kiwi tracking-widest animate-pulse z-10">AUTHENTICATING...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background dark:bg-black p-4 relative font-mono text-xs select-none">
        <div className="absolute inset-0 hud-grid opacity-[0.03] dark:opacity-10 pointer-events-none" />
        <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-kiwi/5 to-transparent animate-sweep-bar pointer-events-none z-10" />
        
        <div className="w-full max-w-md p-6 bg-card/60 dark:bg-black/40 border border-slate-350 dark:border-slate-900 rounded-2xl shadow-2xl backdrop-blur-md relative overflow-hidden glow-border-kiwi z-20">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-kiwi/40 to-transparent" />
          
          <div className="flex flex-col items-center mb-6">
            <Logo className="w-24 h-auto text-kiwi mb-4" />
            <h2 className="text-sm font-bold tracking-widest text-slate-900 dark:text-white uppercase">
              <ScrambledText 
                text={authMode === "login" ? "HIVE CONSOLE LOGIN" : authMode === "signup" ? "HIVE REGISTRATION" : "RECOVER CREDENTIALS"} 
                key={authMode} 
              />
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {authMode === "login" 
                ? "Enter your email and password to log in" 
                : authMode === "signup" 
                  ? "Register a new email and password" 
                  : "Enter your email to request a reset link"
              }
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400">Email Address</label>
              <input
                type="email"
                required
                disabled={authSubmitting}
                placeholder="operator@hive.sys"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-lg text-slate-900 dark:text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-kiwi focus:border-kiwi font-mono"
              />
            </div>

            {authMode !== "forgot" && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400">Password</label>
                  {authMode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        handleClickSound();
                        setAuthMode("forgot");
                      }}
                      className="text-[9px] text-kiwi hover:underline uppercase tracking-wider"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={authSubmitting}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-lg text-slate-900 dark:text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-kiwi focus:border-kiwi font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleClickSound();
                      setShowPassword(!showPassword);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-400"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={authSubmitting}
              className="w-full bg-kiwi hover:bg-kiwi/90 text-slate-950 font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-kiwi/15 mt-2"
            >
              {authSubmitting ? (
                <span className="animate-pulse">PROCESSING...</span>
              ) : (
                <span>{authMode === "login" ? "INITIALIZE CONSOLE" : authMode === "signup" ? "CREATE OPERATOR" : "SEND RESET EMAIL"}</span>
              )}
            </Button>
          </form>

          <div className="mt-5 text-center border-t border-slate-200 dark:border-slate-900 pt-4 flex flex-col gap-2">
            {authMode === "forgot" ? (
              <button
                type="button"
                onClick={() => {
                  handleClickSound();
                  setAuthMode("login");
                }}
                className="text-[10px] text-kiwi hover:underline tracking-wider uppercase"
              >
                Back to Log In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  handleClickSound();
                  setAuthMode(authMode === "login" ? "signup" : "login");
                }}
                className="text-[10px] text-kiwi hover:underline tracking-wider uppercase font-bold"
              >
                {authMode === "login" ? "Create operator credentials" : "Existing operator? Log In"}
              </button>
            )}
            <Separator className="my-1 bg-slate-200 dark:bg-slate-900/50" />
            <button
              type="button"
              onClick={() => {
                handleClickSound();
                loginAsGuest();
              }}
              className="text-[10px] text-slate-500 hover:text-slate-950 dark:hover:text-kiwi hover:underline tracking-wider uppercase font-bold"
            >
              Continue as Guest
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Core Frame
  return (
    <div className="flex flex-1 overflow-hidden h-screen bg-background dark:bg-black font-sans select-none relative text-slate-800 dark:text-slate-100">
      <div className="absolute inset-0 hud-grid opacity-[0.03] dark:opacity-10 pointer-events-none" />

      {/* Visual scanning line */}
      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-kiwi/5 to-transparent animate-sweep-bar pointer-events-none z-10" />

      {/* 1. Sidebar - Run History */}
      <aside
        className={`bg-sidebar dark:bg-black flex flex-col h-full flex-shrink-0 relative z-20 border-r border-slate-300 dark:border-slate-900/60 transition-all duration-300 ease-in-out overflow-hidden ${sidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0 border-r-0 pointer-events-none"
          }`}
      >
        <div className="w-80 h-full flex flex-col flex-shrink-0 relative">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-300 dark:border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-slate-900/10 dark:bg-kiwi/10 rounded-xl text-slate-900 dark:text-kiwi border border-slate-900/20 dark:border-kiwi/20 shadow-lg shadow-slate-900/5 dark:shadow-kiwi/5">
                <Logo className="w-5 h-5 text-current" hideBackgroundPath />
              </div>
              <div>
                <h1 className="font-bold text-xs text-slate-900 dark:text-white tracking-widest uppercase font-mono">
                  <ScrambledText text="HIVE CONSOLE" />
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${backendHealth === "online" ? "bg-kiwi animate-pulse" : backendHealth === "checking" ? "bg-amber-500" : "bg-rose-500"}`} />
                  <span className="text-[9px] text-slate-500 font-mono uppercase">{backendHealth === "online" ? "system online" : backendHealth === "checking" ? "connecting..." : "system offline"}</span>
                </div>
              </div>
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={handleNewRunRequest}
              onMouseEnter={handleHoverSound}
              className="w-8 h-8 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              title="Create new task"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Sidebar Navigation */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-900/60 bg-slate-100/50 dark:bg-black/20">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono font-bold px-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> <ScrambledText text="TASK ARCHIVES" delay={200} /></span>
              <button
                onClick={() => { handleClickSound(); fetchRuns(); }}
                onMouseEnter={handleHoverSound}
                className="hover:text-slate-900 dark:hover:text-white transition"
              >
                <RotateCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto p-2 pr-3 space-y-2 custom-scrollbar">
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
                  <div
                    key={run.id}
                    onClick={() => handleSelectRun(run)}
                    onMouseEnter={handleHoverSound}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 mb-2 relative overflow-hidden group cursor-pointer ${isSelected
                      ? "bg-slate-300/40 dark:bg-slate-900/80 border-kiwi/40 shadow-lg shadow-kiwi/5"
                      : "bg-card/40 dark:bg-black/50 border-slate-300 dark:border-slate-900 hover:bg-card/70 dark:hover:bg-slate-900/30 hover:border-slate-400 dark:hover:border-slate-800"
                      }`}
                  >
                    {/* Glowing vertical slider on selected */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-kiwi" />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[11px] font-mono font-bold truncate ${isSelected ? "text-kiwi" : "text-slate-700 dark:text-slate-300"}`}>
                        {run.task}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[8px] px-1.5 py-0 font-mono capitalize border-0 ${run.status === "complete"
                          ? "text-kiwi bg-kiwi/10"
                          : run.status === "error"
                            ? "bg-rose-600 text-white dark:bg-rose-950/20 dark:text-rose-400"
                            : run.status === "cancelled"
                              ? "bg-slate-200 text-slate-800 dark:bg-slate-900/60 dark:text-slate-400 border border-slate-350 dark:border-slate-800"
                              : "text-tangy bg-tangy/10 animate-pulse"
                          }`}
                      >
                        {run.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-600 dark:text-slate-500 font-mono">
                      <span>{dateStr}</span>
                      <div className="flex items-center gap-2">
                        <span>STEPS: {run.step_count}</span>
                        <button
                          onClick={(e) => handleDeleteRun(e, run.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 dark:text-slate-500 hover:text-rose-500 transition duration-150 p-0.5"
                          title="Delete run"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* 2. Main Content Frame */}
      <main className="flex-1 flex flex-col h-full bg-background dark:bg-black overflow-hidden relative z-20">

        {/* Main Header */}
        <header className="px-6 py-4 border-b border-slate-300 dark:border-slate-900 bg-background dark:bg-black flex items-center justify-between relative">

          {/* Intersection marks */}
          <span className="absolute bottom-[-5px] left-[-5px] text-slate-300 dark:text-slate-700 font-mono font-bold text-xs select-none pointer-events-none">+</span>
          <span className="absolute bottom-[-5px] right-[-5px] text-slate-300 dark:text-slate-700 font-mono font-bold text-xs select-none pointer-events-none">+</span>

          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="outline"
              onClick={() => { handleClickSound(); setSidebarOpen(!sidebarOpen); }}
              onMouseEnter={handleHoverSound}
              className="w-8 h-8 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-kiwi" />
              )}
            </Button>

            <Separator orientation="vertical" className="h-4 bg-slate-200 dark:bg-slate-800/60" />

            <Cpu className="w-5 h-5 text-kiwi filter drop-shadow-[0_0_8px_rgba(204,255,0,0.3)]" />
            <div>
              <h2 className="text-xs font-bold text-slate-900 dark:text-white tracking-widest font-mono">
                <ScrambledText text="Hive — Multi-Agent AI System" delay={400} />
              </h2>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">Supervisor · Researcher · Coder · Writer · Critic</p>
            </div>
          </div>

          {/* Settings Control */}
          <div className="flex items-center gap-4">
            <div className="relative" ref={settingsRef}>
              <Button
                size="icon"
                variant="outline"
                onClick={() => { handleClickSound(); setSettingsOpen(!settingsOpen); }}
                onMouseEnter={handleHoverSound}
                className={`w-8 h-8 rounded-lg border-slate-300 dark:border-slate-800 hover:bg-slate-300/40 dark:hover:bg-slate-900 ${settingsOpen ? "text-kiwi border-kiwi/30 bg-slate-105 dark:bg-slate-900" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                title="System settings"
              >
                <Settings className="w-4 h-4" />
              </Button>

              {settingsOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-popover/95 dark:bg-slate-950/95 border border-slate-300 dark:border-slate-850 rounded-xl p-4 shadow-2xl z-50 backdrop-blur-md flex flex-col gap-4 font-mono text-[11px] glow-border-kiwi animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
                    <span className="text-kiwi font-bold tracking-widest uppercase">System Config</span>
                    <button
                      className="h-4 w-4 text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white text-[10px] flex items-center justify-center font-bold"
                      onClick={() => setSettingsOpen(false)}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Toggle 1: Sound */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-700 dark:text-slate-200 font-semibold">Audio Feedback</span>
                      <span className="text-[9px] text-slate-600 dark:text-slate-400">Enable UI soundscapes</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleToggleSound}
                      className={`h-7 px-3 text-[10px] rounded-lg border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 ${soundEnabled ? "text-kiwi border-kiwi/30 bg-kiwi/10" : "text-slate-600 dark:text-slate-400"}`}
                    >
                      {soundEnabled ? "ON" : "OFF"}
                    </Button>
                  </div>

                  {/* Toggle 2: Theme */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-700 dark:text-slate-200 font-semibold">System Theme</span>
                      <span className="text-[9px] text-slate-600 dark:text-slate-400">Toggle light / dark mode</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={toggleTheme}
                      className={`h-7 px-3 text-[10px] rounded-lg border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-1.5 ${isDarkMode ? "text-slate-600 dark:text-slate-300" : "text-kiwi border-kiwi/30 bg-kiwi/10"}`}
                    >
                      {isDarkMode ? (
                        <>
                          <Moon className="w-3.5 h-3.5" /> DARK
                        </>
                      ) : (
                        <>
                          <Sun className="w-3.5 h-3.5 text-kiwi animate-spin-slow" /> LIGHT
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Log Out Operator */}
                  <div className="border-t border-slate-200 dark:border-slate-900 pt-3 flex flex-col gap-2">
                    <div className="text-[9px] text-slate-500 dark:text-slate-500 font-mono truncate">
                      OPERATOR: {user?.email} {user?.id === "guest_user" && "(GUEST)"}
                    </div>

                    {user?.id !== "guest_user" && (
                      showChangePassword ? (
                        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-2">
                          <div className="relative">
                            <input
                              type={showNewPassword ? "text" : "password"}
                              required
                              disabled={passwordUpdating}
                              placeholder="New Password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full pl-2 pr-8 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-lg text-slate-900 dark:text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-kiwi focus:border-kiwi font-mono text-[10px]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleClickSound();
                                setShowNewPassword(!showNewPassword);
                              }}
                              className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-500 hover:text-slate-400"
                            >
                              {showNewPassword ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShowChangePassword(false);
                                setShowNewPassword(false);
                              }}
                              className="h-6 flex-1 text-[9px] rounded-lg"
                            >
                              CANCEL
                            </Button>
                            <Button
                              type="submit"
                              size="sm"
                              disabled={passwordUpdating}
                              className="h-6 flex-1 bg-kiwi hover:bg-kiwi/90 text-slate-950 text-[9px] font-bold rounded-lg"
                            >
                              {passwordUpdating ? "UPDATING..." : "SAVE"}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            handleClickSound();
                            setShowChangePassword(true);
                          }}
                          className="h-7 w-full text-[10px] rounded-lg border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
                        >
                          CHANGE PASSWORD
                        </Button>
                      )
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        handleClickSound();
                        logout();
                      }}
                      className="h-7 w-full text-[10px] rounded-lg border-rose-250 hover:border-rose-450 dark:border-rose-950/40 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    >
                      LOG OUT CONSOLE
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden p-6 flex flex-col justify-between">

          {/* A. Task Entry Area (Show only if no active/selected run) */}
          {!selectedRunId && (
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-none">
              <Card className="border-slate-300 dark:border-slate-900 bg-card/80 dark:bg-black/40 shadow-2xl relative overflow-hidden backdrop-blur-md glow-border-kiwi">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-kiwi/40 to-transparent" />

                <CardHeader>
                  <CardTitle className="text-xs font-mono text-kiwi tracking-widest flex items-center gap-2">
                    <Crosshair className="w-4 h-4" /> <ScrambledText text="What do you want to accomplish?" delay={200} />
                  </CardTitle>
                  <CardDescription className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                    Describe your goal. Hive's agents will research, write code, and deliver a complete answer together.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleStartRun} className="flex flex-col gap-3">
                  <CardContent className="space-y-4">
                    {rateLimited && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-tangy/15 border border-tangy/30 text-[10px] font-mono text-tangy animate-[pulse_3s_infinite] backdrop-blur-md">
                        <div className="flex items-center gap-2">
                          <Radio className="w-3.5 h-3.5 text-tangy animate-pulse flex-shrink-0" />
                          <span>
                            You are out of free <span className="underline decoration-tangy decoration-1 underline-offset-2">messages</span> until {formatResetTime(rateLimitResetTime)}
                          </span>
                        </div>
                        {user?.id === "guest_user" && (
                          <button
                            type="button"
                            onClick={() => {
                              handleClickSound();
                              logout();
                            }}
                            className="bg-white hover:bg-slate-250 text-black text-[9px] font-bold tracking-wider px-3 py-1 rounded transition-all font-mono uppercase flex-shrink-0"
                          >
                            Login
                          </button>
                        )}
                      </div>
                    )}

                    <Textarea
                      placeholder='e.g. "Research the top AI frameworks in 2026 and write a comparison with code examples"'
                      value={taskInput}
                      onChange={(e) => setTaskInput(e.target.value)}
                      disabled={rateLimited}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (e.ctrlKey || e.shiftKey) {
                            // Ctrl+Enter or Shift+Enter inserts a new line (default behavior)
                            return;
                          } else {
                            // Plain Enter submits the form
                            e.preventDefault();
                            if (taskInput.trim() && !isSubmitting && backendHealth === "online" && !rateLimited) {
                              const form = e.currentTarget.form;
                              if (form) {
                                form.requestSubmit();
                              }
                            }
                          }
                        }
                      }}
                      required
                      className="min-h-[110px] bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-850 text-xs font-mono text-slate-800 dark:text-slate-300 placeholder:text-slate-550 dark:placeholder:text-slate-655 focus-visible:ring-kiwi rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    {/* Preset Use Case Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                      {PRESET_USE_CASES.map((preset, index) => {
                        const IconComponent = preset.icon;
                        return (
                          <div
                            key={index}
                            onClick={() => {
                              if (rateLimited) return;
                              handleClickSound();
                              setTaskInput(preset.prompt);
                            }}
                            onMouseEnter={() => {
                              if (!rateLimited) handleHoverSound();
                            }}
                            className={`p-3 border rounded-xl flex flex-col gap-2 transition-all duration-200 ${
                              rateLimited
                                ? "opacity-40 cursor-not-allowed border-slate-300 dark:border-slate-900 bg-slate-200/5 dark:bg-slate-900/10"
                                : "bg-slate-200/20 hover:bg-slate-300/30 dark:bg-slate-900/35 dark:hover:bg-slate-900/70 border-slate-300 hover:border-slate-400 dark:border-slate-900 dark:hover:border-kiwi/30 cursor-pointer group"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded-lg transition-all ${
                                rateLimited 
                                  ? "bg-slate-200/5 dark:bg-black/20 text-slate-500" 
                                  : "bg-slate-300/30 dark:bg-black/40 text-slate-700 dark:text-slate-400 group-hover:text-kiwi dark:group-hover:bg-kiwi/15 dark:group-hover:text-kiwi"
                              }`}>
                                <IconComponent className="w-3.5 h-3.5" />
                              </div>
                              <span className={`text-[10px] font-bold tracking-wider font-mono uppercase transition-colors ${
                                rateLimited 
                                  ? "text-slate-500" 
                                  : "text-slate-800 dark:text-slate-300 group-hover:text-kiwi"
                              }`}>
                                {preset.title}
                              </span>
                            </div>
                            <p className={`text-[10px] line-clamp-2 leading-relaxed transition-colors ${
                              rateLimited ? "text-slate-550 dark:text-slate-600" : "text-slate-600 dark:text-slate-500"
                            }`}>
                              {preset.prompt}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t border-slate-200 dark:border-slate-900/60 p-4 bg-slate-50/50 dark:bg-black/30">
                    <div className="text-[9px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                      <Lock className="w-3.5 h-3.5 text-kiwi" /> Powered by Groq · Gemini · Tavily · E2B
                    </div>
                    <Button
                      type="submit"
                      onMouseEnter={handleHoverSound}
                      disabled={!taskInput.trim() || isSubmitting || backendHealth !== "online" || rateLimited}
                      className="bg-kiwi hover:bg-kiwi/90 text-slate-950 font-bold font-mono text-[10px] tracking-widest py-2 px-5 rounded-lg flex items-center gap-1.5 transition shadow-lg shadow-kiwi/15 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Run Agents
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          )}

          {selectedRunId && (
            <div className="flex-1 overflow-y-auto lg:overflow-y-hidden pr-1 scrollbar-none">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-stretch h-full">

                {/* Left Column: Visualizers */}
                <div className={`lg:col-span-5 flex flex-col space-y-5 overflow-y-auto custom-scrollbar pr-1.5 h-full pt-2 ${
                  socket.status === "running" ? "justify-start" : "justify-center"
                }`}>
                  <div className="shrink-0">
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-600 dark:text-slate-400 font-bold mb-2.5 flex items-center gap-1.5 shrink-0">
                      <Crosshair className="w-3.5 h-3.5" /> Topology Network Mapping
                    </h3>
                    <AgentGraph currentAgent={socket.currentAgent} status={socket.status} />
                  </div>

                  {socket.status === "running" && (
                    <div className="shrink-0 mt-1">
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
                  )}
                </div>

                {/* Right Column: Console Details */}
                <div className="lg:col-span-7 flex flex-col space-y-4">

                  {/* Tabs Selector & Stop Run Action */}
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-900">
                    <div className="flex">
                      <button
                        onClick={() => { handleClickSound(); setActiveTab("terminal"); }}
                        onMouseEnter={handleHoverSound}
                        className={`pb-2.5 px-4 font-bold text-[10px] tracking-widest transition-all border-b-2 flex items-center gap-1.5 font-mono uppercase ${activeTab === "terminal"
                          ? "text-kiwi border-kiwi"
                          : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white"
                          }`}
                      >
                        <Terminal className="w-3.5 h-3.5" /> LIVE CONSOLE FEED
                      </button>
                      <button
                        onClick={() => { handleClickSound(); setActiveTab("draft"); }}
                        onMouseEnter={handleHoverSound}
                        className={`pb-2.5 px-4 font-bold text-[10px] tracking-widest transition-all border-b-2 flex items-center gap-1.5 font-mono uppercase ${activeTab === "draft"
                          ? "text-kiwi border-kiwi"
                          : "text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white"
                          }`}
                      >
                        <FileCode2 className="w-3.5 h-3.5" /> COMPILED REPORT
                      </button>
                    </div>

                    {socket.status === "running" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelRun}
                        disabled={isCancelling}
                        className="h-7 px-3 mr-2 mb-2 text-[9px] font-mono font-bold tracking-wider text-rose-500 border-rose-950/20 hover:bg-rose-950/10 hover:border-rose-500 rounded-lg flex items-center gap-1"
                      >
                        <svg className="w-3 h-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.36 18.36A9 9 0 015.64 5.64m12.72 12.72A9 9 0 005.64 5.64m12.72 12.72L5.64 5.64" />
                        </svg>
                        {isCancelling ? "CANCELLING..." : "STOP RUN"}
                      </Button>
                    )}
                  </div>

                  {/* Tab Output Rendering */}
                  {activeTab === "terminal" ? (
                    <AgentTerminal events={socket.events} />
                  ) : (
                    <div className="flex flex-col justify-between h-[460px]">
                      <div className="flex-1 min-h-0">
                        <MarkdownOutput content={socket.finalOutput} className="h-full" />
                      </div>
                      
                      {/* Actions Bar (Copy, Feedback, Rerun) */}
                      {(selectedRun?.status === "complete" || socket.status === "complete") && (
                        <div className="mt-4 p-3 bg-slate-900/40 border border-slate-350 dark:border-slate-900 rounded-xl flex items-center justify-between font-mono text-[10px] backdrop-blur-md shrink-0">
                          <span className="text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider">
                            Feedback & Actions
                          </span>
                          <div className="flex items-center gap-2">
                            {/* Copy button */}
                            <button
                              onClick={() => {
                                handleClickSound();
                                navigator.clipboard.writeText(socket.finalOutput || selectedRun?.final_output || "");
                                toast.success("Copied report to clipboard");
                              }}
                              className="h-8 w-8 rounded-lg bg-slate-200/50 dark:bg-black/35 border border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-slate-750 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center"
                              title="Copy Report"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            {/* Thumbs Up button (Only for logged-in operators) */}
                            {user?.id !== "guest_user" && (
                              <button
                                onClick={() => handleVote("up")}
                                className={`h-8 w-8 rounded-lg border transition flex items-center justify-center ${
                                  selectedRun?.rating === "up"
                                    ? "bg-kiwi/15 border-kiwi text-kiwi shadow-md shadow-kiwi/10"
                                    : "bg-slate-200/50 dark:bg-black/35 border-slate-300 dark:border-slate-800 hover:border-kiwi/40 dark:hover:border-kiwi/30 text-slate-750 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                                title="Was this helpful?"
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                            )}

                            {/* Thumbs Down button (Only for logged-in operators) */}
                            {user?.id !== "guest_user" && (
                              <button
                                onClick={() => handleVote("down")}
                                className={`h-8 w-8 rounded-lg border transition flex items-center justify-center ${
                                  selectedRun?.rating === "down"
                                    ? "bg-rose-500/15 border-rose-500 text-rose-500 shadow-md shadow-rose-500/10"
                                    : "bg-slate-200/50 dark:bg-black/35 border-slate-300 dark:border-slate-800 hover:border-rose-500/40 dark:hover:border-rose-500/30 text-slate-750 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-450"
                                }`}
                                title="Was this unhelpful?"
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </button>
                            )}

                            {/* Rerun/Refresh button */}
                            <button
                              onClick={() => {
                                handleClickSound();
                                setTaskInput(selectedRun?.task || "");
                                setSelectedRunId(null);
                                socket.reset();
                                setActiveTab("terminal");
                                toast.info("Task prompt loaded for rerun");
                              }}
                              className="h-8 w-8 rounded-lg bg-slate-200/50 dark:bg-black/35 border border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 text-slate-750 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center"
                              title="Rerun Task"
                            >
                              <RotateCw className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* System Footer (Docked at bottom) */}
        <footer className="py-3 px-6 border-t border-slate-200 dark:border-slate-900/60 bg-background/95 dark:bg-black/95 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-[9px] text-slate-500 dark:text-slate-500 font-mono select-none z-30">
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-center sm:text-left">
            <span>© {new Date().getFullYear()} HIVE SYSTEMS.</span>
            <span className="hidden sm:inline text-slate-350 dark:text-slate-800">•</span>
            <span className="text-slate-550 dark:text-slate-500">
              Hive is a multi-agent AI system and can make mistakes. Please double-check responses.
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-kiwi transition-colors">PRIVACY POLICY</Link>
            <Link href="/terms" className="hover:text-kiwi transition-colors">TERMS OF SERVICE</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-kiwi transition-colors">GITHUB</a>
          </div>
        </footer>
      </main>

      {/* Guest Rate Limit Modal */}
      {showGuestLimitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl w-[550px] max-w-full shadow-2xl relative overflow-hidden backdrop-blur-xl animate-[in_0.2s_ease-out]">
            {/* Header / Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-tangy to-transparent" />
            
            {/* Close Button */}
            <button
              onClick={() => {
                handleClickSound();
                setShowGuestLimitModal(false);
              }}
              className="absolute top-4 right-4 text-slate-450 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="p-6 md:p-8 space-y-6">
              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight text-white font-mono uppercase flex items-center gap-2">
                  <Radio className="w-5 h-5 text-tangy animate-pulse" /> Login to keep chatting
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  You hit your 2-query message limit. It resets at <span className="text-tangy font-bold">{formatResetTime(rateLimitResetTime)}</span>, or you can login for more runs and history.
                </p>
              </div>

              {/* Feature Cards Grid (Inspired by Claude's modal) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Save Execution History */}
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-kiwi font-bold text-[10px] tracking-wider font-mono uppercase">
                    <History className="w-3.5 h-3.5" /> Save History
                  </div>
                  <p className="text-[10px] text-slate-450 leading-relaxed">
                    Review and search previous runs, logs, and outputs at any time.
                  </p>
                </div>

                {/* Unlimited runs */}
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-kiwi font-bold text-[10px] tracking-wider font-mono uppercase">
                    <Cpu className="w-3.5 h-3.5" /> Unlimited Runs
                  </div>
                  <p className="text-[10px] text-slate-450 leading-relaxed">
                    Deploy research, coder, and critic agents with higher limits.
                  </p>
                </div>

                {/* Persistent settings */}
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-kiwi font-bold text-[10px] tracking-wider font-mono uppercase">
                    <Settings className="w-3.5 h-3.5" /> System Control
                  </div>
                  <p className="text-[10px] text-slate-450 leading-relaxed">
                    Set a secure operator password and customize system preferences.
                  </p>
                </div>

                {/* Real-time sync */}
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-kiwi font-bold text-[10px] tracking-wider font-mono uppercase">
                    <GitCompare className="w-3.5 h-3.5" /> Core Sync
                  </div>
                  <p className="text-[10px] text-slate-450 leading-relaxed">
                    Persist runs securely to your PostgreSQL database.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    handleClickSound();
                    setShowGuestLimitModal(false);
                  }}
                  className="text-xs font-mono font-bold tracking-wider text-slate-400 hover:text-white"
                >
                  Not now
                </Button>
                <Button
                  onClick={() => {
                    handleClickSound();
                    setShowGuestLimitModal(false);
                    logout(); // Trigger logout to return to Login Card
                  }}
                  className="bg-kiwi hover:bg-kiwi/90 text-slate-950 font-bold font-mono text-xs tracking-wider px-5 py-2 rounded-lg"
                >
                  Login
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
