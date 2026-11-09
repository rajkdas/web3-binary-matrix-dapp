"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewKey =
  | "dashboard"
  | "matrix"
  | "analytics"
  | "calculator"
  | "admin"
  | "contracts";

export interface Identity {
  userId: number; // matrix node id this session is bound to
  name: string;
  email: string | null;
  wallet: string;
  provider: "email" | "google" | "x" | "metamask" | "demo";
  embedded: boolean; // true → ERC-4337 embedded wallet was provisioned
  isNew: boolean; // true → node was freshly minted via BFS placement
}

interface AppState {
  identity: Identity | null;
  view: ViewKey;
  feedOpen: boolean;
  authOpen: boolean;
  inviteOpen: boolean;
  hydrated: boolean;

  signIn: (id: Identity) => void;
  signOut: () => void;
  setView: (v: ViewKey) => void;
  setFeedOpen: (open: boolean) => void;
  setAuthOpen: (open: boolean) => void;
  setInviteOpen: (open: boolean) => void;
  setHydrated: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      identity: null,
      view: "dashboard",
      feedOpen: false,
      authOpen: false,
      inviteOpen: false,
      hydrated: false,

      signIn: (identity) => set({ identity, authOpen: false }),
      signOut: () => set({ identity: null, view: "dashboard" }),
      setView: (view) => set({ view }),
      setFeedOpen: (feedOpen) => set({ feedOpen }),
      setAuthOpen: (authOpen) => set({ authOpen }),
      setInviteOpen: (inviteOpen) => set({ inviteOpen }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "portagraph-session",
      partialize: (s) => ({ identity: s.identity, view: s.view }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
