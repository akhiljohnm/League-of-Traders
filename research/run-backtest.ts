#!/usr/bin/env npx tsx
// ============================================================
// Backtest Runner — Load ticks, run strategy, print results
// ============================================================
// Usage:
//   npx tsx research/run-backtest.ts               # All datasets
//   npx tsx research/run-backtest.ts --all          # All datasets
//   npx tsx research/run-backtest.ts <file>         # Single dataset
//   npx tsx research/run-backtest.ts --all --live   # All + live validation
//
// Output: Karpathy-format structured results to stdout.
// The optimizer agent greps for "--- avg_score:" to keep/discard.
// ============================================================

import * as fs from "fs";
import * as path from "path";
import { runBacktest, loadTickDataset, printResults } from "./backtest-engine";
import { createStrategy } from "./strategy";
import type { BacktestResult } from "./types";

function pad(key: string, val: string): string {
  return `--- ${(key + ":").padEnd(22)} ${val}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getDataFiles(): string[] {
  const dataDir = path.join(__dirname, "data");
  if (!fs.existsSync(dataDir)) {
    console.error("[Runner] No data directory found. Run collect-all-markets.ts first.");
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dataDir, f))
    .sort();

  if (files.length === 0) {
    console.error("[Runner] No tick data files found in research/data/");
    console.error("[Runner] Run: npx tsx research/collect-all-markets.ts");
    process.exit(1);
  }

  return files;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isLive = args.includes("--live");
  const nonFlagArgs = args.filter((a) => !a.startsWith("--"));

  let files: string[];

  if (nonFlagArgs.length > 0 && fs.existsSync(nonFlagArgs[0])) {
    files = [nonFlagArgs[0]];
  } else {
    files = getDataFiles();
    console.log(`[Runner] Running against ${files.length} dataset(s)...\n`);
  }

  const results: BacktestResult[] = [];

  for (const file of files) {
    const dataset = loadTickDataset(file);
    console.log(
      `[Runner] Dataset: ${path.basename(file)} (${dataset.tick_count} ticks, ${dataset.symbol})`
    );

    const strategy = createStrategy();
    const result = runBacktest(dataset.ticks, strategy);
    results.push(result);

    printResults(result);
    console.log("");
  }

  // Print aggregate (the optimization target)
  if (results.length > 0) {
    const avgScore = round2(results.reduce((s, r) => s + r.score, 0) / results.length);
    const avgPnl = round2(results.reduce((s, r) => s + r.net_pnl, 0) / results.length);
    const avgWinRate = round2(results.reduce((s, r) => s + r.win_rate, 0) / results.length);
    const avgSharpe = round2(results.reduce((s, r) => s + r.sharpe_ratio, 0) / results.length);
    const totalTrades = results.reduce((s, r) => s + r.total_trades, 0);
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    console.log(pad("avg_score", String(avgScore)));
    console.log(pad("datasets", String(results.length)));
    console.log(pad("avg_net_pnl", String(avgPnl)));
    console.log(pad("avg_win_rate", avgWinRate + "%"));
    console.log(pad("avg_sharpe", String(avgSharpe)));
    console.log(pad("total_trades", String(totalTrades)));
    console.log(pad("peak_mem_mb", String(memUsage)));
    console.log(pad("status", "ok"));
  }

  // Stage 2: Live validation (optional)
  if (isLive) {
    console.log("\n" + pad("live_validation", "starting..."));

    try {
      const { runLiveEvaluation } = await import("./live-evaluator");
      const liveResult = await runLiveEvaluation("1HZ100V", 300);

      console.log("\n" + pad("live_score", String(liveResult.score)));
      console.log(pad("live_net_pnl", String(liveResult.net_pnl)));
      console.log(pad("live_win_rate", liveResult.win_rate + "%"));
      console.log(pad("live_trades", String(liveResult.total_trades)));
      console.log(pad("live_status", "ok"));

      // Compare to pre-recorded score
      if (results.length > 0) {
        const avgScore = round2(results.reduce((s, r) => s + r.score, 0) / results.length);
        const scoreDelta = round2(liveResult.score - avgScore);
        console.log(pad("live_vs_recorded", `${scoreDelta > 0 ? "+" : ""}${scoreDelta}`));

        if (scoreDelta < -10) {
          console.log(pad("overfitting_warning", "live score significantly lower than recorded"));
        }
      }
    } catch (err) {
      console.error(pad("live_error", String(err)));
    }
  }
}

main();
