"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface AgentEvent {
  type: "agent_start" | "tool_call" | "tool_result" | "agent_end" | "complete" | "error" | "cancelled" | "ping";
  agent: "supervisor" | "researcher" | "coder" | "writer" | "critic";
  data: any;
  step: number;
  timestamp: string;
}

export function useAgentSocket() {
  const [status, setStatus] = useState<"idle" | "running" | "complete" | "error" | "cancelled">("idle");
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [finalOutput, setFinalOutput] = useState<string>("");
  const [stepCount, setStepCount] = useState<number>(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeRunIdRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback((runId: string, token?: string | null) => {
    disconnect();
    activeRunIdRef.current = runId;
    setStatus("running");
    setEvents([]);
    setFinalOutput("");
    setStepCount(0);
    setCurrentAgent("supervisor");

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/ws/${runId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected");
    };

    socket.onmessage = (event) => {
      try {
        const payload: AgentEvent = JSON.parse(event.data);
        if (payload.type === "ping") return; // ignore keep-alives

        setEvents((prev) => [...prev, payload]);
        if (payload.step > 0) {
          setStepCount(payload.step);
        }

        if (payload.agent) {
          setCurrentAgent(payload.agent);
        }

        switch (payload.type) {
          case "agent_start":
            setStatus("running");
            break;
          case "complete":
            setStatus("complete");
            setCurrentAgent(null);
            if (payload.data?.final_output) {
              setFinalOutput(payload.data.final_output);
            }
            disconnect();
            break;
          case "error":
            setStatus("error");
            setCurrentAgent(null);
            disconnect();
            break;
          case "cancelled":
            setStatus("cancelled");
            setCurrentAgent(null);
            disconnect();
            break;
          default:
            break;
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
    };
  }, [disconnect]);

  const reset = useCallback(() => {
    disconnect();
    activeRunIdRef.current = null;
    setStatus("idle");
    setCurrentAgent(null);
    setEvents([]);
    setFinalOutput("");
    setStepCount(0);
  }, [disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    setStatus,
    currentAgent,
    setCurrentAgent,
    events,
    setEvents,
    finalOutput,
    setFinalOutput,
    stepCount,
    setStepCount,
    connect,
    disconnect,
    reset,
  };
}
