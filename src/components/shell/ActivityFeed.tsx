"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventIcon, LiveDot, timeAgo, fmtUsdt } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app";
import type { ChainEventDTO } from "@/lib/api-types";
import { Pause, Play, Radio } from "lucide-react";

export function ActivityFeed({
  events, paused, setPaused, unread, clearUnread, channel = "socket",
}: {
  events: ChainEventDTO[];
  paused: boolean;
  setPaused: (p: boolean) => void;
  unread: number;
  clearUnread: () => void;
  channel?: "connecting" | "socket" | "polling";
}) {
  const { feedOpen, setFeedOpen } = useApp();

  const openFeed = (open: boolean) => {
    setFeedOpen(open);
    if (open) clearUnread();
  };

  return (
    <Sheet open={feedOpen} onOpenChange={openFeed}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base">Chain activity</SheetTitle>
              <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700">
                <LiveDot /> LIVE
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPaused(!paused)} className="h-8 gap-1 text-xs text-slate-500">
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
          </div>
          <SheetDescription className="text-xs">
            Simulated stream from <span className="font-medium">PortaGraphRegistry</span> · <span className="font-medium">CampaignManager</span> · <span className="font-medium">SafetyHolding</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="divide-y divide-slate-100">
            {events.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-400">Waiting for chain events…</p>
            )}
            {events.map((e) => (
              <div key={e.id} className={cn("flex gap-3 px-5 py-3 transition-colors hover:bg-slate-50", e.live && !e.ambient && "bg-indigo-50/40")}>
                <EventIcon type={e.type} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-slate-800">{e.headline}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{timeAgo(e.createdAt)}</span>
                    {e.txHash && <span className="font-mono">{e.txHash.slice(0, 10)}…</span>}
                    {e.ambient && (
                      <Badge variant="outline" className="h-4 border-slate-200 px-1 text-[9px] text-slate-400">
                        <Radio className="mr-0.5 h-2.5 w-2.5" /> net
                      </Badge>
                    )}
                  </div>
                </div>
                {e.amount != null && (
                  <span className={cn("shrink-0 text-xs font-semibold", e.type === "FEE_SPLIT" || e.type === "HOLD_RELEASE" ? "text-emerald-600" : "text-slate-500")}>
                    {fmtUsdt(e.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t border-slate-100 px-5 py-2.5 text-center text-[11px] text-slate-400">
          socket.io · {paused ? "paused — events will drop" : channel === "socket" ? "streaming in real time" : channel === "polling" ? "polling indexer fallback (every 9s)" : "connecting…"}
        </div>
      </SheetContent>
    </Sheet>
  );
}
