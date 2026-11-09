"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChartCard, LegBarCard, PkgPieCard, GasChartCard } from "@/components/analytics/charts";
import { UserAvatar, PkgBadge, SideChip, fmtMoney } from "@/components/shared";
import { DEFAULT_GAS, placementGas, type MatrixUser } from "@/lib/indexer";
import type { NetworkSnapshot } from "@/lib/api-types";
import { BarChart3, Coins, GitMerge, Users } from "lucide-react";

export function AnalyticsView({ snap }: { snap: NetworkSnapshot }) {
  const stats = useMemo(() => {
    const matching = snap.earnings.filter((e) => e.kind === "MATCHING" && e.status !== "REVERSED").reduce((s, e) => s + e.amount, 0);
    const referral = snap.earnings.filter((e) => e.kind === "REFERRAL" && e.status !== "REVERSED").reduce((s, e) => s + e.amount, 0);
    const pool = snap.earnings.filter((e) => e.kind === "SPLIT_POOL" && e.status !== "REVERSED").reduce((s, e) => s + e.amount, 0);
    const spillover = snap.users.filter((u) => u.sponsorId !== u.parentId).length;
    const suspended = snap.users.filter((u) => u.status === "SUSPENDED").length;
    const grace = snap.users.filter((u) => u.status === "GRACE").length;
    const top = [...snap.users].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 8);
    return { matching, referral, pool, spillover, suspended, grace, top };
  }, [snap]);

  const gasPoints = useMemo(() => [10, 50, 200, 1000, 5000].map((N) => placementGas(N, DEFAULT_GAS)), []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Network analytics</h1>
        <p className="text-sm text-slate-500">Ledger-level truth, recomputed by the indexer on every chain event</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Coins} tint="emerald" label="Matching bonuses paid" value={fmtMoney(stats.matching)} sub="10% of weaker leg · tier-capped" />
        <Kpi icon={BarChart3} tint="indigo" label="Referral splits paid" value={fmtMoney(stats.referral)} sub="12% compressed · instant" />
        <Kpi icon={GitMerge} tint="violet" label="Spillover placements" value={String(stats.spillover)} sub={`${stats.suspended} suspended · ${stats.grace} in grace`} />
        <Kpi icon={Users} tint="amber" label="Upline pool routed" value={fmtMoney(stats.pool)} sub="via SafetyHolding · 72h release" />
      </div>

      <AreaChartCard earnings={snap.earnings} />

      <div className="grid gap-4 xl:grid-cols-2">
        <LegBarCard users={snap.users} rootId={1001} />
        <PkgPieCard users={snap.users} />
      </div>

      <GasChartCard points={gasPoints} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top earners</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">#</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Package</TableHead>
                <TableHead className="text-right">Leg volume</TableHead>
                <TableHead className="pr-5 text-right">Total earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.top.map((u, i) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-5 text-xs font-bold text-slate-400">{i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <UserAvatar user={u} size={26} />
                      <span className="text-[13px] font-medium">{u.name} <span className="text-slate-400">#{u.id}</span></span>
                    </div>
                  </TableCell>
                  <TableCell><SideChip side={u.side} /></TableCell>
                  <TableCell><PkgBadge pkg={u.package} /></TableCell>
                  <TableCell className="text-right text-xs text-slate-600">{fmtMoney(u.leftVol + u.rightVol)}</TableCell>
                  <TableCell className="pr-5 text-right text-xs font-semibold text-emerald-600">{fmtMoney(u.totalEarned)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const TINTS = {
  emerald: "bg-emerald-50 text-emerald-600",
  indigo: "bg-indigo-50 text-indigo-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
} as const;

function Kpi({ icon: Icon, tint, label, value, sub }: { icon: typeof Users; tint: keyof typeof TINTS; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TINTS[tint]}`}><Icon className="h-4 w-4" /></span>
        </div>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
      </CardContent>
    </Card>
  );
}

export type { MatrixUser };
