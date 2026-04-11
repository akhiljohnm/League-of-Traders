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
  // EMA (Trend)
  shortWindow: 8,            // Short EMA period
  longWindow: 21,            // Long EMA period

  // Price-to-EMA momentum threshold
  // Signal fires when price deviates from shortEMA by this fraction AND trend aligned
  priceEmaThresh: 0.0003,    // 0.03% deviation from shortEMA triggers entry

  // Bollinger Bands (Mean Reversion — effectively disabled at 3.0)
  bbWindow: 20,
  bbMultiplier: 3.0,

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
    name: "AutoResearch EMA 8/21 priceEmaThresh0.0003 cd3 s14 dur4",

    onTick(tick: Tick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      totalTicks++;
      ticksSinceLastTrade++;

      priceHistory.push(price);
      if (priceHistory.length > PARAMS.bbWindow * 2) {
        priceHistory = priceHistory.slice(-PARAMS.bbWindow * 2);
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

      // ---- Signals ----

      // 1. Trend: short EMA above/below long EMA (continuous, not crossover-based)
      const emaTrendRatio = (shortEMA - longEMA) / longEMA;  // positive = uptrend
      let trendSignal = 0;
      if (emaTrendRatio > 0.0001) trendSignal = 1.0;
      else if (emaTrendRatio < -0.0001) trendSignal = -1.0;

      // 2. Price-to-EMA deviation: price above/below short EMA by priceEmaThresh
      const priceDeviation = (price - shortEMA) / shortEMA;
      let deviationSignal = 0;
      if (priceDeviation > PARAMS.priceEmaThresh) deviationSignal = 1.0;
      else if (priceDeviation < -PARAMS.priceEmaThresh) deviationSignal = -1.0;

      // 3. Bollinger Bands (disabled at 3.0)
      let reversionSignal = 0;
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

      // 4. Micro-Momentum
      let momentumSignal = 0;
      if (prevPrice !== null && price !== prevPrice) {
        momentumSignal = price > prevPrice ? 1.0 : -1.0;
      }

      // Require trend and price-deviation to agree (both positive or both negative)
      // This fires when: price is in uptrend AND price is above short EMA (continuation)
      if (trendSignal === 0 || deviationSignal === 0 || trendSignal !== deviationSignal) return null;

      // Use momentum as a secondary confirmation
      const composite = trendSignal * 0.7 + momentumSignal * 0.3 + reversionSignal * 0.0;

      if (Math.abs(composite) < 0.4) return null;

      const direction: "UP" | "DOWN" = composite > 0 ? "UP" : "DOWN";
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
