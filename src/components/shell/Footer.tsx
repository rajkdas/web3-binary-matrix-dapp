"use client";

import { Network } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-slate-500 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
            <Network className="h-3 w-3" />
          </span>
          <span className="font-semibold text-slate-700">BinaryMatrix</span>
          <span>— Web3 binary-matrix dApp · MVP demo build</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Base L2 · ERC-4337 · 2xN Binary Forced Matrix</span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span>Simulated chain — no real funds</span>
        </div>
      </div>
    </footer>
  );
}
