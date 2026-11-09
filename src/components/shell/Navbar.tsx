"use client";

import { useApp, type ViewKey } from "@/store/app";
import { LiveDot, UserAvatar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Bell, Copy, GitBranch, LogOut, Menu, Network, Radio, BarChart3, Calculator, ShieldHalf, FileCode2, LayoutDashboard, Wallet } from "lucide-react";
import { shortAddr } from "@/lib/indexer";
import { toast } from "sonner";

const NAV: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "matrix", label: "Matrix", icon: GitBranch },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "calculator", label: "Calculator", icon: Calculator },
  { key: "admin", label: "Admin", icon: ShieldHalf },
  { key: "contracts", label: "Contracts", icon: FileCode2 },
];

export function Navbar({ unread }: { unread: number }) {
  const { view, setView, identity, signOut, setFeedOpen } = useApp();

  const copyRef = () => {
    navigator.clipboard.writeText(`https://portagraph.demo/join?ref=${identity?.userId ?? 1001}`)
      .then(() => toast.success("Referral link copied", { description: `ref=${identity?.userId ?? 1001} → BFS placement under your subtree` }))
      .catch(() => toast.error("Clipboard unavailable"));
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 lg:px-6">
        {/* brand */}
        <button className="flex items-center gap-2" onClick={() => setView("dashboard")}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
            <Network className="h-4.5 w-4.5" />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-slate-900">PortaGraph</span>
          <Badge variant="outline" className="hidden border-indigo-200 bg-indigo-50 text-[10px] font-semibold text-indigo-600 sm:inline-flex">MVP DEMO</Badge>
        </button>

        {/* desktop nav */}
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setView(n.key)}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                view === n.key ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {/* mobile menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Menu"><Menu className="h-5 w-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {NAV.map((n) => (
                <DropdownMenuItem key={n.key} onClick={() => setView(n.key)}>
                  <n.icon className="mr-2 h-4 w-4" /> {n.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 md:flex">
            <Radio className="h-3 w-3" /> Base Sepolia
          </span>

          <Button variant="ghost" size="icon" className="relative" aria-label="Chain activity" onClick={() => setFeedOpen(true)}>
            <Bell className="h-4.5 w-4.5 text-slate-600" />
            <LiveDot className="absolute right-1.5 top-1.5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
            )}
          </Button>

          {identity ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 transition-colors hover:border-slate-300 hover:shadow-sm">
                  <UserAvatar user={{ name: identity.name, avatarSeed: identity.name }} size={26} />
                  <span className="hidden text-[13px] font-medium text-slate-700 sm:inline">{identity.name.split(" ")[0]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{identity.name}</div>
                  <div className="flex items-center gap-1 font-mono text-[11px] font-normal text-slate-500">
                    <Wallet className="h-3 w-3" /> {shortAddr(identity.wallet)}
                    {identity.embedded && <Badge variant="outline" className="ml-1 border-indigo-200 bg-indigo-50 text-[9px] text-indigo-600">AA · ERC-4337</Badge>}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={copyRef}><Copy className="mr-2 h-4 w-4" /> Copy referral link</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-rose-600 focus:text-rose-700">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => useApp.getState().setAuthOpen(true)}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
