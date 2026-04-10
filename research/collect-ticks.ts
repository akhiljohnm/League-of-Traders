#!/usr/bin/env npx tsx
// ============================================================
// Tick Data Collector — Records live Deriv ticks to JSON
// ============================================================
// Usage:
//   npx tsx research/collect-ticks.ts [symbol] [duration_seconds]
//
// Examples:
//   npx tsx research/collect-ticks.ts                  # 1HZ100V, 5 min
//   npx tsx research/collect-ticks.ts 1HZ100V 600      # 10 min
//   npx tsx research/collect-ticks.ts 1HZ50V 300       # Vol 50, 5 min
//
// Output: research/data/<symbol>_<timestamp>.json
// ============================================================

import WebSocket from "ws";
import * as fs from "fs";
import * as path from "path";
import type { Tick, TickDataset } from "./types";

// Deriv API V2 public WebSocket — no auth required
const WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";

const symbol = process.argv[2] || "1HZ100V";
const durationSec = parseInt(process.argv[3] || "300", 10);

console.log(`[Collector] Symbol: ${symbol}`);
console.log(`[Collector] Duration: ${durationSec}s (${(durationSec / 60).toFixed(1)} min)`);
console.log(`[Collector] Connecting to ${WS_URL}...`);

const ticks: Tick[] = [];
const startTime = Date.now();

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("[Collector] Connected. Subscribing to tick stream...");
  ws.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: 1 }));

  // Keepalive ping
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ping: 1 }));
    }
  }, 25_000);

  // Auto-stop after duration
  setTimeout(() => {
    clearInterval(pingInterval);
    console.log(`\n[Collector] Duration reached. Saving ${ticks.length} ticks...`);
    saveAndExit();
  }, durationSec * 1000);
});

ws.on("message", (raw: Buffer) => {
  try {
    const data = JSON.parse(raw.toString());

    if (data.error) {
      console.error(`[Collector] API Error: ${data.error.code} — ${data.error.message}`);
      return;
    }

    if (data.msg_type === "tick" && data.tick) {
      const tick: Tick = {
        quote: data.tick.quote,
        epoch: data.tick.epoch,
        symbol: data.tick.symbol,
      };
      ticks.push(tick);

      // Progress indicator every 50 ticks
      if (ticks.length % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(
          `[Collector] ${ticks.length} ticks collected (${elapsed}s elapsed) | latest: ${tick.quote}`
        );
      }
    }
  } catch (e) {
    console.error("[Collector] Parse error:", e);
  }
});

ws.on("error", (err) => {
  console.error("[Collector] WebSocket error:", err.message);
});

ws.on("close", (code, reason) => {
  console.log(`[Collector] WebSocket closed (code: ${code})`);
  if (ticks.length > 0) {
    saveAndExit();
  } else {
    process.exit(1);
  }
});

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log(`\n[Collector] Interrupted. Saving ${ticks.length} ticks...`);
  saveAndExit();
});

function saveAndExit(): void {
  if (ticks.length === 0) {
    console.error("[Collector] No ticks collected. Exiting.");
    process.exit(1);
  }

  const dataset: TickDataset = {
    symbol,
    collected_at: new Date().toISOString(),
    tick_count: ticks.length,
    duration_seconds: Math.round((Date.now() - startTime) / 1000),
    ticks,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${symbol}_${timestamp}.json`;
  const outPath = path.join(__dirname, "data", filename);

  // Ensure data directory exists
  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));
  console.log(`[Collector] Saved to ${outPath}`);
  console.log(`[Collector] ${ticks.length} ticks over ${dataset.duration_seconds}s`);
  console.log(`[Collector] Price range: ${Math.min(...ticks.map((t) => t.quote)).toFixed(2)} — ${Math.max(...ticks.map((t) => t.quote)).toFixed(2)}`);

  // Close WebSocket cleanly
  try {
    ws.close();
  } catch {
    // ignore
  }
  process.exit(0);
}
