"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Navbar } from "@/components/shell/Navbar";
import { Footer } from "@/components/shell/Footer";
import { ActivityFeed } from "@/components/shell/ActivityFeed";
import { AuthModal } from "@/components/auth/AuthModal";
import { Landing } from "@/components/landing/Landing";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { MatrixView } from "@/components/matrix/MatrixView";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { CalculatorView } from "@/components/calculator/CalculatorView";
import { AdminView } from "@/components/admin/AdminView";
import { ContractsView } from "@/components/contracts/ContractsView";
import { useApp } from "@/store/app";
import type { ChainEventDTO, NetworkSnapshot } from "@/lib/api-types";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  const { identity, view, hydrated, feedOpen } = useApp();
  const [snap, setSnap] = useState<NetworkSnapshot | null>(null);
  const [feedEvents, setFeedEvents] = useState<ChainEventDTO[]>([]);
  const [paused, setPaused] = useState(false);
  const [unread, setUnread] = useState(0);
  const pausedRef = useRef(paused);
  const feedOpenRef = useRef(feedOpen);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { feedOpenRef.current = feedOpen; }, [feedOpen]);

  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  const identityUserId = identity?.userId;
  // identity switches re-run the fetch naturally — no cascading setState
  const syncKey = `${reloadKey}:${identityUserId ?? "anon"}`;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/network", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: NetworkSnapshot) => {
        if (cancelled) return;
        // identity points at a node that is no longer in the mirror (db reset) → clean session
        if (identityUserId != null && !data.users.some((u) => u.id === identityUserId)) {
          signOut();
          return;
        }
        setSnap(data);
        setFeedEvents((prev) => (prev.length === 0 ? data.events : prev));
      })
      .catch(() => {
        // network hiccup during hot reload — next reloadKey retry picks it up
      });
    return () => { cancelled = true; };
  }, [syncKey]);

  // live chain feed — socket.io through the gateway, with polling fallback
  const [feedChannel, setFeedChannel] = useState<"connecting" | "socket" | "polling">("connecting");
  useEffect(() => {
    const push = (e: ChainEventDTO) => {
      if (pausedRef.current) return;
      setFeedEvents((prev) => (prev.some((x) => x.id === e.id) ? prev : [e, ...prev].slice(0, 80)));
      if (!feedOpenRef.current) setUnread((u) => Math.min(99, u + 1));
    };

    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      timeout: 8000,
    });
    socket.on("connect", () => setFeedChannel("socket"));
    socket.on("chain:event", push);

    // fallback: if the socket never connects (e.g. proxy strips upgrades),
    // poll the indexer API for new ledger events so the feed still moves
    const fallbackTimer = setTimeout(() => {
      setFeedChannel((ch) => (ch === "socket" ? ch : "polling"));
    }, 6000);
    const poll = setInterval(() => {
      fetch("/api/events", { cache: "no-store" })
        .then((r) => r.json())
        .then((events: ChainEventDTO[]) => {
          setFeedChannel((ch) => {
            if (ch === "socket") return ch;
            for (const e of events.slice(0, 4)) push(e);
            return ch;
          });
        })
        .catch(() => {});
    }, 9000);

    return () => { socket.disconnect(); clearTimeout(fallbackTimer); clearInterval(poll); };
  }, []);

  const clearUnread = useCallback(() => setUnread(0), []);

  // hydrating / first paint
  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Skeleton className="h-14 w-full rounded-none" />
        <div className="mx-auto w-full max-w-[1400px] flex-1 space-y-4 p-6">
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Footer />
      </div>
    );
  }

  // unauthenticated: marketing landing, or public views reachable from it
  if (!identity) {
    if (view === "contracts" || view === "calculator") {
      return (
        <div className="flex min-h-screen flex-col bg-slate-50">
          <Navbar unread={unread} />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-6">
            {view === "contracts" ? <ContractsView events={snap?.events ?? []} /> : <CalculatorView />}
          </main>
          <Footer />
          <AuthModal />
          <ActivityFeed events={feedEvents} paused={paused} setPaused={setPaused} unread={unread} clearUnread={clearUnread} channel={feedChannel} />
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Landing liveEvents={feedEvents.length} />
        <AuthModal />
      </div>
    );
  }

  // authenticated application shell
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar unread={unread} />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-6">
        {!snap ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-72" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <>
            {view === "dashboard" && <DashboardView snap={snap} onRefresh={refresh} />}
            {view === "matrix" && <MatrixView snap={snap} onRefresh={refresh} />}
            {view === "analytics" && <AnalyticsView snap={snap} />}
            {view === "calculator" && <CalculatorView />}
            {view === "admin" && <AdminView snap={snap} onRefresh={refresh} />}
            {view === "contracts" && <ContractsView events={snap.events} />}
          </>
        )}
      </main>
      <Footer />
      <AuthModal />
      <ActivityFeed events={feedEvents} paused={paused} setPaused={setPaused} unread={unread} clearUnread={clearUnread} channel={feedChannel} />
    </div>
  );
}
