"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, CheckCheck } from "lucide-react";
import {
  AgentEmblem,
  PolicyShieldIcon,
  ApprovalWorkflowIcon,
  NearTokenIcon,
} from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PendingRequest, PolicyView } from "@/lib/near";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
}

const QUICK_ACTIONS = [
  { label: "Check policy", icon: PolicyShieldIcon },
  { label: "Show approvals", icon: ApprovalWorkflowIcon },
  { label: "What's my balance?", icon: NearTokenIcon },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: "m1",
    role: "agent",
    text: "Treasury agent online. I can check policy limits, review pending approvals, or execute an allowed payment. What would you like to do?",
  },
];

async function describePolicy(): Promise<string> {
  const res = await fetch("/api/policy");
  const data: PolicyView | { error: string } = await res.json();
  if ("error" in data) return `Couldn't read the policy: ${data.error}`;
  const remaining = Number(data.daily_limit) - Number(data.daily_spent_today);
  return [
    `Daily limit: ${data.daily_limit} (spent ${data.daily_spent_today} today, ${remaining.toString()} remaining)`,
    `Per-transaction limit: ${data.per_tx_limit}`,
    `Auto-approve below: ${data.auto_approve_below}`,
    data.paused ? "The policy engine is currently paused." : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

async function describeApprovals(): Promise<string> {
  const res = await fetch("/api/approvals");
  const data: PendingRequest[] | { error: string } = await res.json();
  if ("error" in data) return `Couldn't read approvals: ${data.error}`;
  if (data.length === 0) return "No pending approvals right now.";
  return data
    .map((r) => `#${r.id.toString()} — ${r.amount} to ${r.counterparty} (${r.reason})`)
    .join("\n");
}

async function describeBalance(): Promise<string> {
  const res = await fetch("/api/policy");
  const data: PolicyView | { error: string } = await res.json();
  if ("error" in data) return `Couldn't read the policy: ${data.error}`;
  const remaining = Number(data.daily_limit) - Number(data.daily_spent_today);
  return `${remaining.toString()} remaining out of today's ${data.daily_limit} daily limit.`;
}

async function runPaymentTask(task: string): Promise<string> {
  const res = await fetch("/api/agent/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
  const data: { reply?: string; error?: string } = await res.json();
  return data.reply ?? data.error ?? "Something went wrong.";
}

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    try {
      let reply: string;
      if (text === "Check policy") {
        reply = await describePolicy();
      } else if (text === "Show approvals") {
        reply = await describeApprovals();
      } else if (text === "What's my balance?") {
        reply = await describeBalance();
      } else {
        reply = await runPaymentTask(text);
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "agent", text: reply },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: err instanceof Error ? err.message : "Something went wrong.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-1 flex-col min-w-0 min-h-0 h-full overflow-hidden bg-[#060a08]">
      <header className="shrink-0 flex items-center justify-between border-b border-[#14281e] px-6 py-4 bg-[#080d0a]/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#00ec97]/15 text-[#00ec97] border border-[#00ec97]/30 shadow-[0_0_15px_rgba(0,236,151,0.2)]">
            <AgentEmblem className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold leading-none text-white">
                AI Treasury Agent
              </h1>
              <Sparkles className="h-4 w-4 text-[#00ec97] animate-pulse" />
            </div>
            <p className="text-xs text-[#8ea998] mt-1">
              Autonomous Treasury Orchestrator · NEAR Testnet
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#00ec97]/40 bg-[#00ec97]/10 px-3 py-1 text-xs font-semibold text-[#00ec97] shadow-[0_0_10px_rgba(0,236,151,0.15)]">
          <span className="h-2 w-2 rounded-full bg-[#00ec97] animate-pulse shadow-[0_0_8px_#00ec97]" />
          <span>Online</span>
        </div>
      </header>

      <ScrollArea className="flex-1 min-h-0 px-6 py-5">
        <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-2xl text-sm whitespace-pre-line break-words transition-all",
                m.role === "user"
                  ? "self-end bg-gradient-to-r from-[#00ec97]/25 to-[#00ec97]/15 border border-[#00ec97]/40 text-white px-5 py-3.5 max-w-[78%] ml-auto shadow-[0_0_15px_rgba(0,236,151,0.1)]"
                  : "self-start bg-[#0b140f] border border-[#14281e] text-[#f3fbf6] p-4 max-w-[85%] mr-auto rounded-2xl shadow-sm hover:border-[#00ec97]/30"
              )}
            >
              {m.role === "agent" && (
                <div className="flex items-center justify-between border-b border-[#14281e] pb-2 mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00ec97]">
                    <PolicyShieldIcon className="h-3.5 w-3.5" />
                    <span>Treasury Orchestrator</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[#6b8f7c]">
                    <span>Verified</span>
                    <CheckCheck className="h-3 w-3 text-[#00ec97]" />
                  </div>
                </div>
              )}
              <div className="leading-relaxed">{m.text}</div>
            </div>
          ))}
          {busy && (
            <div className="self-start rounded-2xl bg-[#0b140f] border border-[#00ec97]/30 px-5 py-3 text-sm text-[#00ec97] shadow-[0_0_12px_rgba(0,236,151,0.15)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00ec97] animate-ping" />
              <span>Thinking & verifying on-chain policy…</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-[#14281e] p-4 bg-[#080d0a]/90 backdrop-blur-md">
        <div className="flex flex-wrap gap-2 pb-3 max-w-4xl mx-auto">
          {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              disabled={busy}
              onClick={() => {
                void send(label);
              }}
              className="flex items-center gap-2 rounded-xl border border-[#14281e] bg-[#0b140f] px-3.5 py-1.5 text-xs font-medium text-[#8ea998] hover:border-[#00ec97]/50 hover:bg-[#00ec97]/10 hover:text-white transition-all shadow-sm disabled:opacity-50"
            >
              <Icon className="h-3.5 w-3.5 text-[#00ec97]" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex gap-2 max-w-4xl mx-auto"
        >
          <Input
            value={input}
            disabled={busy}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            placeholder="Ask the treasury agent (e.g. 'Pay 1 to alice.testnet for API usage')..."
            className="flex-1 rounded-xl bg-[#0b140f] border-[#14281e] text-white placeholder:text-[#6b8f7c] focus:border-[#00ec97]/60 focus:ring-1 focus:ring-[#00ec97]/50 py-5"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy}
            className="h-11 w-11 rounded-xl bg-[#00ec97] text-[#050806] hover:bg-[#00d688] hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,236,151,0.3)] shrink-0"
          >
            <Send className="h-4.5 w-4.5" />
          </Button>
        </form>
      </div>
    </section>
  );
}
