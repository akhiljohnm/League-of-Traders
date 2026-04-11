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

  // Bollinger Bands (Mean Reversion — disabled at 3.0)
  bbWindow: 20,
  bbMultiplier: 3.0,

  // Trade Management
  contractDuration: 4,       // Ticks per contract
  stakePercent: 0.14,        // Fraction of balance per trade
  cooldownTicks: 3,          // Min ticks between signal trades
  minTicks: 15,              // Warmup period before first trade

  // Crossover recency filter: don't trade if the SAME crossover just happened <4 ticks ago
  // This filters whipsaw re-crossovers while keeping cooldown=3 for trade spacing
  minTicksSinceCrossover: 4, // Must wait this long after any crossover to trade

  // Higher threshold = only very strong signals
  compositeThreshold: 0.6,   // Requires EMA + momentum alignment
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
  let ticksSinceAnyCrossover = PARAMS.minTicksSinceCrossover; // starts ready
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
    name: "AutoResearch EMA 8/21 BB3.0 thresh0.6 xoRecency4 cd3 s14 dur4",

    onTick(tick: Tick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      totalTicks++;
      ticksSinceLastTrade++;
      ticksSinceAnyCrossover++;

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

      // ---- Signals ----
      let trendSignal = 0;
      let reversionSignal = 0;
      let momentumSignal = 0;

      // 1. EMA Crossover — only fire if previous crossover was >= minTicksSinceCrossover ago
      if (prevShortEMA !== null && prevLongEMA !== null && shortEMA !== null && longEMA !== null) {
        const prevDiff = prevShortEMA - prevLongEMA;
        const currDiff = shortEMA - longEMA;
        const isCrossover = (prevDiff <= 0 && currDiff > 0) || (prevDiff >= 0 && currDiff < 0);
        if (isCrossover) {
          // Only trade this crossover if the PREVIOUS one was far enough ago
          if (ticksSinceAnyCrossover >= PARAMS.minTicksSinceCrossover) {
            if (prevDiff <= 0 && currDiff > 0) trendSignal = 1.0;
            else trendSignal = -1.0;
          }
          // Always reset the crossover timer, regardless of whether we trade
          ticksSinceAnyCrossover = 0;
        }
      }

      // 2. Bollinger Bands
      if (priceHistory.length >= PARAMS.bbWindow) {
        const mean = getMean();
        const stdDev = getStdDev(mean);
        if (stdDev > 0) {
          const upper = mean + PARAMS.bbMultiplier * stdDev;
          const lower = mean - PARAMS.bbMultiplier * stdDev;
          if (price > upper) reversionSignal = -1.0;
          else if (price < lower) reversionSignal = 1.0;
        }
      }

      // 3. Micro-Momentum
      if (prevPrice !== null && price !== prevPrice) {
        momentumSignal = price > prevPrice ? 1.0 : -1.0;
      }

      // Blend: 0.5 trend + 0.3 reversion + 0.2 momentum
      const composite = trendSignal * 0.5 + reversionSignal * 0.3 + momentumSignal * 0.2;

      if (Math.abs(composite) < PARAMS.compositeThreshold) return null;

      const direction: "UP" | "DOWN" = composite > 0 ? "UP" : "DOWN";
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
      ticksSinceAnyCrossover = PARAMS.minTicksSinceCrossover;
      totalTicks = 0;
    },
  };
}
