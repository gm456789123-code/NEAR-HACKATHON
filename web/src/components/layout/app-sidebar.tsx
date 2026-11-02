"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  ClipboardCheck,
  ScrollText,
  Bot,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Chat", icon: ShieldCheck },
  { href: "/policy", label: "Policy", icon: ShieldCheck },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ShieldCheck className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">Treasury Mesh</p>
          <p className="text-xs text-muted-foreground">Autonomous Agents</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-4 flex items-center gap-3 rounded-md border border-border bg-background px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15 text-success">
          <Wallet className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium leading-none">treasury.testnet</p>
          <p className="text-xs text-success">Connected · NEAR testnet</p>
        </div>
      </div>
    </aside>
  );
}
