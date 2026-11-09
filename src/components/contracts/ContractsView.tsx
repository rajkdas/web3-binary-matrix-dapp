"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ChainEventDTO } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { FileCode2, FileCheck2, Rocket, Server, ArrowRight, Layers, ShieldCheck } from "lucide-react";

interface ContractFile {
  key: string;
  label: string;
  path: string;
  code: string;
  loc: number;
  test?: boolean;
}

const DEPLOYMENT = [
  { name: "PortaGraphRegistry", address: "0x7fa9…1496", note: "SBT matrix root — immutable, no owner upgrade", icon: Layers },
  { name: "CampaignManager", address: "0x9d3c…84a1", note: "Upline compression + instant fee splits", icon: Rocket },
  { name: "SafetyHolding", address: "0xe1f4…0c77", note: "72h grace escrow · 2-of-3 signer", icon: ShieldCheck },
  { name: "EntryPoint (ERC-4337)", address: "0x5ff1…37e9", note: "Bundler + paymaster · USDT/USDC gas depot", icon: Server },
];

const FLOW = [
  { step: "Web2.5 login", detail: "Privy-style OIDC → embedded ERC-4337 account" },
  { step: "Indexer BFS", detail: "off-chain search on the Postgres mirror" },
  { step: "Registry.placeAt()", detail: "immutable (parent, side) SBT binding" },
  { step: "Campaign.splitFee()", detail: "referral + pool + treasury, one tx" },
  { step: "SafetyHolding.hold()", detail: "72h grace for the upline pool" },
];

export function ContractsView({ events }: { events: ChainEventDTO[] }) {
  const [files, setFiles] = useState<ContractFile[] | null>(null);
  const [active, setActive] = useState("registry");

  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => {
        setFiles(d.files);
        setActive(d.files[0]?.key ?? "registry");
      })
      .catch(() => setFiles([]));
  }, []);

  const current = useMemo(() => files?.find((f) => f.key === active), [files, active]);
  const blockGap = useMemo(() => {
    // quick "live chain" flavor: avg block gap from recent seeded events
    if (events.length < 2) return 14;
    const s = [...events].sort((a, b) => a.blockNumber - b.blockNumber);
    return Math.max(1, Math.round((s[s.length - 1].blockNumber - s[0].blockNumber) / s.length));
  }, [events]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Smart contracts</h1>
        <p className="text-sm text-slate-500">Solidity 0.8.24 · OpenZeppelin · Foundry test suite — the same sources the indexer mirrors</p>
      </div>

      {/* deployment strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {DEPLOYMENT.map((d) => (
          <Card key={d.name} className="border-slate-200">
            <CardContent className="flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <d.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-800">{d.name}</p>
                <p className="font-mono text-[11px] text-indigo-600">{d.address}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{d.note}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* call flow */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-2 gap-y-2 p-4 text-xs">
          <span className="mr-1 font-semibold text-slate-500">ACTIVATION FLOW</span>
          {FLOW.map((f, i) => (
            <span key={f.step} className="flex items-center gap-2">
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <b className="text-slate-800">{f.step}</b>
                <span className="ml-1.5 hidden text-slate-400 md:inline">{f.detail}</span>
              </span>
              {i < FLOW.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700">
            avg block gap ~{blockGap} · Base Sepolia
          </span>
        </CardContent>
      </Card>

      {/* code viewer */}
      <Card className="overflow-hidden">
        <div className="flex flex-col border-b border-slate-200 lg:flex-row">
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/70 p-2 lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
            {(files ?? []).map((f) => (
              <button key={f.key} onClick={() => setActive(f.key)}
                className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors lg:w-full",
                  active === f.key ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "text-slate-600 hover:bg-slate-100")}>
                {f.test ? <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <FileCode2 className="h-3.5 w-3.5 shrink-0 text-indigo-500" />}
                <span className="truncate">{f.label}</span>
                <span className="ml-auto hidden text-[10px] text-slate-400 lg:inline">{f.loc} LOC</span>
              </button>
            ))}
            {!files && <div className="space-y-2 p-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-full" />)}</div>}
          </div>

          <div className="min-w-0 flex-1">
            {current && (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                  <span className="font-mono text-xs text-slate-500">{current.path}</span>
                  <Badge variant="outline" className={cn("text-[10px]", current.test ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-indigo-200 bg-indigo-50 text-indigo-600")}>
                    {current.test ? "FORGE TEST" : "SOLIDITY 0.8.24"}
                  </Badge>
                  <span className="ml-auto text-[11px] text-slate-400">{current.loc} lines</span>
                </div>
                <div className="max-h-[560px] overflow-auto bg-white">
                  <SyntaxHighlighter
                    language="solidity"
                    style={oneLight}
                    showLineNumbers
                    customStyle={{ margin: 0, padding: "18px 20px", background: "transparent", fontSize: "12.5px", lineHeight: 1.65 }}
                    lineNumberStyle={{ color: "#c4cbd8", minWidth: "2.2em", userSelect: "none" }}
                    codeTagProps={{ style: { fontFamily: "var(--font-geist-mono), ui-monospace, monospace" } }}
                  >
                    {current.code}
                  </SyntaxHighlighter>
                </div>
              </>
            )}
            {!current && !files && <div className="space-y-3 p-6">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>}
          </div>
        </div>
      </Card>
    </div>
  );
}
