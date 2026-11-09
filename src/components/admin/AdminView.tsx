"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UserAvatar, StatusBadge, PkgBadge, timeAgo, fmtMoney, fmtUsdt } from "@/components/shared";
import { ancestryChain, type CampaignConfig } from "@/lib/indexer";
import type { CampaignDTO, EarningDTO, NetworkSnapshot } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowDown, Coins, GitBranch, Lock, Plus, RotateCcw, Search, ShieldCheck,
  TimerReset, Unlock, Users, Zap,
} from "lucide-react";

export function AdminView({ snap, onRefresh }: { snap: NetworkSnapshot; onRefresh: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Admin console</h1>
        <p className="text-sm text-slate-500">Campaign registry · upline compression · SafetyHolding signer · node manager</p>
      </div>
      <Tabs defaultValue="campaigns">
        <TabsList className="h-9">
          <TabsTrigger value="campaigns" className="text-xs">Campaigns</TabsTrigger>
          <TabsTrigger value="compression" className="text-xs">Compression</TabsTrigger>
          <TabsTrigger value="holding" className="text-xs">Safety Holding</TabsTrigger>
          <TabsTrigger value="nodes" className="text-xs">Node manager</TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns" className="mt-4"><CampaignsPanel snap={snap} onRefresh={onRefresh} /></TabsContent>
        <TabsContent value="compression" className="mt-4"><CompressionPanel snap={snap} /></TabsContent>
        <TabsContent value="holding" className="mt-4"><HoldingPanel snap={snap} onRefresh={onRefresh} /></TabsContent>
        <TabsContent value="nodes" className="mt-4"><NodesPanel snap={snap} onRefresh={onRefresh} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── campaigns ───────────────────────────────────────────────────────────────
function CampaignsPanel({ snap, onRefresh }: { snap: NetworkSnapshot; onRefresh: () => void }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", entryFee: 500, referralPct: 12, poolPct: 6, treasuryPct: 2, poolDepth: 5, description: "" });
  const [busy, setBusy] = useState(false);

  const toggle = async (c: CampaignDTO) => {
    try {
      const res = await fetch("/api/campaigns", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, active: !c.active }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${c.name} ${!c.active ? "activated" : "paused"}`);
      onRefresh();
    } catch { toast.error("Failed to update campaign"); }
  };

  const create = async () => {
    if (!form.name.trim()) { toast.error("Campaign name required"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`Campaign "${form.name}" deployed`);
      setCreateOpen(false);
      setForm({ name: "", entryFee: 500, referralPct: 12, poolPct: 6, treasuryPct: 2, poolDepth: 5, description: "" });
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deployment failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Deploy campaign
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {snap.campaigns.map((c) => (
          <Card key={c.id} className={cn(!c.active && "opacity-60")}>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-[15px]">{c.name}</CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">{c.description}</p>
              </div>
              <Switch checked={c.active} onCheckedChange={() => toggle(c)} aria-label={`Toggle ${c.name}`} />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                <MiniStat label="ENTRY" value={c.entryFee === 0 ? "FREE" : `${c.entryFee}`} unit={c.entryFee === 0 ? "" : "USDT"} />
                <MiniStat label="REFERRAL" value={`${c.referralPct}%`} />
                <MiniStat label="POOL" value={`${c.poolPct}%`} />
                <MiniStat label="TREASURY" value={`${c.treasuryPct}%`} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-400">
                  <span>SPLIT ALLOCATION</span><span>pool depth {c.poolDepth}</span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${c.referralPct * 2}%` }} />
                  <div className="bg-amber-400" style={{ width: `${c.poolPct * 2}%` }} />
                  <div className="bg-slate-400" style={{ width: `${c.treasuryPct * 2}%` }} />
                </div>
                <div className="mt-1.5 flex gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> referral (instant)</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> pool (72h hold)</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> treasury</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.optIns} opt-ins</span>
                <Badge variant="outline" className={cn("text-[10px]", c.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400")}>
                  {c.active ? "ACTIVE" : "PAUSED"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Deploy new campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Spring Bootcamp" /></div>
            <div className="space-y-1"><Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Seasonal partner incentives" /></div>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Entry fee (USDT)" value={form.entryFee} onChange={(v) => setForm({ ...form, entryFee: v })} />
              <NumField label="Pool depth" value={form.poolDepth} onChange={(v) => setForm({ ...form, poolDepth: v })} min={1} max={12} />
              <NumField label="Referral %" value={form.referralPct} onChange={(v) => setForm({ ...form, referralPct: v })} min={0} max={40} />
              <NumField label="Pool %" value={form.poolPct} onChange={(v) => setForm({ ...form, poolPct: v })} min={0} max={40} />
              <NumField label="Treasury %" value={form.treasuryPct} onChange={(v) => setForm({ ...form, treasuryPct: v })} min={0} max={15} />
            </div>
            <p className="text-[11px] text-slate-400">Total split: {form.referralPct + form.poolPct + form.treasuryPct}% (max 60% · enforced on-chain by CampaignManager)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700">
              {busy ? "Deploying…" : "Deploy campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 py-2">
      <p className="text-[9px] font-bold tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value} {unit && <span className="text-[9px] font-medium text-slate-400">{unit}</span>}</p>
    </div>
  );
}

function NumField({ label, value, onChange, min = 0, max = 100000 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} min={min} max={max}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} className="h-9 text-sm" />
    </div>
  );
}

// ─── compression ─────────────────────────────────────────────────────────────
function CompressionPanel({ snap }: { snap: NetworkSnapshot }) {
  const [nodeId, setNodeId] = useState(1036); // sits under suspended #1021's leg? no — under 1018; deep chain demo
  const node = snap.users.find((u) => u.id === nodeId) ?? snap.users[0];
  const chain = useMemo(() => ancestryChain(snap.users, node.id), [snap.users, node.id]);
  const activeNext = chain.find((c) => c.status === "ACTIVE" || c.status === "GRACE");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Upline path · #{node.id} {node.name}</CardTitle>
          <Select value={String(nodeId)} onValueChange={(v) => setNodeId(Number(v))}>
            <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {snap.users.map((u) => <SelectItem key={u.id} value={String(u.id)}>#{u.id} {u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-xs text-slate-500">
              When a fee split routes up from #{node.id}, suspended ancestors are <b>skipped entirely</b> and their share
              flows to the next eligible ancestor — enforced by <span className="font-mono text-[11px]">CampaignManager.compressedUpline()</span>.
            </p>
          </div>

          <div className="mt-4 space-y-0">
            {/* the node itself */}
            <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
              <UserAvatar user={node} size={32} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">{node.name} <span className="text-xs text-slate-400">#{node.id}</span></p>
                <p className="text-[11px] text-slate-500">Volume source · package {node.package}</p>
              </div>
              <Badge className="border-indigo-200 bg-indigo-100 text-[10px] font-bold text-indigo-700">SPLITS START HERE</Badge>
            </div>

            {chain.map((c, i) => {
              const skipped = c.status === "SUSPENDED";
              return (
                <div key={c.id}>
                  <div className="flex justify-center py-0.5">
                    <ArrowDown className={cn("h-4 w-4", skipped ? "text-rose-300" : "text-slate-300")} />
                  </div>
                  {skipped && i > 0 && chain[i - 1].status !== "SUSPENDED" && (
                    <div className="mb-1 ml-6 w-fit rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                      compression hop — suspended ancestor skipped
                    </div>
                  )}
                  <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3",
                    skipped ? "border-rose-200 bg-rose-50/70" : "border-emerald-200 bg-emerald-50/50")}>
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", skipped ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600")}>
                      {skipped ? <Lock className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                    </span>
                    <div className="flex-1">
                      <p className={cn("text-sm font-semibold", skipped ? "text-slate-400 line-through" : "text-slate-800")}>
                        {c.name} <span className="text-xs text-slate-400">#{c.id}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {skipped ? "would receive — skipped, share flows past" : c.status === "GRACE" ? "receives into SafetyHolding (72h)" : "receives split instantly"}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-600">
              <b>Effective payee:</b> {activeNext ? `#${activeNext.id} ${activeNext.name} (${activeNext.status === "GRACE" ? "via 72h hold" : "instant"})` : "treasury absorbs (whole upline suspended)"}
              {" · "}{chain.filter((c) => c.status === "SUSPENDED").length} hop(s) compressed
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Why compression matters</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-xs leading-relaxed text-slate-600">
          <p><b>Dead legs never eat fees.</b> When an upline is suspended (chargeback, KYC failure, dispute), their node stops receiving — but the tree structure stays immutable, so no re-mapping is needed.</p>
          <p><b>Same depth, new routing.</b> The compressed walk is recomputed per split: <span className="font-mono text-[11px]">skip SUSPENDED → first ACTIVE pays instantly · first GRACE pays into SafetyHolding.</span></p>
          <p><b>Try it:</b> suspend #1021 in Node manager, then re-open this panel — the path from their downline now flows straight through to #1010 and above.</p>
          <div className="rounded-lg bg-indigo-50 p-3 text-indigo-800">
            <GitBranch className="mb-1 h-4 w-4" />
            On-chain this is a pure view function — zero gas to query, gas only when a split actually fires.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── safety holding ──────────────────────────────────────────────────────────
function HoldingPanel({ snap, onRefresh }: { snap: NetworkSnapshot; onRefresh: () => void }) {
  const [held, setHeld] = useState<EarningDTO[] | null>(null);
  const [, setTick] = useState(0);

  const load = async () => {
    const res = await fetch("/api/holding");
    const data = await res.json();
    setHeld(data.held);
  };

  useEffect(() => { load(); }, [snap]);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  const act = async (earningId: string, action: "release" | "reverse") => {
    try {
      const res = await fetch("/api/holding", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ earningId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(action === "release" ? "Hold released to beneficiary" : "Hold reversed — upline protection");
      load(); onRefresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Signer action failed"); }
  };

  const releaseDue = async () => {
    try {
      const res = await fetch("/api/holding", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "releaseAllDue" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Crank released ${data.amount} USDT across ${data.released} matured hold(s)`);
      load(); onRefresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Crank failed"); }
  };

  const totalHeld = held?.reduce((s, e) => s + e.amount, 0) ?? 0;
  const due = held?.filter((e) => e.heldUntil && new Date(e.heldUntil) <= new Date()) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Lock className="h-5 w-5" /></span>
          <div><p className="text-xs text-slate-500">In escrow now</p><p className="text-lg font-bold text-slate-900">{fmtMoney(totalHeld)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><TimerReset className="h-5 w-5" /></span>
          <div><p className="text-xs text-slate-500">Matured (past 72h)</p><p className="text-lg font-bold text-slate-900">{due.length} hold{due.length === 1 ? "" : "s"}</p></div>
        </CardContent></Card>
        <Card className="border-emerald-200"><CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck className="h-5 w-5" /></span>
            <div><p className="text-xs text-slate-500">Safety signer</p><p className="text-sm font-bold text-slate-900">2-of-3 multisig</p></div>
          </div>
          <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-100" onClick={releaseDue} disabled={due.length === 0}>
            <Zap className="mr-1.5 h-3.5 w-3.5" /> Release due
          </Button>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Escrowed holds</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Beneficiary</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Generated by</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Grace window</TableHead>
                <TableHead className="pr-5 text-right">Signer action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(held ?? []).map((e) => {
                const maturesAt = e.heldUntil ? new Date(e.heldUntil).getTime() : 0;
                const matured = maturesAt <= Date.now();
                const hoursLeft = Math.max(0, (maturesAt - Date.now()) / 3600000);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="pl-5">
                      <p className="text-[13px] font-medium">{e.userName ?? "—"} <span className="text-slate-400">#{e.userId}</span></p>
                    </TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[10px]", e.kind === "SPLIT_POOL" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500")}>{e.kind.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-500">{e.fromName ? `${e.fromName} #${e.fromId}` : "—"} <span className="text-slate-300">· {timeAgo(e.createdAt)}</span></TableCell>
                    <TableCell className="text-right text-xs font-bold text-amber-700">{fmtUsdt(e.amount)}</TableCell>
                    <TableCell>
                      {matured ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700">MATURED — releasable</Badge>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><TimerReset className="h-3 w-3 text-amber-500" /> {hoursLeft.toFixed(1)}h left</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 border-emerald-200 px-2.5 text-[11px] text-emerald-700 hover:bg-emerald-50" onClick={() => act(e.id, "release")}>
                          <Unlock className="mr-1 h-3 w-3" /> Release
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 border-rose-200 px-2.5 text-[11px] text-rose-600 hover:bg-rose-50" onClick={() => act(e.id, "reverse")}>
                          <RotateCcw className="mr-1 h-3 w-3" /> Reverse
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {held?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-slate-400">Escrow empty — every hold settled.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── node manager ────────────────────────────────────────────────────────────
function NodesPanel({ snap, onRefresh }: { snap: NetworkSnapshot; onRefresh: () => void }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const list = snap.users;
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((u) => u.name.toLowerCase().includes(query) || String(u.id).includes(query));
  }, [snap.users, q]);

  const setStatus = async (id: number, status: string) => {
    try {
      const res = await fetch("/api/nodes", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.headline);
      onRefresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Node manager <span className="ml-1.5 text-xs font-normal text-slate-400">status changes trigger compression events</span></CardTitle>
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search node" className="h-8 pl-8 text-xs" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur">
              <TableRow>
                <TableHead className="pl-5">Member</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Set status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="py-2 pl-5">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar user={u} size={26} />
                      <div>
                        <p className="text-[13px] font-medium leading-tight">{u.name}</p>
                        <p className="text-[11px] text-slate-400">#{u.id} · parent #{u.parentId ?? "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">L{u.depth}</TableCell>
                  <TableCell><PkgBadge pkg={u.package} /></TableCell>
                  <TableCell className="text-xs text-slate-600">{fmtMoney(u.leftVol + u.rightVol)}</TableCell>
                  <TableCell><StatusBadge status={u.status} /></TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end">
                      <Select value={u.status} onValueChange={(v) => setStatus(u.id, v)}>
                        <SelectTrigger className="h-7 w-[120px] text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                          <SelectItem value="GRACE">GRACE</SelectItem>
                          <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
