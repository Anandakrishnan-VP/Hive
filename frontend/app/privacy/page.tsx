"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 dark:bg-black text-slate-100 font-sans flex flex-col justify-between selection:bg-kiwi/30 selection:text-white">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-kiwi/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="border-b border-slate-900 bg-black/40 backdrop-blur-md relative z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link 
            href="/"
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-kiwi transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-kiwi/10 rounded-lg text-kiwi border border-kiwi/20 shadow-md">
              <Logo className="w-4 h-4 text-current" hideBackgroundPath />
            </div>
            <span className="font-bold text-xs tracking-widest uppercase font-mono text-white">
              HIVE CORE
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full relative z-10">
        <div className="space-y-8">
          {/* Page Title */}
          <div className="border-b border-slate-900 pb-6">
            <h1 className="text-3xl font-bold tracking-tight text-white font-mono uppercase flex items-center gap-3">
              <Shield className="w-8 h-8 text-kiwi" /> Privacy Policy
            </h1>
            <p className="text-xs font-mono text-slate-500 mt-2 uppercase tracking-wider">
              Last Updated: May 29, 2026
            </p>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl flex items-start gap-3">
              <Lock className="w-5 h-5 text-kiwi shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-mono font-bold uppercase text-white">Data Security</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Your prompt inputs and session history are securely stored and encrypted.</p>
              </div>
            </div>
            <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl flex items-start gap-3">
              <Eye className="w-5 h-5 text-kiwi shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-mono font-bold uppercase text-white">Transparency</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">We only use input data to run agent tasks and do not sell information to third parties.</p>
              </div>
            </div>
            <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl flex items-start gap-3">
              <FileText className="w-5 h-5 text-kiwi shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-mono font-bold uppercase text-white">Compliance</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Designed in alignment with standard digital safety and data protection guidelines.</p>
              </div>
            </div>
          </div>

          {/* Policy Text */}
          <article className="prose prose-invert max-w-none text-xs text-slate-350 font-mono space-y-6 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-900 pb-1.5 mt-6">
                1. Information We Collect
              </h2>
              <p>
                To provide the multi-agent task execution services, Hive collects the prompts and instructions you submit to the agent swarm. This includes text prompts, code snippet uploads, and human feedback provided during execution interrupts.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-900 pb-1.5 mt-6">
                2. How We Use Information
              </h2>
              <p>
                We use the collected inputs solely to coordinate agent execution flows, prompt LLM specialists (such as the Researcher, Coder, and Writer agents), store task history for your convenience in the dashboard, and improve system responses. We do not use your proprietary prompts to train global models without your explicit consent.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-900 pb-1.5 mt-6">
                3. Security and Storage
              </h2>
              <p>
                All data transmitted between the frontend and the FastAPI server is secured via encrypted SSL and WebSocket connections. Database backups and task archives are isolated and stored securely with strict access control.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-900 pb-1.5 mt-6">
                4. Third-Party Services
              </h2>
              <p>
                Hive uses third-party APIs (such as Groq and Google Search) to fulfill agent tasks. Any information passed to these services is strictly limited to the search terms or prompts required for execution and is governed by their respective privacy terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-900 pb-1.5 mt-6">
                5. Your Choices and Data Deletion
              </h2>
              <p>
                You can clear your task history at any time. When you request task deletion, the corresponding run logs, database entries, and agent outputs are permanently removed from our active databases.
              </p>
            </section>
          </article>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-slate-900 bg-black/90 backdrop-blur-sm text-center text-[9px] text-slate-500 font-mono relative z-10">
        © {new Date().getFullYear()} HIVE SYSTEMS. HIVE IS A MULTI-AGENT AI ORCHESTRATION PLATFORM.
      </footer>
    </div>
  );
}
