#!/usr/bin/env npx tsx
// ============================================================
// Multi-Market Tick Collector — All Volatility Indices in Parallel
// ============================================================
// Equivalent to Karpathy's prepare.py data download step.
// Collects live tick data from ALL 5 Deriv volatility indices
// simultaneously to build a diverse, multi-market dataset.
//
// Usage:
//   npx tsx research/collect-all-markets.ts           # 5 min each
//   npx tsx research/collect-all-markets.ts 600        # 10 min each
//
// Output: 5 JSON files in research/data/, one per symbol.
// ============================================================

import WebSocket from "ws";
import * as fs from "fs";
import * as path from "path";
import type { Tick, TickDataset } from "./types";

const WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";

const ALL_SYMBOLS = [
  "1HZ100V", // Volatility 100 Index
  "1HZ75V",  // Volatility 75 Index
  "1HZ50V",  // Volatility 50 Index
  "1HZ25V",  // Volatility 25 Index
  "1HZ10V",  // Volatility 10 Index
];

const durationSec = parseInt(process.argv[2] || "300", 10);
const startTime = Date.now();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

console.log(`[Collector] Multi-market collection: ${ALL_SYMBOLS.length} symbols`);
console.log(`[Collector] Duration: ${durationSec}s (${(durationSec / 60).toFixed(1)} min)`);
console.log(`[Collector] Symbols: ${ALL_SYMBOLS.join(", ")}`);
console.log("");

// Ensure data directory exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

interface CollectorState {
  symbol: string;
  ticks: Tick[];
  ws: WebSocket | null;
  done: boolean;
}

function collectSymbol(symbol: string, delayMs: number): Promise<CollectorState> {
  return new Promise((resolve) => {
    const state: CollectorState = { symbol, ticks: [], ws: null, done: false };

    // Stagger connections by delayMs to avoid rate limits
    setTimeout(() => {
      const ws = new WebSocket(WS_URL);
      state.ws = ws;

      ws.on("open", () => {
        console.log(`[${symbol}] Connected. Subscribing...`);
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
          finalize(state);
          resolve(state);
        }, durationSec * 1000);
      });

      ws.on("message", (raw: Buffer) => {
        try {
          const data = JSON.parse(raw.toString());

          if (data.error) {
            console.error(`[${symbol}] API Error: ${data.error.code} — ${data.error.message}`);
            return;
          }

          if (data.msg_type === "tick" && data.tick) {
            state.ticks.push({
              quote: data.tick.quote,
              epoch: data.tick.epoch,
              symbol: data.tick.symbol,
            });

            // Progress every 100 ticks
            if (state.ticks.length % 100 === 0) {
              console.log(
                `[${symbol}] ${state.ticks.length} ticks | latest: ${data.tick.quote}`
              );
            }
          }
        } catch (e) {
          console.error(`[${symbol}] Parse error:`, e);
        }
      });

      ws.on("error", (err) => {
        console.error(`[${symbol}] WebSocket error:`, err.message);
        finalize(state);
        resolve(state);
      });

      ws.on("close", () => {
        if (!state.done) {
          finalize(state);
          resolve(state);
        }
      });
    }, delayMs);
  });
}

function finalize(state: CollectorState): void {
  if (state.done) return;
  state.done = true;

  if (state.ticks.length === 0) {
    console.error(`[${state.symbol}] No ticks collected!`);
    return;
  }

  const dataset: TickDataset = {
    symbol: state.symbol,
    collected_at: new Date().toISOString(),
    tick_count: state.ticks.length,
    duration_seconds: Math.round((Date.now() - startTime) / 1000),
    ticks: state.ticks,
  };

  const filename = `${state.symbol}_${timestamp}.json`;
  const outPath = path.join(dataDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));

  const prices = state.ticks.map((t) => t.quote);
  console.log(
    `[${state.symbol}] Saved ${state.ticks.length} ticks → ${filename} (range: ${Math.min(...prices).toFixed(2)} — ${Math.max(...prices).toFixed(2)})`
  );

  // Close WebSocket cleanly
  try {
    state.ws?.close();
  } catch {
    // ignore
  }
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log("\n[Collector] Interrupted. Saving all collected data...");
  process.exit(0);
});

async function main(): Promise<void> {
  // Stagger connections by 1 second to avoid rate limits
  const promises = ALL_SYMBOLS.map((symbol, i) =>
    collectSymbol(symbol, i * 1000)
  );

  const results = await Promise.all(promises);

  console.log("\n========================================");
  console.log("[Collector] Multi-market collection complete!");
  console.log("========================================");

  let totalTicks = 0;
  for (const r of results) {
    const status = r.ticks.length > 0 ? `${r.ticks.length} ticks` : "FAILED";
    console.log(`  ${r.symbol}: ${status}`);
    totalTicks += r.ticks.length;
  }

  const successCount = results.filter((r) => r.ticks.length > 0).length;
  console.log(`\n  Total: ${totalTicks} ticks across ${successCount}/${ALL_SYMBOLS.length} markets`);
  console.log(`  Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);

  process.exit(0);
}

main();
