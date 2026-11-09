"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useApp, type Identity } from "@/store/app";
import { PKG_PRICE, shortAddr, type PackageTier } from "@/lib/indexer";
import type { JoinResponse } from "@/lib/api-types";
import { CheckCircle2, Chrome, Loader2, Mail, Twitter, Wallet, Sparkles, ArrowRight, GitBranch, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";

type Step = "choose" | "email" | "provisioning" | "package" | "placing" | "placed" | "founder";

const PROVIDERS = [
  { key: "google", label: "Continue with Google", icon: Chrome, ring: "hover:border-indigo-300 hover:bg-indigo-50/50" },
  { key: "x", label: "Continue with X", icon: Twitter, ring: "hover:border-indigo-300 hover:bg-indigo-50/50" },
] as const;

export function AuthModal() {
  const { authOpen, setAuthOpen, signIn } = useApp();
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState<string>("email");
  const [pkg, setPkg] = useState<PackageTier>("STARTER");
  const [result, setResult] = useState<JoinResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [noMetaMask, setNoMetaMask] = useState(false);

  const reset = () => {
    setStep("choose"); setEmail(""); setPkg("STARTER"); setResult(null); setBusy(false); setNoMetaMask(false);
  };

  const close = (open: boolean) => {
    setAuthOpen(open);
    if (!open) setTimeout(reset, 300);
  };

  /** Embedded-wallet signup: provision → pick package → BFS placement via /api/join */
  const joinAsNew = async (prov: string, mail: string | null, chosen: PackageTier) => {
    setBusy(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsorId: 1001,
          name: mail ? mail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Guest Member",
          email: mail,
          provider: prov,
          package: chosen,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Placement failed");
      setResult(data);
      setStep("placed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activation failed");
      setStep("choose");
    } finally {
      setBusy(false);
    }
  };

  const onEmailContinue = () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast.error("Enter a valid email"); return; }
    setProvider("email");
    setStep("provisioning");
    setTimeout(() => setStep("package"), 1600);
  };

  const onSocial = (p: string) => {
    setProvider(p);
    setStep("provisioning");
    setTimeout(() => setStep("package"), 1600);
  };

  const onMetaMask = async () => {
    const eth = (window as unknown as { ethereum?: { request: (a: unknown) => Promise<string[]> } }).ethereum;
    if (!eth) { setNoMetaMask(true); return; }
    try {
      setBusy(true);
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const wallet = accounts[0];
      // external wallet → founder console access (demo framing)
      const identity: Identity = {
        userId: 1001,
        name: "Alex Carter",
        email: null,
        wallet,
        provider: "metamask",
        embedded: false,
        isNew: false,
      };
      signIn(identity);
      toast.success("Founder console unlocked", { description: `Connected ${shortAddr(wallet)}` });
      close(false);
    } catch {
      toast.error("Wallet connection rejected");
    } finally {
      setBusy(false);
    }
  };

  const onFounderDemo = () => {
    signIn({
      userId: 1001, name: "Alex Carter", email: "alex@binarymatrix.io",
      wallet: "0xA1e4...C9f3", provider: "demo", embedded: false, isNew: false,
    });
    toast.success("Signed in as Alex Carter", { description: "Founder · position #1001" });
    close(false);
  };

  const confirmPackage = () => {
    setStep("placing");
    setTimeout(() => joinAsNew(provider, provider === "email" ? email : null, pkg), 900);
  };

  const enterDashboard = () => {
    if (!result) return;
    signIn({
      userId: result.user.id,
      name: result.user.name,
      email: result.user.email,
      wallet: result.user.wallet,
      provider: provider as Identity["provider"],
      embedded: true,
      isNew: true,
    });
    toast.success(`Welcome to BinaryMatrix, ${result.user.name.split(" ")[0]}!`);
    close(false);
  };

  const spillover = result && result.placement.parentId !== 1001;

  return (
    <Dialog open={authOpen} onOpenChange={close}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0">
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 px-6 py-5 text-white">
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-100">
            <Sparkles className="h-3.5 w-3.5" /> Web2.5 onboarding · ERC-4337 · Base L2
          </div>
          <DialogHeader className="mt-1.5 space-y-1">
            <DialogTitle className="text-lg font-semibold text-white">Activate your BinaryMatrix position</DialogTitle>
            <DialogDescription className="text-sm text-indigo-100">
              Social login mints a soulbound position — no seed phrases, gas sponsored.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-6">
          {step === "choose" && (
            <div className="space-y-3">
              {PROVIDERS.map((p) => (
                <button key={p.key} disabled={busy}
                  onClick={() => onSocial(p.key)}
                  className={cn("flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium transition-all", p.ring)}>
                  <p.icon className="h-4 w-4 text-slate-600" />
                  {p.label}
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-300" />
                </button>
              ))}
              <div className="flex gap-2">
                <Input type="email" placeholder="you@company.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onEmailContinue()} />
                <Button onClick={onEmailContinue} className="shrink-0 bg-indigo-600 hover:bg-indigo-700">
                  <Mail className="mr-1 h-4 w-4" /> Continue
                </Button>
              </div>

              <div className="relative py-1 text-center">
                <span className="relative z-10 bg-white px-3 text-xs text-slate-400">or connect an external wallet</span>
                <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
              </div>

              <button onClick={onMetaMask} disabled={busy}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium transition-all hover:border-amber-300 hover:bg-amber-50/50">
                <Wallet className="h-4 w-4 text-amber-500" />
                MetaMask <span className="text-xs text-slate-400">→ founder console</span>
                <ArrowRight className="ml-auto h-4 w-4 text-slate-300" />
              </button>
              {noMetaMask && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  MetaMask not detected in this browser — use an embedded wallet above, or try the founder access below.
                </p>
              )}

              <button onClick={onFounderDemo} className="w-full pt-1 text-center text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                Just exploring? Enter as the demo founder →
              </button>
            </div>
          )}

          {step === "email" && <div />}
          {step === "provisioning" && (
            <Provisioning provider={provider} email={email} />
          )}

          {step === "package" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Embedded wallet provisioned · <span className="font-mono text-xs text-slate-500">{shortAddr("0x71C7656EC7ab88b098defB751B7401B5f6d8976F")}</span></span>
              </div>
              <p className="text-sm font-medium">Choose your activation package</p>
              {(["STARTER", "GROWTH", "SCALE"] as const).map((p) => (
                <button key={p} onClick={() => setPkg(p)}
                  className={cn("flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                    pkg === p ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300")}>
                  <div>
                    <p className="text-sm font-semibold">{p}</p>
                    <p className="text-xs text-slate-500">
                      {p === "STARTER" && "Entry tier · weekly match cap $1,000"}
                      {p === "GROWTH" && "Builder tier · weekly match cap $4,000"}
                      {p === "SCALE" && "Founder tier · weekly match cap $15,000"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-indigo-700">{PKG_PRICE[p]} USDT</span>
                </button>
              ))}
              <Button onClick={confirmPackage} disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-700">
                <Zap className="mr-1 h-4 w-4" /> Mint soulbound position
              </Button>
              <p className="text-center text-[11px] text-slate-400">Gas sponsored by BinaryMatrix paymaster · USDT inbound native</p>
            </div>
          )}

          {step === "placing" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">Running BFS placement…</p>
              <p className="text-xs text-slate-500">Searching the sponsor subtree for the first open slot — off-chain, zero gas</p>
            </div>
          )}

          {step === "placed" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Position #{result.user.id} minted</p>
                  <p className="text-xs text-emerald-700">SBT bound to {shortAddr(result.user.wallet)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <GitBranch className="h-3.5 w-3.5 text-indigo-500" /> BFS PLACEMENT RESULT
                </div>
                <p className="text-sm">
                  Placed as <b>{result.placement.side}</b> child of <b>#{result.placement.parentId} {result.placement.parentName}</b>
                  {spillover && <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">SPILLOVER</span>}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {result.placement.visited.length} node{result.placement.visited.length > 1 ? "s" : ""} traversed · tx {result.txHash.slice(0, 10)}… · block {result.blockNumber}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> INSTANT FEE SPLITS
                </div>
                <div className="space-y-1.5">
                  {result.splits.slice(0, 5).map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{s.toName} <span className="text-slate-400">· {s.kind}</span></span>
                      <span className={cn("font-semibold", s.held ? "text-amber-600" : "text-emerald-600")}>
                        {s.usdt} USDT{s.held ? " (72h hold)" : ""}
                      </span>
                    </div>
                  ))}
                  {result.splits.length > 5 && <p className="text-[11px] text-slate-400">+{result.splits.length - 5} more beneficiaries</p>}
                </div>
              </div>

              <Button onClick={enterDashboard} className="w-full bg-indigo-600 hover:bg-indigo-700">
                Enter dashboard <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Provisioning({ provider, email }: { provider: string; email: string }) {
  const [pct, setPct] = useState(12);
  useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(100, p + 14)), 180);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-indigo-200" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg">
          {provider === "email" ? <Mail className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Provisioning embedded wallet…</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {provider === "email" ? `Verifying ${email} via OIDC` : `Verifying ${provider} identity via OIDC`} · deriving ERC-4337 smart account
        </p>
      </div>
      <Progress value={pct} className="h-1.5 w-56" />
      <p className="text-[11px] text-slate-400">Secured by account abstraction — no seed phrase required</p>
    </div>
  );
}
