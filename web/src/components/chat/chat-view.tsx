"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  "Check policy",
  "Show approvals",
  "What's my balance?",
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
    <section className="flex flex-1 flex-col min-w-0 min-h-0 h-full overflow-hidden">
      <header className="shrink-0 flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">
              Treasury Orchestrator
            </p>
            <p className="text-xs text-muted-foreground">
              Multi-agent payment system
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-success/40 text-success">
          Online
        </Badge>
      </header>

      <ScrollArea className="flex-1 min-h-0 px-6 py-4">
        <div className="flex flex-col gap-3 w-full">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-lg px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-line break-words",
                m.role === "user"
                  ? "self-end bg-primary text-primary-foreground ml-auto"
                  : "self-start bg-secondary text-secondary-foreground mr-auto"
              )}
            >
              {m.text}
            </div>
          ))}
          {busy && (
            <div className="self-start rounded-lg bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
              Thinking…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border p-4 bg-background">
        <div className="flex flex-wrap gap-2 pb-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              disabled={busy}
              onClick={() => {
                void send(action);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            disabled={busy}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            placeholder="Ask the treasury agent..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={busy}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </section>
  );
}
