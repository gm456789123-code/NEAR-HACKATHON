"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Shield,
  CheckCircle2,
  FileText,
  Users,
  Settings,
  User,
  ChevronDown,
  Hexagon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/policy", label: "Policy", icon: Shield },
  { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/audit", label: "Audit Log", icon: FileText },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[#14281e] bg-[#060a08]">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#14281e]/70">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#00ec97]/15 text-[#00ec97] border border-[#00ec97]/40 shadow-[0_0_15px_rgba(0,236,151,0.2)]">
          <Hexagon className="h-5 w-5 fill-[#00ec97]/20" />
          <span className="absolute h-2 w-2 rounded-full bg-[#00ec97] animate-ping opacity-75" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight tracking-tight text-white">Treasury Mesh</p>
          <p className="text-[11px] text-[#00ec97] font-medium tracking-wide">NEAR Agent Protocol</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
                active
                  ? "border border-[#00ec97] bg-[#00ec97]/10 text-[#00ec97] shadow-[0_0_15px_rgba(0,236,151,0.15)]"
                  : "text-[#8ea998] hover:text-white hover:bg-[#0f1f16]/60"
              )}
            >
              <Icon className={cn("h-4.5 w-4.5", active ? "text-[#00ec97]" : "text-[#8ea998]")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-4 rounded-xl border border-[#14281e] bg-[#0b140f] p-3 shadow-sm hover:border-[#00ec97]/40 transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00ec97]/15 text-[#00ec97] border border-[#00ec97]/30">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00ec97] shadow-[0_0_6px_#00ec97]" />
              <p className="text-xs font-semibold leading-tight text-white truncate">
                treasury-mesh.testnet
              </p>
            </div>
            <p className="text-[11px] text-[#6b8f7c] truncate mt-0.5">
              Policy Engine · Admin
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-[#6b8f7c] shrink-0" />
        </div>
      </div>
    </aside>
  );
}
