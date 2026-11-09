"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider,
  Handle, Position, type Edge, type Node, type NodeProps, useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { UserAvatar, StatusBadge, PkgBadge, SideChip, fmtMoney, fmtUsdt, timeAgo } from "@/components/shared";
import { findBFSPlacement, recomputeVolumes, shortAddr, PKG_PRICE, type PackageTier, type MatrixUser as MU, type Side } from "@/lib/indexer";
import type { EarningDTO, JoinResponse, NetworkSnapshot } from "@/lib/api-types";
import { useApp } from "@/store/app";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Boxes, Coins, Crown, GitBranch, Loader2, Play, RotateCcw, Search, Shuffle, TimerReset, Wallet, X, Zap } from "lucide-react";

type BfsPhase = "idle" | "running" | "done" | "minting" | "minted";

export function MatrixView({ snap, onRefresh }: { snap: NetworkSnapshot; onRefresh: () => void }) {
  return (
    <ReactFlowProvider>
      <MatrixInner snap={snap} onRefresh={onRefresh} />
    </ReactFlowProvider>
  );
}

function MatrixInner({ snap, onRefresh }: { snap: NetworkSnapshot; onRefresh: () => void }) {
  const { identity } = useApp();
  const { fitView } = useReactFlow();

  const [sponsorId, setSponsorId] = useState<number>(identity?.userId ?? 1001);
  const [pkg, setPkg] = useState<PackageTier>("GROWTH");
  const [side, setSide] = useState<"AUTO" | Side>("AUTO");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [phase, setPhase] = useState<BfsPhase>("idle");
  const [stepIdx, setStepIdx] = useState(-1);
  const [preview, setPreview] = useState<ReturnType<typeof findBFSPlacement>>(null);
  const [minted, setMinted] = useState<JoinResponse | null>(null);
  const [fitKey, setFitKey] = useState(0);

  useEffect(() => { if (fitKey > 0) { const t = setTimeout(() => fitView({ padding: 0.15, duration: 500 }), 80); return () => clearTimeout(t); } }, [fitKey, fitView]);

  const users = snap.users;
  const volumes = useMemo(() => recomputeVolumes(users), [users]);

  // ── tidy tree layout: leaves packed left→right, parents centered ──────────
  const positions = useMemo(() => {
    const kids = new Map<number, MU[]>();
    for (const u of users) {
      if (u.parentId == null) continue;
      const arr = kids.get(u.parentId) ?? [];
      arr.push(u);
      kids.set(u.parentId, arr);
    }
    for (const arr of kids.values()) arr.sort((a, b) => (a.side === "L" ? -1 : 1) - (b.side === "L" ? -1 : 1));

    const pos = new Map<number, number>();
    let leaf = 0;
    const assign = (id: number): number => {
      const children = kids.get(id) ?? [];
      if (children.length === 0) { pos.set(id, leaf++); return leaf - 1; }
      const xs = children.map((c) => assign(c.id));
      const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
      pos.set(id, mid);
      return mid;
    };
    assign(1001);

    const out = new Map<number, { x: number; y: number }>();
    for (const u of users) {
      out.set(u.id, { x: (pos.get(u.id) ?? 0) * 196, y: u.depth * 128 });
    }
    return out;
  }, [users]);

  // ── BFS animation state ───────────────────────────────────────────────────
  const runSimulation = useCallback((sponsor = sponsorId, sidePref: "AUTO" | Side = side) => {
    const res = findBFSPlacement(users, sponsor, sidePref === "AUTO" ? undefined : sidePref);
    if (!res) { toast.error("No open slot found in this subtree"); return; }
    setPreview(res);
    setMinted(null);
    setPhase("running");
    setStepIdx(0);
  }, [users, sponsorId, side]);

  useEffect(() => {
    if (phase !== "running" || !preview) return;
    if (stepIdx >= preview.visited.length - 1) {
      const t = setTimeout(() => setPhase("done"), 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStepIdx((i) => i + 1), 380);
    return () => clearTimeout(t);
  }, [phase, stepIdx, preview]);

  const resetSim = () => { setPhase("idle"); setStepIdx(-1); setPreview(null); setMinted(null); };

  const demoSpillover = () => {
    setSponsorId(1003);
    setSide("AUTO");
    // run with explicit args — the setTimeout would otherwise capture the stale closure
    setTimeout(() => runSimulation(1003, "AUTO"), 60);
    toast.info("Spillover demo: sponsoring under #1003 — both direct slots are full", { description: "Watch BFS walk the subtree until it finds the first open slot" });
  };

  const mint = async () => {
    if (!preview) return;
    setPhase("minting");
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsorId, package: pkg, preferSide: side === "AUTO" ? undefined : side, name: `Demo Member ${Math.floor(Math.random() * 900 + 100)}`, provider: "email" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mint failed");
      setMinted(data);
      setPhase("minted");
      onRefresh();
      setFitKey((k) => k + 1);
      toast.success(`Position #${data.user.id} minted on-chain`, { description: `${data.splits.length} split lines settled · tx ${data.txHash.slice(0, 10)}…` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mint failed");
      setPhase("done");
    }
  };

  // ── React Flow nodes & edges ──────────────────────────────────────────────
  const animTarget = preview?.visited[preview.visited.length - 1] ?? null;
  const visitedSet = useMemo(() => new Set(phase === "idle" ? [] : preview?.visited.slice(0, stepIdx + 1) ?? []), [phase, preview, stepIdx]);
  const currentNode = phase === "running" && preview ? preview.visited[stepIdx] : null;
  const ghostId = phase === "done" || phase === "minted" ? animTarget : null;

  const rfNodes: Node[] = useMemo(() => {
    return users.map((u) => {
      const isNew = minted?.user.id === u.id;
      const isGhost = ghostId === u.id && !isNew;
      const state = isNew ? "new" : isGhost ? "ghost" : currentNode === u.id ? "current" : visitedSet.has(u.id) ? "visited" : "idle";
      const vols = volumes.get(u.id)!;
      return {
        id: String(u.id),
        position: positions.get(u.id)!,
        type: "matrix",
        data: { u, state, selected: selectedId === u.id, isRoot: u.id === 1001, isMe: u.id === (identity?.userId ?? 1001), vols, pkgHint: phase === "done" || phase === "minted" ? pkg : null },
        draggable: false,
      } satisfies Node;
    });
  }, [users, positions, volumes, visitedSet, currentNode, ghostId, selectedId, minted, identity, pkg, phase]);

  const rfEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    for (const u of users) {
      if (u.parentId == null) continue;
      const onPath = visitedSet.has(u.id) && visitedSet.has(u.parentId);
      const splitsUp = phase === "minted" && minted?.splits.some((s) => s.toId === u.parentId || s.toId === u.id);
      edges.push({
        id: `${u.parentId}-${u.id}`,
        source: String(u.parentId),
        target: String(u.id),
        type: "smoothstep",
        animated: phase === "minted" && !!splitsUp,
        style: {
          stroke: u.status === "SUSPENDED" ? "#f43f5e" : u.side === "L" ? "#6366f1" : "#8b5cf6",
          strokeWidth: onPath ? 3 : 1.6,
          strokeDasharray: u.status === "SUSPENDED" ? "6 4" : undefined,
          opacity: u.status === "SUSPENDED" ? 0.55 : 1,
        },
      });
    }
    return edges;
  }, [users, visitedSet, phase, minted]);

  const selected = users.find((u) => u.id === selectedId) ?? null;
  const selectedEarnings: EarningDTO[] = selected ? snap.earnings.filter((e) => e.userId === selected.id).slice(0, 6) : [];

  const queue = preview?.queueSnapshots[Math.min(stepIdx, preview.queueSnapshots.length - 1)]?.queue ?? [];

  return (
    <div className="space-y-4">
      {/* control bar */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">SPONSOR</span>
            <Select value={String(sponsorId)} onValueChange={(v) => { setSponsorId(Number(v)); resetSim(); }}>
              <SelectTrigger className="h-9 w-[240px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    #{u.id} {u.name} {u.id === 1001 ? "· root" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-2 text-xs font-semibold text-slate-500">PACKAGE</span>
            <Select value={pkg} onValueChange={(v) => setPkg(v as PackageTier)}>
              <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["STARTER", "GROWTH", "SCALE"] as const).map((p) => <SelectItem key={p} value={p}>{p} · {PKG_PRICE[p]} USDT</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="ml-2 text-xs font-semibold text-slate-500">SIDE</span>
            <Select value={side} onValueChange={(v) => { setSide(v as "AUTO" | Side); resetSim(); }}>
              <SelectTrigger className="h-9 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Auto (BFS)</SelectItem>
                <SelectItem value="L">Left</SelectItem>
                <SelectItem value="R">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={demoSpillover}><Shuffle className="mr-1.5 h-3.5 w-3.5" /> Spillover demo</Button>
            {phase === "idle" && (
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => runSimulation()}>
                <Play className="mr-1.5 h-3.5 w-3.5" /> Simulate placement
              </Button>
            )}
            {phase === "running" && (
              <Button size="sm" disabled className="bg-indigo-600"><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> BFS searching…</Button>
            )}
            {phase === "done" && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={mint}>
                <Zap className="mr-1.5 h-3.5 w-3.5" /> Mint at #{animTarget} ({pkg})
              </Button>
            )}
            {phase === "minting" && <Button size="sm" disabled className="bg-emerald-600"><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Settling splits…</Button>}
            {phase === "minted" && (
              <Button size="sm" variant="outline" onClick={resetSim}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setFitKey((k) => k + 1); }}><Search className="mr-1.5 h-3.5 w-3.5" /> Fit</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* tree canvas */}
        <Card className="overflow-hidden">
          <CardContent className="relative p-0">
            <div className="h-[600px]">
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={NODE_TYPES}
                onNodeClick={(_, n) => setSelectedId(Number(n.id))}
                onPaneClick={() => setSelectedId(null)}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                minZoom={0.15}
                maxZoom={1.6}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#dbe2ee" />
                <Controls showInteractive={false} position="bottom-right" />
                <MiniMap pannable zoomable bgColor="#f8fafc" maskColor="rgba(99,102,241,0.08)" nodeColor={(n) => (n.data as MatrixNodeData).u.status === "SUSPENDED" ? "#fb7185" : (n.data as MatrixNodeData).u.id === 1001 ? "#6366f1" : "#c7d2fe"} position="bottom-left" style={{ width: 150, height: 96 }} />
              </ReactFlow>
            </div>

            {/* BFS queue overlay */}
            {(phase === "running" || phase === "done") && preview && (
              <div className="absolute left-4 top-4 w-[300px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold tracking-wide text-slate-500">
                  <GitBranch className="h-3.5 w-3.5 text-indigo-600" /> BFS TRAVERSAL {phase === "done" ? "· COMPLETE" : ""}
                </div>
                <div className="flex flex-wrap gap-1">
                  {preview.visited.slice(0, stepIdx + 1).map((v, i) => (
                    <span key={v} className={cn("rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold", i === stepIdx && phase === "running" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700")}>
                      #{v}
                    </span>
                  ))}
                  {phase === "running" && <Loader2 className="h-3 w-3 animate-spin self-center text-indigo-400" />}
                </div>
                {queue.length > 0 && phase === "running" && (
                  <>
                    <p className="mt-2 text-[10px] font-semibold text-slate-400">QUEUE</p>
                    <div className="flex flex-wrap gap-1">
                      {queue.slice(0, 8).map((q) => (
                        <span key={q} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">#{q}</span>
                      ))}
                      {queue.length > 8 && <span className="text-[10px] text-slate-400">+{queue.length - 8}</span>}
                    </div>
                  </>
                )}
                {phase === "done" && (
                  <p className="mt-2 text-xs text-slate-600">
                    Open slot: <b>#{animTarget}</b> · {preview.side} side{preview.spillover && <Badge className="ml-1.5 border-violet-200 bg-violet-100 text-[9px] font-bold text-violet-700">SPILLOVER</Badge>}
                  </p>
                )}
              </div>
            )}

            {/* minted splits overlay */}
            {phase === "minted" && minted && (
              <div className="absolute right-4 top-4 w-[320px] rounded-xl border border-emerald-200 bg-white/97 p-3.5 shadow-lg backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-emerald-700"><Zap className="h-3.5 w-3.5" /> SETTLED ON-CHAIN</p>
                  <button onClick={resetSim} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                </div>
                <p className="mt-1 text-xs text-slate-600">#{minted.user.id} · tx <span className="font-mono">{minted.txHash.slice(0, 12)}…</span></p>
                <Separator className="my-2" />
                <div className="space-y-1">
                  {minted.splits.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">{s.toName} <span className="text-slate-400">{s.kind}</span></span>
                      <span className={cn("font-semibold", s.held ? "text-amber-600" : "text-emerald-600")}>{s.usdt} USDT</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* legend */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full border border-slate-200 bg-white/95 px-4 py-1.5 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-indigo-500" /> Left leg</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-violet-500" /> Right leg</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-rose-400" /> Suspended (compressed)</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-2 border-amber-400" /> Grace 72h</span>
            </div>
          </CardContent>
        </Card>

        {/* inspector */}
        <Card className="self-start">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Node inspector</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {!selected && (
              <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center">
                <Boxes className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">Click any node on the tree</p>
                <p className="px-6 text-xs text-slate-400">Volumes, wallet binding, earnings and status — straight from the off-chain mirror</p>
              </div>
            )}
            {selected && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <UserAvatar user={selected} size={42} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{selected.name}</p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-400">#{selected.id} · <SideChip side={selected.side} /> parent #{selected.parentId ?? "—"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <PkgBadge pkg={selected.package} />
                  <StatusBadge status={selected.status} />
                  {selected.isFounder && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] text-violet-700">FOUNDER</Badge>}
                  {selected.sponsorId !== selected.parentId && <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-[10px] text-indigo-600">SPILLOVER PLACED</Badge>}
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs">
                  <Row label="Wallet (SBT-bound)" value={<span className="font-mono">{shortAddr(selected.wallet)}</span>} />
                  <Row label="Sponsor" value={`#${selected.sponsorId ?? "—"}`} />
                  <Row label="Level" value={`L${selected.depth}`} />
                  <Row label="Package" value={`${selected.package} · ${PKG_PRICE[selected.package]} USDT`} />
                  <Row label="Joined" value={timeAgo(selected.joinedAt)} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 text-center">
                    <p className="text-[10px] font-semibold text-indigo-500">LEFT LEG VOL</p>
                    <p className="text-sm font-bold text-indigo-700">{fmtMoney(volumes.get(selected.id)!.leftVol)}</p>
                  </div>
                  <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-2.5 text-center">
                    <p className="text-[10px] font-semibold text-violet-500">RIGHT LEG VOL</p>
                    <p className="text-sm font-bold text-violet-700">{fmtMoney(volumes.get(selected.id)!.rightVol)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Coins className="h-3.5 w-3.5" /> Total earned</span>
                  <span className="text-sm font-bold text-emerald-700">{fmtMoney(selected.totalEarned)}</span>
                </div>
                {selected.heldAmount > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700"><TimerReset className="h-3.5 w-3.5" /> Held (72h)</span>
                    <span className="text-sm font-bold text-amber-700">{fmtMoney(selected.heldAmount)}</span>
                  </div>
                )}

                <Separator />
                <p className="text-[11px] font-semibold tracking-wide text-slate-400">RECENT EARNINGS</p>
                <ScrollArea className="h-36">
                  <div className="space-y-1.5 pr-2">
                    {selectedEarnings.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-2.5 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-slate-700">{e.kind.replace("_", " ")}{e.fromName ? ` · from ${e.fromName}` : ""}</p>
                          <p className="text-[10px] text-slate-400">{timeAgo(e.createdAt)}</p>
                        </div>
                        <span className={cn("text-[11px] font-bold", e.status === "HELD" ? "text-amber-600" : e.status === "REVERSED" ? "text-rose-500 line-through" : "text-emerald-600")}>
                          {fmtUsdt(e.amount)}
                        </span>
                      </div>
                    ))}
                    {selectedEarnings.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No earnings yet</p>}
                  </div>
                </ScrollArea>

                <Button variant="outline" size="sm" className="w-full" onClick={() => { setSponsorId(selected.id); resetSim(); }}>
                  <GitBranch className="mr-1.5 h-3.5 w-3.5" /> Use as sponsor
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── custom node (module scope — React Flow requires stable nodeTypes) ──────
interface MatrixNodeData extends Record<string, unknown> {
  u: MU;
  state: "idle" | "visited" | "current" | "ghost" | "new";
  selected: boolean;
  isRoot: boolean;
  isMe: boolean;
  vols: { leftVol: number; rightVol: number };
  pkgHint: PackageTier | null;
}

const NODE_TYPES = { matrix: MatrixNode };

function MatrixNode({ data }: NodeProps) {
  const d = data as MatrixNodeData;
  const u = d.u;
  const isSuspended = u.status === "SUSPENDED";
  const isGrace = u.status === "GRACE";

  return (
    <div
      className={cn(
        "relative w-[176px] rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-all",
        d.selected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200",
        d.state === "current" && "border-indigo-500 ring-4 ring-indigo-300/60 animate-pulse",
        d.state === "visited" && "border-indigo-200 bg-indigo-50/60",
        d.state === "ghost" && "border-dashed border-emerald-400 bg-emerald-50/70",
        d.state === "new" && "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-300/50 shadow-lg",
        isSuspended && "opacity-70"
      )}
      style={d.state === "new" ? { animation: "pg-pop .5s cubic-bezier(.2,.8,.3,1.2)" } : undefined}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-slate-300" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-slate-300" />

      {d.isRoot && <Crown className="absolute -top-2.5 right-2 h-4 w-4 text-amber-500" />}
      {d.isMe && <span className="absolute -top-2 left-2 rounded-full bg-indigo-600 px-1.5 py-px text-[8px] font-bold text-white">YOU</span>}

      <div className="flex items-center gap-2">
        <UserAvatar user={u} size={30} />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[11.5px] font-semibold leading-tight", isSuspended ? "text-slate-400 line-through" : "text-slate-800")}>{u.name}</p>
          <p className="text-[9.5px] text-slate-400">
            #{u.id} · {u.package} · <span className={cn("font-bold", u.side === "L" ? "text-indigo-500" : "text-violet-500")}>{u.side ?? "ROOT"}</span>
          </p>
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between border-t border-slate-100 pt-1.5">
        <span className="flex items-center gap-1 text-[9.5px] font-medium text-slate-400">
          <Wallet className="h-2.5 w-2.5" />
          {fmtMoney(d.vols.leftVol + d.vols.rightVol)}
        </span>
        {isGrace && <span className="rounded bg-amber-100 px-1 py-px text-[8.5px] font-bold text-amber-700">GRACE</span>}
        {isSuspended && <span className="rounded bg-rose-100 px-1 py-px text-[8.5px] font-bold text-rose-600">SUSPENDED</span>}
        {!isGrace && !isSuspended && <span className="rounded bg-emerald-50 px-1 py-px text-[8.5px] font-bold text-emerald-600">ACTIVE</span>}
      </div>

      {(d.state === "ghost" || d.state === "new") && (
        <span className="absolute -right-2 -top-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold text-white shadow">
          {d.state === "new" ? "MINTED" : "OPEN SLOT"}
        </span>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
