/**
 * PortaGraph Event Stream — live "on-chain" feed
 *
 * Standalone socket.io service (port 3003). Two responsibilities:
 *  1. AMBIENT SIMULATION — emits realistic Registry/Campaign/SafetyHolding
 *     events for the wider PortaGraph network (#2xxx positions) every few
 *     seconds so the activity feed feels alive during the demo.
 *  2. RELAY — the Next.js API layer holds a persistent socket connection and
 *     emits `relay:event`; this service re-broadcasts it as `chain:event`
 *     to every connected dashboard.
 */
import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy forwards on it
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── ambient event factory (external network #2xxx — beyond the demo org) ────
const NAMES = [
  "Lena Fischer", "Tomás Herrera", "Aria Nakamura", "Victor Osei", "Isla Murray",
  "Ruben Costa", "Hana Kim", "Pavel Novak", "Maya Rosen", "Otto Berg",
  "Zara Iqbal", "Nils Andersen", "Celine Laurent", "Bruno Alves", "Suki Tan",
];
const PKGS = ["STARTER", "STARTER", "GROWTH", "GROWTH", "SCALE"] as const;
const AMBIENTS = 2100 + Math.floor(Math.random() * 400);

let txSeq = Math.floor(Math.random() * 0xffffff);
const tx = () => {
  txSeq = (txSeq * 16807 + 11) % 0x7fffffff;
  return `0x${txSeq.toString(16).padStart(6, "0")}${Math.random().toString(16).slice(2, 10)}…${Math.random().toString(16).slice(2, 6)}`;
};

function ambientEvent() {
  const roll = Math.random();
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const pos = AMBIENTS + Math.floor(Math.random() * 900);
  const pkg = PKGS[Math.floor(Math.random() * PKGS.length)];
  const fee = { STARTER: 100, GROWTH: 500, SCALE: 1500 }[pkg];
  const base = {
    id: `amb-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    txHash: tx(),
    blockNumber: 4_938_400 + Math.floor(Math.random() * 4000),
    createdAt: new Date().toISOString(),
    ambient: true,
  };

  if (roll < 0.42) {
    return { ...base, type: "JOIN", actorId: pos, actorName: name,
      headline: `${name} activated #${pos} · ${pkg} package (external network)`,
      amount: fee };
  }
  if (roll < 0.72) {
    const usdt = +(Math.random() * fee * 0.18 + 6).toFixed(1);
    return { ...base, type: "FEE_SPLIT", actorId: pos, actorName: name,
      headline: `Fee split ${usdt} USDT on #${pos} — ${1 + Math.floor(Math.random() * 4)} beneficiaries paid`,
      amount: usdt };
  }
  if (roll < 0.86) {
    const usdt = +(Math.random() * 180 + 20).toFixed(1);
    return { ...base, type: "HOLD_RELEASE", actorId: pos, actorName: name,
      headline: `SafetyHolding released ${usdt} USDT to #${pos} after 72h grace`,
      amount: usdt };
  }
  return { ...base, type: "COMPRESSION", actorId: pos, actorName: name,
    headline: `Upline #${pos} suspended — splits compressed to next active ancestor`,
    amount: null };
}

io.on("connection", (socket) => {
  console.log(`[feed] client connected: ${socket.id}`);

  socket.on("relay:event", (event: Record<string, unknown>) => {
    // re-broadcast API-produced events to every dashboard
    io.emit("chain:event", { ...event, relayed: true });
  });

  socket.on("feed:ping", () => socket.emit("feed:pong", Date.now()));
  socket.on("disconnect", () => console.log(`[feed] disconnected: ${socket.id}`));
});

// ambient heartbeat — every 4.5–8s a fresh simulated chain event
(function loop() {
  setTimeout(() => {
    io.emit("chain:event", ambientEvent());
    loop();
  }, 4500 + Math.random() * 3500);
})();

httpServer.listen(3003, () => console.log("[feed] PortaGraph event stream on :3003"));
