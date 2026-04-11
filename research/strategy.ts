// ============================================================
// MUTABLE STRATEGY FILE — The optimizer edits THIS file only
// ============================================================
// This is the equivalent of Karpathy's train.py.
// The auto-research LLM agent will modify the hyperparameters,
// indicator logic, and decision rules in this file to maximize
// the backtest `score`.
//
// RULES:
// 1. Must export `createStrategy(): StrategyInstance`
// 2. Must conform to the StrategyInstance interface
// 3. All hyperparameters go in the PARAMS block at the top
// 4. Keep it in a single file — no imports except ./types
// ============================================================

import type { Tick, TradeDecision, StrategyInstance } from "./types";

// ============================================================
// HYPERPARAMETERS — Tune these
// ============================================================

const PARAMS = {
  // EMA for trend direction gate
  shortWindow: 8,            // Short EMA period
  longWindow: 21,            // Long EMA period

  // Donchian Channel breakout (price action signal)
  donchianWindow: 8,         // N-tick high/low breakout threshold

  // Trade Management
  contractDuration: 4,       // Ticks per contract
  stakePercent: 0.14,        // Fraction of balance per trade
  cooldownTicks: 3,          // Min ticks between signal trades
  minTicks: 15,              // Warmup period before first trade
};

// ============================================================
// STRATEGY IMPLEMENTATION
// ============================================================

function updateEMA(current: number | null, price: number, period: number): number {
  if (current === null) return price;
  const k = 2 / (period + 1);
  return price * k + current * (1 - k);
}

export function createStrategy(): StrategyInstance {
  let shortEMA: number | null = null;
  let longEMA: number | null = null;
  let priceHistory: number[] = [];
  let lastPrice: number | null = null;
  let ticksSinceLastTrade = PARAMS.cooldownTicks;
  let totalTicks = 0;

  return {
    name: "AutoResearch Donchian8 + EMA trend gate cd3 s14 dur4",

    onTick(tick: Tick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      totalTicks++;
      ticksSinceLastTrade++;

      priceHistory.push(price);
      if (priceHistory.length > PARAMS.donchianWindow * 4) {
        priceHistory = priceHistory.slice(-PARAMS.donchianWindow * 4);
      }

      shortEMA = updateEMA(shortEMA, price, PARAMS.shortWindow);
      longEMA = updateEMA(longEMA, price, PARAMS.longWindow);

      const prevPrice = lastPrice;
      lastPrice = price;

      if (totalTicks < PARAMS.minTicks) return null;

      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      if (ticksSinceLastTrade < PARAMS.cooldownTicks) return null;

      if (shortEMA === null || longEMA === null) return null;

      // ---- EMA trend direction ----
      const emaUptrend = shortEMA > longEMA;
      const emaDowntrend = shortEMA < longEMA;

      // ---- Donchian Channel Breakout ----
      if (priceHistory.length <= PARAMS.donchianWindow) return null;
      const lookback = priceHistory.slice(-(PARAMS.donchianWindow + 1), -1); // N ticks before current
      const highestBefore = Math.max(...lookback);
      const lowestBefore = Math.min(...lookback);

      // ---- Micro-Momentum ----
      const momentumUp = prevPrice !== null && price > prevPrice;
      const momentumDown = prevPrice !== null && price < prevPrice;

      // Fire on Donchian breakout + EMA alignment + momentum
      // Price breaks above N-tick high AND EMA in uptrend AND momentum up
      let direction: "UP" | "DOWN" | null = null;
      if (price > highestBefore && emaUptrend && momentumUp) direction = "UP";
      else if (price < lowestBefore && emaDowntrend && momentumDown) direction = "DOWN";

      if (direction === null) return null;

      const stakeAmt = Math.round(balance * PARAMS.stakePercent * 100) / 100;
      if (stakeAmt < minStake) return null;

      ticksSinceLastTrade = 0;
      return { direction, stake: stakeAmt, duration: PARAMS.contractDuration };
    },

    reset() {
      shortEMA = null;
      longEMA = null;
      priceHistory = [];
      lastPrice = null;
      ticksSinceLastTrade = PARAMS.cooldownTicks;
      totalTicks = 0;
    },
  };
}
