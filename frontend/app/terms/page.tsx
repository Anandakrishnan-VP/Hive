"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Scale, HelpCircle, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function TermsPage() {
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
              <Scale className="w-8 h-8 text-kiwi" /> Terms of Service
            </h1>
            <p className="text-xs font-mono text-slate-500 mt-2 uppercase tracking-wider">
              Last Updated: May 29, 2026
            </p>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-kiwi shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-mono font-bold uppercase text-white">Agent Operations</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Hive operates an autonomous multi-agent graph. System actions are guided by LLMs.</p>
              </div>
            </div>
            <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-kiwi shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-mono font-bold uppercase text-white">Accuracy Disclaimer</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">AI outputs can contain errors or hallucinations. Double-checking response code and content is required.</p>
              </div>
            </div>
            <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl flex items-start gap-3">
              <FileText className="w-5 h-5 text-kiwi shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-mono font-bold uppercase text-white">Use Policy</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Hive must not be used to build malicious programs, spam, or perform unauthorized testing.</p>
              </div>
            </div>
          </div>

          {/* Terms Text */}
          <article className="prose prose-invert max-w-none text-xs text-slate-350 font-mono space-y-6 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-900 pb-1.5 mt-6">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using the Hive core system, dashboard, and agent services, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, you are not authorized to use the application.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-900 pb-1.5 mt-6">
                2. Nature of the AI System
              </h2>
              <p>
                Hive is a multi-agent AI system that coordinates specialized LLM-driven workers (Researcher, Coder, Writer, Critic). You acknowledge that AI agents are probabilistic systems. Outputs, recommendations, search results, and generated programming code may contain errors, omissions, or hallucinations. You are responsible for reviewing, testing, and verifying all final code and reports before use.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-900 pb-1.5 mt-6">
                3. Acceptable Use Policy
              </h2>
              <p>
                You agree not to use Hive to:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Generate, test, or distribute malware, viruses, or security exploits.</li>
                <li>Conduct denial of service, network intrusions, or other cyberattacks.</li>
                <li>Infringe upon the intellectual property or data privacy rights of others.</li>
                <li>Violate policies, rate limits, or safety guidelines of underlying LLM api providers.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-900 pb-1.5 mt-6">
                4. Intellectual Property
              </h2>
              <p>
                As between you and Hive Systems, you own all input prompts and instructions you submit, as well as the resulting reports and generated files output by the agent swarm. You grant Hive Systems a limited license to store, process, and display this content as necessary to execute the agent tasks.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono border-b border-slate-900 pb-1.5 mt-6">
                5. Limitation of Liability
              </h2>
              <p>
                Hive is provided "as is" and "as available" without any warranty of any kind. Under no circumstances shall Hive Systems be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use the platform, including but not limited to code errors, data loss, search inaccuracies, or server downtime.
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
