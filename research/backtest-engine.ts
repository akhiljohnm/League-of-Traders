// ============================================================
// Backtest Engine — IMMUTABLE (do NOT modify this file)
// ============================================================
// This is the ground-truth evaluator for the auto-research loop.
// It replays recorded tick data against a strategy, simulates
// Rise/Fall trades, and produces a single composite score.
//
// Equivalent to Karpathy's prepare.py — the optimizer agent
// must NEVER edit this file. Only strategy.ts is mutable.
// ============================================================

import type {
  Tick,
  TickDataset,
  StrategyInstance,
  SimulatedTrade,
  BacktestResult,
  TradeDecision,
} from "./types";

// ---- Constants (match the game's real payout math) ----

const RISE_PAYOUT = 1.954;
const FALL_PAYOUT = 1.952;
const TRADE_DURATION_TICKS = 5;
const BUY_IN = 10_000;

function getPayoutMultiplier(direction: "UP" | "DOWN"): number {
  return direction === "UP" ? RISE_PAYOUT : FALL_PAYOUT;
}

function didTradeWin(
  direction: "UP" | "DOWN",
  entryPrice: number,
  exitPrice: number
): boolean {
  if (direction === "UP") return exitPrice > entryPrice;
  if (direction === "DOWN") return exitPrice < entryPrice;
  return false;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- Pending trade tracker ----

interface PendingTrade {
  direction: "UP" | "DOWN";
  stake: number;
  entryPrice: number;
  entryTick: number;
}

// ---- Core backtest function ----

export function runBacktest(
  ticks: Tick[],
  strategy: StrategyInstance
): BacktestResult {
  strategy.reset();

  let balance = BUY_IN;
  const pendingTrades: PendingTrade[] = [];
  const completedTrades: SimulatedTrade[] = [];
  let peakBalance = balance;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  // PnL series for Sharpe calculation
  const tradePnls: number[] = [];

  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];

    // 1. Resolve matured trades
    const stillPending: PendingTrade[] = [];
    for (const pt of pendingTrades) {
      if (i - pt.entryTick >= TRADE_DURATION_TICKS) {
        const exitPrice = tick.quote;
        const won = didTradeWin(pt.direction, pt.entryPrice, exitPrice);
        const multiplier = getPayoutMultiplier(pt.direction);
        const grossPayout = won ? round2(pt.stake * multiplier) : 0;
        const netPnl = won ? round2(grossPayout - pt.stake) : -pt.stake;

        balance = round2(balance + grossPayout);
        tradePnls.push(netPnl);

        completedTrades.push({
          entryPrice: pt.entryPrice,
          exitPrice,
          direction: pt.direction,
          stake: pt.stake,
          won,
          grossPayout,
          netPnl,
          entryTick: pt.entryTick,
          exitTick: i,
        });
      } else {
        stillPending.push(pt);
      }
    }
    pendingTrades.length = 0;
    pendingTrades.push(...stillPending);

    // 2. Feed tick to strategy
    const decision: TradeDecision | null = strategy.onTick(tick, balance, BUY_IN);

    // 3. Execute trade decision
    if (decision) {
      const actualStake = Math.min(decision.stake, balance);
      if (actualStake > 0) {
        balance = round2(balance - actualStake);
        pendingTrades.push({
          direction: decision.direction,
          stake: actualStake,
          entryPrice: tick.quote,
          entryTick: i,
        });
      }
    }

    // 4. Track drawdown
    if (balance > peakBalance) peakBalance = balance;
    const dd = peakBalance - balance;
    if (dd > maxDrawdown) {
      maxDrawdown = round2(dd);
      maxDrawdownPct = round2((dd / peakBalance) * 100);
    }
  }

  // Force-resolve any remaining pending trades at last tick
  const lastTick = ticks[ticks.length - 1];
  for (const pt of pendingTrades) {
    const exitPrice = lastTick.quote;
    const won = didTradeWin(pt.direction, pt.entryPrice, exitPrice);
    const multiplier = getPayoutMultiplier(pt.direction);
    const grossPayout = won ? round2(pt.stake * multiplier) : 0;
    const netPnl = won ? round2(grossPayout - pt.stake) : -pt.stake;

    balance = round2(balance + grossPayout);
    tradePnls.push(netPnl);

    completedTrades.push({
      entryPrice: pt.entryPrice,
      exitPrice,
      direction: pt.direction,
      stake: pt.stake,
      won,
      grossPayout,
      netPnl,
      entryTick: pt.entryTick,
      exitTick: ticks.length - 1,
    });
  }

  // ---- Compute aggregate metrics ----

  const wins = completedTrades.filter((t) => t.won).length;
  const losses = completedTrades.length - wins;
  const winRate = completedTrades.length > 0 ? wins / completedTrades.length : 0;
  const netPnl = round2(balance - BUY_IN);

  // Sharpe ratio (annualized isn't meaningful here; use raw mean/std of trade PnLs)
  const sharpe = computeSharpe(tradePnls);

  // Profit factor = gross wins / gross losses
  const grossWins = completedTrades
    .filter((t) => t.won)
    .reduce((s, t) => s + t.netPnl, 0);
  const grossLosses = Math.abs(
    completedTrades.filter((t) => !t.won).reduce((s, t) => s + t.netPnl, 0)
  );
  const profitFactor = grossLosses > 0 ? round2(grossWins / grossLosses) : grossWins > 0 ? Infinity : 0;

  // ---- Composite score ----
  // Primary optimization target. Weighted combination of:
  //   - Net PnL (normalized by buy-in)
  //   - Sharpe ratio (risk-adjusted returns)
  //   - Win rate bonus (consistency)
  // Lower is NOT better here — higher score = better strategy.
  const pnlNorm = netPnl / BUY_IN; // e.g., +0.05 means +5%
  const score = round2(pnlNorm * 100 + sharpe * 20 + winRate * 10);

  return {
    score,
    net_pnl: netPnl,
    final_balance: round2(balance),
    total_trades: completedTrades.length,
    wins,
    losses,
    win_rate: round2(winRate * 100),
    sharpe_ratio: round2(sharpe),
    max_drawdown: maxDrawdown,
    max_drawdown_pct: maxDrawdownPct,
    profit_factor: profitFactor,
    strategy_name: strategy.name,
    ticks_processed: ticks.length,
    trades: completedTrades,
  };
}

// ---- Sharpe ratio helper ----

function computeSharpe(pnls: number[]): number {
  if (pnls.length < 2) return 0;
  const mean = pnls.reduce((s, p) => s + p, 0) / pnls.length;
  const variance =
    pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / (pnls.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return round2(mean / stdDev);
}

// ---- Dataset loader ----

export function loadTickDataset(filePath: string): TickDataset {
  const fs = require("fs");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as TickDataset;
}

// ---- Structured output printer (machine-parseable, Karpathy format) ----

function pad(key: string, val: string): string {
  return `--- ${(key + ":").padEnd(22)} ${val}`;
}

export function printResults(result: BacktestResult): void {
  console.log(pad("strategy", result.strategy_name));
  console.log(pad("score", String(result.score)));
  console.log(pad("net_pnl", String(result.net_pnl)));
  console.log(pad("final_balance", String(result.final_balance)));
  console.log(pad("total_trades", String(result.total_trades)));
  console.log(pad("wins", String(result.wins)));
  console.log(pad("losses", String(result.losses)));
  console.log(pad("win_rate", result.win_rate + "%"));
  console.log(pad("sharpe_ratio", String(result.sharpe_ratio)));
  console.log(pad("max_drawdown", String(result.max_drawdown)));
  console.log(pad("max_drawdown_pct", result.max_drawdown_pct + "%"));
  console.log(pad("profit_factor", String(result.profit_factor)));
  console.log(pad("ticks_processed", String(result.ticks_processed)));
}
