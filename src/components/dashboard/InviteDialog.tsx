"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PKG_PRICE, type PackageTier, type Side } from "@/lib/indexer";
import type { JoinResponse, NetworkSnapshot } from "@/lib/api-types";
import { CheckCircle2, GitBranch, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

/**
 * "Simulate join" — places a new member under the given sponsor through the
 * same off-chain BFS + fee-split pipeline the contracts run on-chain.
 */
export function InviteDialog({
  open, onOpenChange, snap, sponsorId, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  snap: NetworkSnapshot;
  sponsorId: number;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pkg, setPkg] = useState<PackageTier>("STARTER");
  const [side, setSide] = useState<"AUTO" | Side>("AUTO");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<JoinResponse | null>(null);

  const sponsor = snap.users.find((u) => u.id === sponsorId);
  const reset = () => { setName(""); setEmail(""); setPkg("STARTER"); setSide("AUTO"); setResult(null); };
  const close = (o: boolean) => { onOpenChange(o); if (!o) setTimeout(reset, 250); };

  const submit = async () => {
    if (!name.trim()) { toast.error("Member name is required"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsorId,
          name: name.trim(),
          email: email.trim() || null,
          provider: "email",
          package: pkg,
          preferSide: side === "AUTO" ? undefined : side,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Placement failed");
      setResult(data);
      onDone();
      toast.success(`#${data.user.id} placed under #${data.placement.parentId}`, { description: `${data.placement.visited.length} BFS steps · ${data.splits.length} split lines` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  };

  const spillover = result && result.placement.spillover;
  const gross = useMemo(() => (result ? PKG_PRICE[result.user.package as PackageTier] : 0), [result]);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-600" /> Simulate new activation
          </DialogTitle>
          <DialogDescription>
            Sponsor <b>#{sponsorId} {sponsor?.name}</b> — the indexer BFS-searches this subtree for the first open slot.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Member name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jordan Lee" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Email (optional)</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jordan@corp.io" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Package</label>
                <Select value={pkg} onValueChange={(v) => setPkg(v as PackageTier)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["STARTER", "GROWTH", "SCALE"] as const).map((p) => (
                      <SelectItem key={p} value={p}>{p} · {PKG_PRICE[p]} USDT</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Preferred side</label>
                <Select value={side} onValueChange={(v) => setSide(v as "AUTO" | Side)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto (BFS)</SelectItem>
                    <SelectItem value="L">Left</SelectItem>
                    <SelectItem value="R">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={submit} disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitBranch className="mr-2 h-4 w-4" />}
              {busy ? "Searching subtree + settling splits…" : "Place member & split fees"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
              <div className="text-sm">
                <p className="font-semibold text-emerald-800">#{result.user.id} {result.user.name} activated · {result.user.package}</p>
                <p className="text-xs text-emerald-700">tx {result.txHash.slice(0, 14)}… · block {result.blockNumber}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><GitBranch className="h-3.5 w-3.5 text-indigo-500" /> BFS PLACEMENT</p>
              <p className="text-sm text-slate-700">
                {result.placement.side} child of <b>#{result.placement.parentId} {result.placement.parentName}</b>
                {spillover && <Badge className="ml-2 border-violet-200 bg-violet-100 text-[10px] font-bold text-violet-700">SPILLOVER</Badge>}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Traversal: {result.placement.visited.map((v) => `#${v}`).join(" → ")}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> FEE SPLIT · {gross} USDT GROSS</p>
              <div className="space-y-1">
                {result.splits.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{s.toName} <span className="text-slate-400">{s.kind}</span></span>
                    <span className={cn("font-semibold", s.held ? "text-amber-600" : "text-emerald-600")}>
                      {s.usdt} USDT{s.held ? " · 72h hold" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setResult(null); }}>Place another</Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => close(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
