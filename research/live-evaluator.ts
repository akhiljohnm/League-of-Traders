// ============================================================
// Live Evaluator — Real-time strategy validation via Deriv WS
// ============================================================
// Connects to the Deriv WebSocket, collects live ticks,
// then runs the strategy against them using the same
// deterministic backtest engine. Used as Stage 2 validation
// to detect overfitting to pre-recorded data.
//
// This module is IMMUTABLE — the optimizer must NOT edit it.
// ============================================================

import WebSocket from "ws";
import { runBacktest, printResults } from "./backtest-engine";
import { createStrategy } from "./strategy";
import type { Tick, BacktestResult } from "./types";

const WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";
const TIMEOUT_MS = 7 * 60 * 1000; // 7 min safety timeout (Apple Silicon convention)

/**
 * Connect to the Deriv WebSocket, collect `targetTicks` live ticks,
 * then run the strategy against them using the immutable backtest engine.
 *
 * Returns the same BacktestResult as pre-recorded evaluation,
 * making scores directly comparable.
 */
export function runLiveEvaluation(
  symbol: string,
  targetTicks: number
): Promise<BacktestResult> {
  return new Promise((resolve, reject) => {
    const ticks: Tick[] = [];
    let resolved = false;

    console.log(`--- live_status:         connecting to ${symbol}...`);

    const ws = new WebSocket(WS_URL);

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;

      if (ticks.length > 0) {
        console.log(
          `--- live_status:         timeout after ${ticks.length} ticks (expected ${targetTicks})`
        );
        ws.close();
        const strategy = createStrategy();
        resolve(runBacktest(ticks, strategy));
      } else {
        ws.close();
        reject(new Error("Live evaluation timeout: no ticks received"));
      }
    }, TIMEOUT_MS);

    ws.on("open", () => {
      console.log(`--- live_status:         connected, collecting ${targetTicks} ticks...`);
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1, req_id: 1 }));

      // Keepalive ping
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: 1 }));
        }
      }, 25_000);

      ws.on("close", () => clearInterval(pingInterval));
    });

    ws.on("message", (raw: Buffer) => {
      if (resolved) return;

      try {
        const data = JSON.parse(raw.toString());

        if (data.error) {
          console.error(
            `--- live_error:          ${data.error.code} — ${data.error.message}`
          );
          return;
        }

        if (data.msg_type === "tick" && data.tick) {
          ticks.push({
            quote: data.tick.quote,
            epoch: data.tick.epoch,
            symbol: data.tick.symbol,
          });

          // Progress every 50 ticks
          if (ticks.length % 50 === 0) {
            console.log(
              `--- live_progress:       ${ticks.length}/${targetTicks} ticks`
            );
          }

          // Target reached — evaluate
          if (ticks.length >= targetTicks) {
            resolved = true;
            clearTimeout(timeout);

            console.log(
              `--- live_status:         ${ticks.length} ticks collected, evaluating...`
            );

            try {
              ws.send(JSON.stringify({ forget_all: ["ticks"] }));
              ws.close();
            } catch {
              // ignore cleanup errors
            }

            const strategy = createStrategy();
            const result = runBacktest(ticks, strategy);
            resolve(result);
          }
        }
      } catch (e) {
        console.error("--- live_error:          parse error:", e);
      }
    });

    ws.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      reject(new Error(`Live evaluation WebSocket error: ${err.message}`));
    });
  });
}
