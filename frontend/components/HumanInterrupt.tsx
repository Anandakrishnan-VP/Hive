"use client";

import React, { useState } from "react";
import { MessageSquareCode, Send, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

interface HumanInterruptProps {
  runId: string | null;
  status: "idle" | "running" | "complete" | "error";
  onInterrupted: () => void;
}

export function HumanInterrupt({ runId, status, onInterrupted }: HumanInterruptProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runId || !instruction.trim()) return;

    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    try {
      const response = await fetch(`${apiUrl}/api/runs/${runId}/interrupt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instruction }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit steer instruction");
      }

      toast.success("Steer instruction injected!", {
        description: "The supervisor has been interrupted and will incorporate your guidance.",
      });
      setInstruction("");
      onInterrupted();
    } catch (err: any) {
      console.error(err);
      toast.error("Interruption failed", {
        description: err.message || "Could not inject instruction.",
      });
    } finally {
      setLoading(false);
    }
  };

  const isEnabled = status === "running" && !!runId;

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-950/80 p-5 shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-2 mb-3.5">
        <div className="p-1.5 bg-kiwi/15 rounded-lg text-kiwi">
          <MessageSquareCode className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Human-in-the-Loop Steering</h3>
          <p className="text-[11px] text-slate-500">Inject guidelines to override supervisor plan mid-run</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          placeholder={
            isEnabled
              ? "Steer agent: 'Please include more details on...' or 'Fix the python code in the example...'"
              : "Steering inactive. Start a run first."
          }
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={!isEnabled || loading}
          className="min-h-[70px] bg-slate-900 border-slate-800 text-xs text-slate-300 placeholder:text-slate-600 focus-visible:ring-kiwi"
        />
        <Button
          type="submit"
          disabled={!isEnabled || !instruction.trim() || loading}
          className="w-full bg-kiwi hover:bg-kiwi/90 text-slate-950 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-kiwi/15"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {loading ? "Injecting steer..." : "Steer Agent"}
        </Button>
      </form>
    </div>
  );
}
