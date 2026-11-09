"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EarningDTO, MatrixUser } from "@/lib/api-types";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCompact, fmtMoney } from "@/lib/indexer";

const C = { indigo: "#6366f1", violet: "#8b5cf6", emerald: "#10b981", amber: "#f59e0b", slate: "#94a3b8", rose: "#f43f5e" };

function ChartTip({ active, payload, label, prefix }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string; prefix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label != null && <p className="mb-1 font-semibold text-slate-700">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b className="text-slate-800">{prefix === "$" ? fmtMoney(p.value) : fmtCompact(p.value)}{prefix && prefix !== "$" ? ` ${prefix}` : ""}</b>
        </p>
      ))}
    </div>
  );
}

/** Cumulative + daily earnings area chart (last 30 days of the ledger). */
export function AreaChartCard({ className, earnings }: { className?: string; earnings: EarningDTO[] }) {
  const data = useMemo(() => {
    const days: { day: string; label: string; earned: number; cum: number }[] = [];
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      days.push({ day: d.toISOString().slice(0, 10), label: `${d.getMonth() + 1}/${d.getDate()}`, earned: 0, cum: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.day, i]));
    for (const e of earnings) {
      if (e.status === "REVERSED") continue;
      const key = e.createdAt.slice(0, 10);
      const i = idx.get(key);
      if (i != null) days[i].earned += e.amount;
    }
    let run = 0;
    for (const d of days) { run += d.earned; d.cum = +run.toFixed(2); }
    return days;
  }, [earnings]);

  return (
    <Card className={className}>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Earnings flow · last 30 days</CardTitle>
        <p className="text-xs text-slate-400">Referral + matching + campaign splits, as settled by CampaignManager &amp; SafetyHolding</p>
      </CardHeader>
      <CardContent className="h-[260px] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gEarn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.indigo} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.indigo} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gCum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.emerald} stopOpacity={0.25} />
                <stop offset="100%" stopColor={C.emerald} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={4} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompact(v)} />
            <Tooltip content={<ChartTip prefix="$" />} />
            <Area type="monotone" dataKey="cum" name="Cumulative" stroke={C.emerald} strokeWidth={2} fill="url(#gCum)" />
            <Area type="monotone" dataKey="earned" name="Daily" stroke={C.indigo} strokeWidth={2} fill="url(#gEarn)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/** Left vs right subtree volume per level — the binary balance picture. */
export function LegBarCard({ className, users, rootId }: { className?: string; users: MatrixUser[]; rootId: number }) {
  const data = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    const kidsOf = new Map<number, MatrixUser[]>();
    for (const u of users) {
      if (u.parentId == null) continue;
      kidsOf.set(u.parentId, [...(kidsOf.get(u.parentId) ?? []), u]);
    }
    const vol = (id: number): number => (kidsOf.get(id) ?? []).reduce((s, c) => s + vol(c.id), byId.get(id)?.pkgAmount ?? 0);
    const levels: { level: string; left: number; right: number }[] = [];
    let side = rootId;
    for (let d = 1; d <= 6; d++) {
      const l = kidsOf.get(side)?.find((c) => c.side === "L");
      const r = kidsOf.get(side)?.find((c) => c.side === "R");
      levels.push({ level: `L${d}`, left: l ? vol(l.id) : 0, right: r ? vol(r.id) : 0 });
      // descend the stronger side to keep the picture useful
      const next = (l ? vol(l.id) : 0) >= (r ? vol(r.id) : 0) ? l : r;
      if (!next) break;
      side = next.id;
    }
    return levels;
  }, [users, rootId]);

  return (
    <Card className={className}>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Leg volumes down the tree</CardTitle>
        <p className="text-xs text-slate-400">Left/right subtree value at each level, descending the strongest leg</p>
      </CardHeader>
      <CardContent className="h-[240px] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="level" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompact(v)} />
            <Tooltip content={<ChartTip prefix="$" />} cursor={{ fill: "rgba(99,102,241,0.06)" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="left" name="Left leg" fill={C.indigo} radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="right" name="Right leg" fill={C.violet} radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const PKG_COLORS: Record<string, string> = { STARTER: C.slate, GROWTH: C.indigo, SCALE: C.violet };

export function PkgPieCard({ className, users }: { className?: string; users: MatrixUser[] }) {
  const data = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of users) m.set(u.package, (m.get(u.package) ?? 0) + 1);
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [users]);

  return (
    <Card className={className}>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Package mix</CardTitle>
        <p className="text-xs text-slate-400">Activation tiers across the matrix — drives cap headroom</p>
      </CardHeader>
      <CardContent className="h-[240px] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} strokeWidth={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={PKG_COLORS[d.name] ?? C.slate} />
              ))}
            </Pie>
            <Tooltip content={<ChartTip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/** Gas: on-chain BFS vs PortaGraph off-chain sync, from the stated model. */
export function GasChartCard({ className, points }: { className?: string; points: { N: number; onChainUsd: number; offChainUsd: number; savingPct: number }[] }) {
  const data = points.map((p) => ({ name: `${fmtCompact(p.N)} nodes`, onChain: p.onChainUsd, offChain: p.offChainUsd, saving: p.savingPct }));
  return (
    <Card className={className}>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Placement cost · on-chain BFS vs off-chain sync</CardTitle>
        <p className="text-xs text-slate-400">Model: Base @ 0.05 gwei, ETH $3,200 — see Calculator for full assumptions</p>
      </CardHeader>
      <CardContent className="h-[240px] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<ChartTip prefix="$" />} cursor={{ fill: "rgba(16,185,129,0.06)" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="onChain" name="On-chain BFS" fill={C.rose} radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Bar dataKey="offChain" name="PortaGraph sync" fill={C.emerald} radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export { ChartTip, C as CHART_COLORS };
