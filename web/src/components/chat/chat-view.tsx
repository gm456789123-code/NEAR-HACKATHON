"use client";

import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");

  function send(text: string) {
    if (!text.trim()) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: "Received. The Policy Engine will evaluate this request before any action is taken. (Demo response — orchestrator not yet connected.)",
        },
      ]);
    }, 500);
  }

  return (
    <section className="flex flex-1 flex-col min-w-0">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
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

      <ScrollArea className="flex-1 px-6 py-4">
        <div className="flex flex-col gap-3 max-w-2xl">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-lg px-4 py-2.5 text-sm max-w-[85%]",
                m.role === "user"
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start bg-secondary text-secondary-foreground"
              )}
            >
              {m.text}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <div className="flex flex-wrap gap-2 pb-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => {
                send(action);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            placeholder="Ask the treasury agent..."
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </section>
  );
}
