"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAvatar, StatusBadge, PkgBadge, SideChip, EventIcon, timeAgo, fmtMoney, fmtUsdt } from "@/components/shared";
import { AreaChartCard, LegBarCard, PkgPieCard } from "@/components/analytics/charts";
import { InviteDialog } from "@/components/dashboard/InviteDialog";
import { useApp } from "@/store/app";
import { fmtCompact, type MatrixUser } from "@/lib/indexer";
import type { NetworkSnapshot } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { Users, Wallet, TimerReset, Copy, GitBranch, UserPlus, TrendingUp, Scale, Search, Rocket, Sparkles } from "lucide-react";

export function DashboardView({ snap, onRefresh }: { snap: NetworkSnapshot; onRefresh: () => void }) {
  const { identity, setView, setFeedOpen } = useApp();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState("");

  const me = snap.users.find((u) => u.id === (identity?.userId ?? 1001)) ?? snap.users[0];
  const isFounder = me.id === 1001;

  const derived = useMemo(() => {
    const kids = snap.users.filter((u) => u.parentId === me.id);
    const downline = snap.users.filter((u) => u.id !== me.id && isDescendant(snap.users, u.id, me.id));
    const orgSize = downline.length;
    const weak = Math.min(me.leftVol, me.rightVol);
    const strong = Math.max(me.leftVol, me.rightVol);
    const myEarnings = snap.earnings.filter((e) => e.userId === me.id);
    const totalEarned = me.totalEarned;
    const last7 = myEarnings.filter((e) => Date.now() - new Date(e.createdAt).getTime() < 7 * 86400000);
    const spilloverCount = snap.users.filter((u) => u.sponsorId !== u.parentId).length;
    return { kids, downline, orgSize, weak, strong, myEarnings, totalEarned, last7, spilloverCount };
  }, [snap, me]);

  const weakPct = derived.strong > 0 ? (derived.weak / derived.strong) * 100 : 50;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...derived.downline].sort((a, b) => a.id - b.id);
    if (!q) return list;
    return list.filter((u) => u.name.toLowerCase().includes(q) || String(u.id).includes(q));
  }, [derived.downline, query]);

  const copyRef = () => {
    navigator.clipboard.writeText(`https://binarymatrix.demo/join?ref=${me.id}`)
      .then(() => useApp.getState().setFeedOpen(false))
      .catch(() => {});
    import("sonner").then(({ toast }) => toast.success("Referral link copied", { description: `ref=${me.id}` }));
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3.5">
          <UserAvatar user={me} size={46} />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {identity?.isNew ? `Welcome aboard, ${me.name.split(" ")[0]}` : `Welcome back, ${me.name.split(" ")[0]}`}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 font-semibold text-indigo-700">#{me.id}</Badge>
              <PkgBadge pkg={me.package} />
              <StatusBadge status={me.status} />
              {me.isFounder && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] font-semibold text-violet-700">FOUNDER</Badge>}
              <span className="hidden font-mono sm:inline">{me.wallet}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyRef}><Copy className="mr-1.5 h-3.5 w-3.5" /> Referral link</Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Simulate join
          </Button>
        </div>
      </div>

      {identity?.isNew && (
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Sparkles className="h-5 w-5 shrink-0 text-indigo-600" />
            <p className="flex-1 text-sm text-slate-700">
              <b>Your position is live.</b> You were placed via off-chain BFS with spillover protection. Simulate your first referral to watch fee splits route to your upline — every split above you lands in <b>SafetyHolding</b> for 72h.
            </p>
            <Button size="sm" className="shrink-0 bg-indigo-600 hover:bg-indigo-700" onClick={() => setInviteOpen(true)}>
              <Rocket className="mr-1.5 h-3.5 w-3.5" /> Invite member
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} tint="emerald" label="Total earned" value={fmtMoney(derived.totalEarned, 0)} sub={`${derived.last7.length} payouts · last 7d`} />
        <Kpi icon={TimerReset} tint="amber" label="Held in SafetyHolding" value={fmtMoney(me.heldAmount, 0)} sub="72h upline protection window" />
        <Kpi icon={Users} tint="indigo" label="Network size" value={fmtCompact(derived.orgSize)} sub={`${derived.kids.length} direct · L${me.depth + 1} deep`} />
        <Kpi icon={Scale} tint="violet" label="Weaker leg volume" value={fmtMoney(derived.weak, 0)} sub={`balance ${weakPct.toFixed(0)}% of strong leg`} />
      </div>

      {/* leg balance */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-indigo-500" /> LEFT LEG · {fmtMoney(me.leftVol)}</span>
            <span className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5 text-slate-400" /> LEG BALANCE</span>
            <span className="flex items-center gap-1.5">RIGHT LEG · {fmtMoney(me.rightVol)} <span className="h-2 w-2 rounded-sm bg-violet-500" /></span>
          </div>
          <div className="flex h-3 gap-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-l-full bg-gradient-to-r from-indigo-500 to-indigo-400" style={{ width: `${me.leftVol + me.rightVol > 0 ? (me.leftVol / (me.leftVol + me.rightVol)) * 100 : 50}%` }} />
            <div className="h-full flex-1 rounded-r-full bg-gradient-to-r from-violet-400 to-violet-500" />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Binary matching pays on the <b>weaker</b> leg — currently {weakPct < 60 ? "well balanced" : "one-sided"} · {derived.spilloverCount} nodes placed via spillover network-wide</p>
        </CardContent>
      </Card>

      {/* charts row */}
      <div className="grid gap-4 xl:grid-cols-3">
        <AreaChartCard className="xl:col-span-2" earnings={derived.myEarnings} />
        <LivePreview onOpen={() => setFeedOpen(true)} events={snap.events.slice(0, 7)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <LegBarCard users={snap.users} rootId={me.id} />
        <PkgPieCard users={snap.users} />
      </div>

      {/* downline table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Downline directory</CardTitle>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or #id" className="h-8 pl-8 text-xs" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <TableRow>
                  <TableHead className="pl-5">Member</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Lvl</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Leg volume</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                  <TableHead className="pr-5 text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 60).map((u) => (
                  <TableRow key={u.id} className="cursor-pointer" onClick={() => setView("matrix")}>
                    <TableCell className="py-2.5 pl-5">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar user={u} size={28} />
                        <div>
                          <p className="text-[13px] font-medium leading-tight text-slate-800">{u.name}</p>
                          <p className="text-[11px] text-slate-400">#{u.id} · sponsor #{u.sponsorId ?? "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><SideChip side={u.side} /></TableCell>
                    <TableCell className="text-xs text-slate-500">L{u.depth}</TableCell>
                    <TableCell><PkgBadge pkg={u.package} /></TableCell>
                    <TableCell><StatusBadge status={u.status} /></TableCell>
                    <TableCell className="text-right text-xs font-medium text-slate-700">{fmtCompact(u.leftVol + u.rightVol)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold text-emerald-600">{u.totalEarned > 0 ? fmtMoney(u.totalEarned) : "—"}</TableCell>
                    <TableCell className="pr-5 text-right text-xs text-slate-400">{timeAgo(u.joinedAt)}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-slate-400">No downline yet — simulate your first join above.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 60 && <p className="border-t border-slate-100 py-2 text-center text-[11px] text-slate-400">Showing 60 of {filtered.length} — refine your search</p>}
        </CardContent>
      </Card>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} snap={snap} sponsorId={me.id} onDone={onRefresh} />
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function isDescendant(users: MatrixUser[], id: number, ofId: number): boolean {
  const byId = new Map(users.map((u) => [u.id, u]));
  let cur = byId.get(id)?.parentId ?? null;
  while (cur != null) {
    if (cur === ofId) return true;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

const TINTS = {
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  indigo: "bg-indigo-50 text-indigo-600",
  violet: "bg-violet-50 text-violet-600",
} as const;

function Kpi({ icon: Icon, tint, label, value, sub }: { icon: typeof Users; tint: keyof typeof TINTS; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", TINTS[tint])}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
      </CardContent>
    </Card>
  );
}

function LivePreview({ events, onOpen }: { events: NetworkSnapshot["events"]; onOpen: () => void }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Chain activity</CardTitle>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-indigo-600" onClick={onOpen}>
          <TrendingUp className="h-3 w-3" /> Open live feed
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <div className="divide-y divide-slate-50">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-2.5 px-5 py-2">
              <EventIcon type={e.type} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-slate-700">{e.headline}</p>
                <p className="text-[10px] text-slate-400">{timeAgo(e.createdAt)}</p>
              </div>
              {e.amount != null && (
                <span className="shrink-0 text-[11px] font-semibold text-emerald-600">{fmtUsdt(e.amount)}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
