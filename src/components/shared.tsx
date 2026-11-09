"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MatrixUser } from "@/lib/api-types";
import { Activity, ArrowDownLeft, ArrowUpRight, Coins, GitBranch, Lock, Network, ShieldCheck, Unlock, UserPlus, Zap } from "lucide-react";

// ─── deterministic avatar colors from a seed string ─────────────────────────
const HUES = [243, 262, 190, 160, 330, 28, 210, 280];
export function hueOf(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export function UserAvatar({ user, size = 36 }: { user: Pick<MatrixUser, "name" | "avatarSeed">; size?: number }) {
  const hue = hueOf(user.avatarSeed ?? user.name);
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <Avatar style={{ width: size, height: size }} className="border border-white shadow-sm ring-1 ring-slate-200">
      <AvatarFallback
        style={{ background: `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 40) % 360} 85% 52%))`, fontSize: size * 0.36 }}
        className="font-semibold text-white"
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function StatusBadge({ status }: { status: MatrixUser["status"] }) {
  const map = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    GRACE: "bg-amber-50 text-amber-700 border-amber-200",
    SUSPENDED: "bg-rose-50 text-rose-700 border-rose-200",
  } as const;
  return <Badge variant="outline" className={cn("text-[10px] font-semibold", map[status])}>{status}</Badge>;
}

export function PkgBadge({ pkg }: { pkg: MatrixUser["package"] }) {
  const map = {
    STARTER: "bg-slate-100 text-slate-600 border-slate-200",
    GROWTH: "bg-indigo-50 text-indigo-700 border-indigo-200",
    SCALE: "bg-violet-100 text-violet-700 border-violet-300",
  } as const;
  return <Badge variant="outline" className={cn("text-[10px] font-semibold", map[pkg])}>{pkg}</Badge>;
}

export function SideChip({ side }: { side: MatrixUser["side"] }) {
  if (!side) return <span className="text-[10px] font-medium text-slate-400">ROOT</span>;
  return (
    <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-white", side === "L" ? "bg-indigo-500" : "bg-violet-500")}>
      {side}
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}

// ─── event iconography for the live feed ────────────────────────────────────
export const EVENT_META: Record<string, { icon: typeof Zap; className: string; label: string }> = {
  JOIN: { icon: UserPlus, className: "bg-indigo-50 text-indigo-600 border-indigo-100", label: "Activation" },
  FEE_SPLIT: { icon: Coins, className: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "Fee split" },
  COMPRESSION: { icon: GitBranch, className: "bg-violet-50 text-violet-600 border-violet-100", label: "Compression" },
  HOLD_RELEASE: { icon: Unlock, className: "bg-amber-50 text-amber-600 border-amber-100", label: "Hold released" },
  HOLD_REVERSE: { icon: Lock, className: "bg-rose-50 text-rose-600 border-rose-100", label: "Hold reversed" },
  ACTIVATION: { icon: ShieldCheck, className: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "Re-activated" },
  CAMPAIGN_DEPLOY: { icon: Network, className: "bg-slate-100 text-slate-600 border-slate-200", label: "Campaign" },
};

export function EventIcon({ type, size = "md" }: { type: string; size?: "sm" | "md" }) {
  const meta = EVENT_META[type] ?? { icon: Activity, className: "bg-slate-100 text-slate-500 border-slate-200", label: type };
  const Icon = meta.icon;
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg border", meta.className, size === "sm" ? "h-6 w-6" : "h-8 w-8")}>
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
    </span>
  );
}

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtMoney(n: number, digits = 0) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function fmtUsdt(n: number, digits = 1) {
  return `${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} USDT`;
}

export function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-emerald-600" : "text-rose-600")}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
      {Math.abs(value).toLocaleString()}{suffix}
    </span>
  );
}
