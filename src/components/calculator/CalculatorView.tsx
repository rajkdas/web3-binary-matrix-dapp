"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GasChartCard } from "@/components/analytics/charts";
import { DEFAULT_GAS, PKG_CAP, PKG_PRICE, placementGas, fmtMoney, fmtCompact, type PackageTier } from "@/lib/indexer";
import { Calculator, ChevronDown, Fuel, Info, TimerReset, TrendingUp } from "lucide-react";

/**
 * Earnings projector + gas-cost model. Every number is computed from the
 * stated assumptions — the same formulas the indexer uses for matching bonuses
 * and the same gas model shown in Analytics.
 */
export function CalculatorView() {
  const [network, setNetwork] = useState(240);
  const [avgPkg, setAvgPkg] = useState(500);
  const [matchingPct, setMatchingPct] = useState(10);
  const [referralPct, setReferralPct] = useState(12);
  const [tier, setTier] = useState<PackageTier>("GROWTH");
  const [balance, setBalance] = useState(70); // % weaker-leg efficiency
  const [months, setMonths] = useState(6);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const model = useMemo(() => {
    // matrix fill: your subtree reaches ~network size; weak leg earns
    const weakLeg = (network / 2) * avgPkg * (balance / 100);
    const cap = PKG_CAP[tier];
    const weeklyMatching = Math.min(weakLeg * (matchingPct / 100), cap);
    const personalReferrals = Math.max(2, Math.round(network * 0.02));
    const monthlyReferral = personalReferrals * avgPkg * (referralPct / 100); // direct joins per month
    const monthlyMatching = weeklyMatching * 4.33;
    const monthlyTotal = monthlyMatching + monthlyReferral;
    const horizon = monthlyTotal * months;
    const pkgCost = PKG_PRICE[tier];
    const breakEvenWeeks = monthlyTotal > 0 ? pkgCost / (monthlyTotal / 4.33) : Infinity;
    return {
      weakLeg, weeklyMatching, monthlyMatching, monthlyReferral, monthlyTotal, horizon, breakEvenWeeks, personalReferrals, cap,
    };
  }, [network, avgPkg, matchingPct, referralPct, tier, balance, months]);

  const gasPoints = useMemo(() => [10, 100, 500, 1000, 5000, 10000].map((N) => placementGas(N, DEFAULT_GAS)), []);
  const currentGas = placementGas(network, DEFAULT_GAS);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Earnings &amp; gas calculator</h1>
        <p className="text-sm text-slate-500">Deterministic model — tune the levers, every figure recomputes from stated assumptions</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        {/* controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-indigo-600" /> Model inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <SliderRow label="Target network size (your subtree)" value={network} min={10} max={2000} step={10} onChange={setNetwork} display={fmtCompact(network)} />
            <SliderRow label="Average package value" value={avgPkg} min={100} max={1500} step={100} onChange={setAvgPkg} display={`${avgPkg} USDT`} />
            <SliderRow label="Weak-leg balance efficiency" value={balance} min={30} max={100} step={5} onChange={setBalance} display={`${balance}%`} hint="How balanced your two legs fill — matching pays on the weaker leg" />
            <SliderRow label="Binary matching rate" value={matchingPct} min={5} max={15} step={1} onChange={setMatchingPct} display={`${matchingPct}%`} />
            <SliderRow label="Referral rate" value={referralPct} min={5} max={20} step={1} onChange={setReferralPct} display={`${referralPct}%`} />
            <SliderRow label="Projection horizon" value={months} min={1} max={24} step={1} onChange={setMonths} display={`${months} months`} />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Your package tier</label>
              <Select value={tier} onValueChange={(v) => setTier(v as PackageTier)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["STARTER", "GROWTH", "SCALE"] as const).map((p) => (
                    <SelectItem key={p} value={p}>{p} · {PKG_PRICE[p]} USDT · cap {fmtMoney(PKG_CAP[p])}/week</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* results */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <ResultCard icon={TrendingUp} tint="emerald" label="Projected monthly income" value={fmtMoney(model.monthlyTotal)} sub={`${fmtMoney(model.monthlyMatching)} matching + ${fmtMoney(model.monthlyReferral)} referral`} />
            <ResultCard icon={TimerReset} tint="amber" label={`${months}-month projection`} value={fmtMoney(model.horizon)} sub={`tier cap ${fmtMoney(model.cap)}/week applied`} />
            <ResultCard icon={Calculator} tint="indigo" label="Break-even on package" value={model.breakEvenWeeks === Infinity ? "—" : `${model.breakEvenWeeks.toFixed(1)} weeks`} sub={`package cost ${PKG_PRICE[tier]} USDT`} />
          </div>

          <Card>
            <CardContent className="p-5">
              <p className="mb-3 text-sm font-semibold text-slate-800">Income composition at {fmtCompact(network)} nodes</p>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-emerald-500" style={{ width: `${(model.monthlyMatching / model.monthlyTotal) * 100}%` }} />
                <div className="h-full bg-indigo-500" style={{ width: `${(model.monthlyReferral / model.monthlyTotal) * 100}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Binary matching · {fmtMoney(model.monthlyMatching)}/mo</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Referral · {fmtMoney(model.monthlyReferral)}/mo ({model.personalReferrals} direct/mo)</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Upline pool share → 72h SafetyHolding</span>
              </div>
              <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-600 sm:grid-cols-3">
                <div><p className="font-semibold text-slate-800">Weak leg volume</p><p className="mt-0.5">{fmtMoney(model.weakLeg)} USDT</p></div>
                <div><p className="font-semibold text-slate-800">Weekly matching (uncapped)</p><p className="mt-0.5">{fmtMoney(model.weakLeg * (matchingPct / 100))}</p></div>
                <div><p className="font-semibold text-slate-800">Tier cap headroom</p><p className="mt-0.5">{model.weeklyMatching < model.cap ? "Within cap" : "Capped — upgrade tier"}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <Fuel className="h-8 w-8 shrink-0 text-emerald-600" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-emerald-800">
                  Placement at {fmtCompact(network)} nodes: {currentGas.onChainGas.toLocaleString()} gas on-chain vs {currentGas.offChainGas.toLocaleString()} with BinaryMatrix sync
                </p>
                <p className="text-xs text-emerald-700">
                  {currentGas.savingPct}% cheaper · ${currentGas.onChainUsd.toFixed(3)} → ${currentGas.offChainUsd.toFixed(3)} per placement, and the gap grows linearly with network size
                </p>
              </div>
            </CardContent>
          </Card>

          <GasChartCard points={gasPoints} />

          <Card>
            <CardHeader className="cursor-pointer pb-3" onClick={() => setShowAssumptions(!showAssumptions)}>
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Info className="h-4 w-4 text-slate-400" /> Assumptions & formulas</span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showAssumptions ? "rotate-180" : ""}`} />
              </CardTitle>
            </CardHeader>
            {showAssumptions && (
              <CardContent className="space-y-2 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-600">
                <p><b>Matching bonus</b> = matching% × min(leftVol, rightVol) per weekly cycle, capped by tier (STARTER $1,000 · GROWTH $4,000 · SCALE $15,000).</p>
                <p><b>Referral income</b> = referral% × package value of each direct activation; sponsors compress past suspended ancestors.</p>
                <p><b>Weak-leg volume</b> = (network ÷ 2) × avg package × balance efficiency — a 2×N binary tree fills ~half its volume into each leg.</p>
                <p><b>Gas model</b> — on-chain BFS visits ≈ N/2 nodes (2,600 gas/iteration) + 21,000 base + 2 SSTOREs @ 2,100. BinaryMatrix commits a pre-computed slot: 21,000 base + 3 SSTOREs, independent of N. Base at 0.05 gwei, ETH = $3,200.</p>
                <p><b>Holding</b> — upline pool shares (6% default) are escrowed 72h; projections show gross, pre-release amounts.</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, display, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display: string; hint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-600">{label}</label>
        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} className="cursor-pointer" />
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

const RTINTS = {
  emerald: "border-emerald-200 bg-emerald-50/50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50/50 text-amber-700",
  indigo: "border-indigo-200 bg-indigo-50/50 text-indigo-700",
} as const;

function ResultCard({ icon: Icon, tint, label, value, sub }: { icon: typeof Calculator; tint: keyof typeof RTINTS; label: string; value: string; sub: string }) {
  return (
    <div className={`rounded-xl border p-4 ${RTINTS[tint]}`}>
      <Icon className="mb-2 h-4 w-4" />
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
      <p className="mt-0.5 text-[10px] opacity-70">{sub}</p>
    </div>
  );
}
