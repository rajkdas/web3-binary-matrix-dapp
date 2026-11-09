"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LiveDot } from "@/components/shared";
import { useApp } from "@/store/app";
import { fmtCompact } from "@/lib/indexer";
import { ArrowRight, Boxes, Coins, GitBranch, Fuel, Layers, Play, ShieldCheck, UserPlus, Wallet, Zap, Network, ArrowDown, Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";

const FEATURES = [
  { icon: GitBranch, title: "Immutable 2xN Binary Forced Matrix", desc: "Every position is an on-chain SBT bound to (parent, side). BFS placement with organic spillover — permanent, portable, auditable.", accent: "from-indigo-500 to-indigo-600" },
  { icon: UserPlus, title: "Web2.5 Onboarding", desc: "Google, X or email mints an embedded wallet in seconds. Social login → soulbound position, zero seed phrases.", accent: "from-violet-500 to-violet-600" },
  { icon: Fuel, title: "Gasless via ERC-4337", desc: "Account abstraction with paymaster depots settles USDT/USDC inbound natively. Users never touch gas.", accent: "from-emerald-500 to-emerald-600" },
  { icon: Layers, title: "Off-chain BFS Indexer", desc: "Placement search runs in Node.js against a mirrored graph — the chain only stores the binding. ~87% cheaper at scale.", accent: "from-amber-500 to-amber-600" },
  { icon: Coins, title: "Upline Compression", desc: "Suspended uplines are skipped automatically; fee splits re-route to the next active ancestor with full on-chain evidence.", accent: "from-sky-500 to-sky-600" },
  { icon: ShieldCheck, title: "Safety Holding — 72h Grace", desc: "Fresh activations route earnings into a grace-period escrow, protecting uplines from churn and chargebacks.", accent: "from-rose-500 to-rose-600" },
];

const STEPS = [
  { n: "01", title: "Activate", desc: "Social or email login provisions an ERC-4337 smart account and mints your soulbound matrix position.", icon: Fingerprint },
  { n: "02", title: "Get placed", desc: "The off-chain indexer BFS-searches your sponsor's subtree and commits the binding on Base in one tx.", icon: GitBranch },
  { n: "03", title: "Earn", desc: "Campaign contracts split fees instantly — referral compressed, pool held 72h, treasury settled atomically.", icon: Coins },
];

export function Landing({ liveEvents }: { liveEvents: number }) {
  const { setAuthOpen, setView, identity } = useApp();
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 3200); return () => clearInterval(t); }, []);

  const enter = () => (identity ? setView("dashboard") : setAuthOpen(true));

  return (
    <div className="min-h-full bg-white">
      {/* ── nav ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
              <Network className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-bold tracking-tight">PortaGraph</span>
            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-[10px] font-semibold text-indigo-600">MVP</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setView("contracts")}>Contracts</Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={enter}>
              Launch demo <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── hero ── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-indigo-100 blur-3xl opacity-60" />
        <div className="pointer-events-none absolute -right-40 top-40 h-96 w-96 rounded-full bg-violet-100 blur-3xl opacity-60" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              <LiveDot /> Base L2 · ERC-4337 · Live event stream
            </div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
              Relationships that are
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent"> portable, provable, payable.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              PortaGraph stores your B2B affiliate &amp; MLM structure as an immutable{" "}
              <b className="text-slate-800">2xN binary forced matrix</b> on-chain — with Web2.5 onboarding,
              gasless activation, and an off-chain indexer that keeps fees near zero.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-12 bg-indigo-600 px-6 text-[15px] hover:bg-indigo-700" onClick={enter}>
                <Play className="mr-2 h-4 w-4" /> Launch the interactive demo
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-[15px]" onClick={() => setView("contracts")}>
                <Boxes className="mr-2 h-4 w-4" /> Read the contracts
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-400">
              {["Next.js · TypeScript", "React Flow", "Socket.IO feed", "Prisma + PostgreSQL", "Solidity 0.8.24", "Foundry tests"].map((t) => (
                <span key={t} className="rounded-md bg-slate-100 px-2 py-1">{t}</span>
              ))}
            </div>
          </div>

          {/* hero visual — live network card */}
          <Card className="relative border-slate-200 shadow-xl shadow-indigo-100/60">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <GitBranch className="h-4 w-4 text-indigo-600" /> Matrix mirror · #1001
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <LiveDot /> STREAMING
                </span>
              </div>

              {/* mini tree */}
              <div className="grid grid-cols-2 gap-2 p-5">
                <TreeCell id={1001} name="Alex Carter" pkg="SCALE" side="ROOT" strong />
                <div />
                <TreeCell id={1002} name="Maya Okafor" pkg="SCALE" side="L" />
                <TreeCell id={1003} name="Diego Ramirez" pkg="GROWTH" side="R" />
                <TreeCell id={1004} name="Sarah Lindqvist" pkg="GROWTH" side="L" />
                <TreeCell id={1006} name="Priya Natarajan" pkg="GROWTH" side="L" suspended />
              </div>

              <div className="border-t border-slate-100 px-5 py-3">
                <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400">LIVE CHAIN EVENTS</p>
                <div className="space-y-1.5 text-xs">
                  <LiveRow key={tick} text="Fee split 18.0 USDT on #2073 — 3 beneficiaries paid" amount="+18.0" />
                  <LiveRow key={tick + 1} text="New activation #2091 · GROWTH package (spillover)" amount="+500" />
                  <LiveRow key={tick + 2} text="SafetyHolding released 64.2 USDT after 72h grace" amount="+64.2" />
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
                <Metric label="Matrix nodes" value={fmtCompact(12480 + (tick % 7))} />
                <Metric label="USDT settled" value={fmtCompact(2340000 + tick * 137)} />
                <Metric label="Gas saved" value="87%" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── features ── */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">The full stack, already standing</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
            This MVP implements every pillar of the PortaGraph spec — contracts, sync layer and dashboard — running as one coherent demo.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="group border-slate-200 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50">
                <CardContent className="p-5">
                  <span className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${f.accent} text-white shadow-sm`}>
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-[15px] font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">Activation to earnings in three moves</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <Card className="h-full border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <span className="text-4xl font-bold text-indigo-100">{s.n}</span>
                      <s.icon className="h-6 w-6 text-indigo-600" />
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.desc}</p>
                  </CardContent>
                </Card>
                {i < 2 && <ArrowDown className="absolute -right-5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-300 md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 px-8 py-12 text-center shadow-xl shadow-indigo-200">
          <Zap className="mx-auto h-8 w-8 text-indigo-200" />
          <h2 className="mt-3 text-3xl font-bold text-white">See your network on-chain in 60 seconds</h2>
          <p className="mx-auto mt-2 max-w-xl text-indigo-100">
            Sign in with the demo founder, mint your own position, watch BFS spillover and fee splits fire live.
          </p>
          <Button size="lg" className="mt-7 h-12 bg-white px-8 text-[15px] font-semibold text-indigo-700 hover:bg-indigo-50" onClick={enter}>
            <Wallet className="mr-2 h-4 w-4" /> Launch demo dashboard
          </Button>
          <p className="mt-3 text-xs text-indigo-200">{liveEvents > 0 ? `${liveEvents} events streamed this session · simulated chain — no real funds` : "Simulated chain — no real funds"}</p>
        </div>
      </section>
    </div>
  );
}

function TreeCell({ id, name, pkg, side, strong, suspended }: { id: number; name: string; pkg: string; side: string; strong?: boolean; suspended?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${strong ? "border-indigo-300 bg-indigo-50/70" : "border-slate-200 bg-white"} ${suspended ? "opacity-50" : ""}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white ${strong ? "from-indigo-500 to-violet-500" : "from-slate-400 to-slate-500"}`}>
        {name.split(" ").map((p) => p[0]).join("")}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-800">{name} {suspended && <span className="text-rose-500">·⏸</span>}</p>
        <p className="text-[10px] text-slate-400">#{id} · {pkg} · <span className="font-medium text-indigo-500">{side}</span></p>
      </div>
    </div>
  );
}

function LiveRow({ text, amount }: { text: string; amount: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="truncate text-slate-600">{text}</span>
      <span className="shrink-0 font-semibold text-emerald-600">{amount}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3.5">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] font-medium tracking-wide text-slate-400">{label.toUpperCase()}</p>
    </div>
  );
}
