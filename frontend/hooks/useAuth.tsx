"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
  loginAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  logout: async () => {},
  loginAsGuest: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if guest mode was active
    if (typeof window !== "undefined" && localStorage.getItem("hive_guest_mode") === "true") {
      setSession({
        access_token: "guest_token",
        token_type: "bearer",
        user: {
          id: "guest_user",
          email: "guest_operator@hive.sys",
        } as any,
      } as any);
      setUser({
        id: "guest_user",
        email: "guest_operator@hive.sys",
      } as any);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      // Mock session for local development
      setSession({
        access_token: "local_dev_user",
        token_type: "bearer",
        user: {
          id: "local_dev_user",
          email: "local_dev_operator@hive.sys",
        } as any,
      } as any);
      setUser({
        id: "local_dev_user",
        email: "local_dev_operator@hive.sys",
      } as any);
      setLoading(false);
      return;
    }

    // 1. Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Error getting initial session:", error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginAsGuest = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hive_guest_mode", "true");
    }
    setSession({
      access_token: "guest_token",
      token_type: "bearer",
      user: {
        id: "guest_user",
        email: "guest_operator@hive.sys",
      } as any,
    } as any);
    setUser({
      id: "guest_user",
      email: "guest_operator@hive.sys",
    } as any);
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("hive_guest_mode");
      }
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setUser(null);
      setSession(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, logout, loginAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
