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
  // EMA Crossover (Trend Following)
  shortWindow: 8,            // Short EMA period
  longWindow: 21,            // Long EMA period

  // Bollinger Bands for pullback detection
  bbWindow: 20,
  bbMultiplier: 2.0,         // 2.0 stddev

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
  let prevShortEMA: number | null = null;
  let prevLongEMA: number | null = null;
  let priceHistory: number[] = [];
  let lastPrice: number | null = null;
  let ticksSinceLastTrade = PARAMS.cooldownTicks;
  let totalTicks = 0;

  function getMean(): number {
    const window = priceHistory.slice(-PARAMS.bbWindow);
    return window.reduce((s, p) => s + p, 0) / window.length;
  }

  function getStdDev(mean: number): number {
    const window = priceHistory.slice(-PARAMS.bbWindow);
    const variance = window.reduce((s, p) => s + (p - mean) ** 2, 0) / window.length;
    return Math.sqrt(variance);
  }

  return {
    name: "AutoResearch dual-path EMA-xover+mom OR BB-reversion-in-trend cd3 s14 dur4",

    onTick(tick: Tick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      totalTicks++;
      ticksSinceLastTrade++;

      priceHistory.push(price);
      if (priceHistory.length > PARAMS.bbWindow * 2) {
        priceHistory = priceHistory.slice(-PARAMS.bbWindow * 2);
      }

      prevShortEMA = shortEMA;
      prevLongEMA = longEMA;
      shortEMA = updateEMA(shortEMA, price, PARAMS.shortWindow);
      longEMA = updateEMA(longEMA, price, PARAMS.longWindow);

      const prevPrice = lastPrice;
      lastPrice = price;

      if (totalTicks < PARAMS.minTicks) return null;

      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      if (ticksSinceLastTrade < PARAMS.cooldownTicks) return null;

      if (shortEMA === null || longEMA === null || prevShortEMA === null || prevLongEMA === null) return null;

      // Micro-momentum (always computed)
      const momentumUp = prevPrice !== null && price > prevPrice;
      const momentumDown = prevPrice !== null && price < prevPrice;

      // ---- Path A: EMA Crossover + Momentum ----
      const prevDiff = prevShortEMA - prevLongEMA;
      const currDiff = shortEMA - longEMA;
      const emaCrossUp = prevDiff <= 0 && currDiff > 0 && momentumUp;
      const emaCrossDown = prevDiff >= 0 && currDiff < 0 && momentumDown;

      // ---- Path B: BB Pullback in EMA Trend Direction + Momentum ----
      const emaUptrend = shortEMA > longEMA;
      const emaDowntrend = shortEMA < longEMA;
      let bbPullbackUp = false;
      let bbPullbackDown = false;

      if (priceHistory.length >= PARAMS.bbWindow) {
        const mean = getMean();
        const stdDev = getStdDev(mean);
        if (stdDev > 0) {
          const upper = mean + PARAMS.bbMultiplier * stdDev;
          const lower = mean - PARAMS.bbMultiplier * stdDev;
          // Reversion: price at lower BB in uptrend → expect bounce back up (no momentum needed)
          bbPullbackUp = price < lower && emaUptrend;
          // Reversion: price at upper BB in downtrend → expect fall back down
          bbPullbackDown = price > upper && emaDowntrend;
        }
      }

      // ---- Fire if either path triggers ----
      let direction: "UP" | "DOWN" | null = null;
      if (emaCrossUp || bbPullbackUp) direction = "UP";
      else if (emaCrossDown || bbPullbackDown) direction = "DOWN";

      if (direction === null) return null;

      const stakeAmt = Math.round(balance * PARAMS.stakePercent * 100) / 100;
      if (stakeAmt < minStake) return null;

      ticksSinceLastTrade = 0;
      return { direction, stake: stakeAmt, duration: PARAMS.contractDuration };
    },

    reset() {
      shortEMA = null;
      longEMA = null;
      prevShortEMA = null;
      prevLongEMA = null;
      priceHistory = [];
      lastPrice = null;
      ticksSinceLastTrade = PARAMS.cooldownTicks;
      totalTicks = 0;
    },
  };
}
