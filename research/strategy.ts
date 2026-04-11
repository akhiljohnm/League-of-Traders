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
  // Regime Detection
  volWindow: 10,              // Ticks for rolling volatility measurement
  volThreshold: 0.05,         // Price change std-dev split: above = high-vol, below = low-vol

  // Low-vol regime (cleaner trends, react faster)
  lowVolShortWindow: 8,       // Short EMA period in low-vol
  lowVolLongWindow: 17,       // Long EMA period in low-vol
  lowVolThreshold: 0.6,       // Composite threshold in low-vol

  // High-vol regime (noisy, use wider/slower EMAs)
  highVolShortWindow: 10,     // Short EMA period in high-vol
  highVolLongWindow: 25,      // Long EMA period in high-vol
  highVolThreshold: 0.7,      // Composite threshold in high-vol (stricter)

  // Bollinger Bands (Mean Reversion — effectively disabled at 3.0)
  bbWindow: 20,              // Rolling window for mean + stddev
  bbMultiplier: 3.0,         // Stddev multiplier for BB bands

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
  // Dual EMA state (we maintain all 4 EMAs and pick based on regime)
  let lowShortEMA: number | null = null;
  let lowLongEMA: number | null = null;
  let prevLowShortEMA: number | null = null;
  let prevLowLongEMA: number | null = null;

  let highShortEMA: number | null = null;
  let highLongEMA: number | null = null;
  let prevHighShortEMA: number | null = null;
  let prevHighLongEMA: number | null = null;

  let priceHistory: number[] = [];
  let priceChanges: number[] = [];
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

  function getVolatility(): number {
    const changes = priceChanges.slice(-PARAMS.volWindow);
    if (changes.length < 3) return 0;
    const mean = changes.reduce((s, c) => s + c, 0) / changes.length;
    const variance = changes.reduce((s, c) => s + (c - mean) ** 2, 0) / changes.length;
    return Math.sqrt(variance);
  }

  return {
    name: "AutoResearch RegimeAdaptive EMA(8/17 low, 10/25 high) s14 dur4",

    onTick(tick: Tick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      totalTicks++;
      ticksSinceLastTrade++;

      priceHistory.push(price);
      if (priceHistory.length > PARAMS.bbWindow * 2) {
        priceHistory = priceHistory.slice(-PARAMS.bbWindow * 2);
      }

      if (lastPrice !== null) {
        const absChange = Math.abs(price - lastPrice) / lastPrice;
        priceChanges.push(absChange);
        if (priceChanges.length > PARAMS.volWindow * 3) {
          priceChanges = priceChanges.slice(-PARAMS.volWindow * 3);
        }
      }

      // Update all 4 EMAs continuously
      prevLowShortEMA = lowShortEMA;
      prevLowLongEMA = lowLongEMA;
      prevHighShortEMA = highShortEMA;
      prevHighLongEMA = highLongEMA;

      lowShortEMA = updateEMA(lowShortEMA, price, PARAMS.lowVolShortWindow);
      lowLongEMA = updateEMA(lowLongEMA, price, PARAMS.lowVolLongWindow);
      highShortEMA = updateEMA(highShortEMA, price, PARAMS.highVolShortWindow);
      highLongEMA = updateEMA(highLongEMA, price, PARAMS.highVolLongWindow);

      const prevPrice = lastPrice;
      lastPrice = price;

      if (totalTicks < PARAMS.minTicks) return null;

      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      if (ticksSinceLastTrade < PARAMS.cooldownTicks) return null;

      // ---- Regime Detection ----
      const vol = getVolatility();
      const isHighVol = vol > PARAMS.volThreshold;

      const shortEMA = isHighVol ? highShortEMA : lowShortEMA;
      const longEMA = isHighVol ? highLongEMA : lowLongEMA;
      const prevShortEMA = isHighVol ? prevHighShortEMA : prevLowShortEMA;
      const prevLongEMA = isHighVol ? prevHighLongEMA : prevLowLongEMA;
      const compositeThreshold = isHighVol ? PARAMS.highVolThreshold : PARAMS.lowVolThreshold;

      // ---- Signals ----
      let trendSignal = 0;
      let reversionSignal = 0;
      let momentumSignal = 0;

      // 1. EMA Crossover
      if (prevShortEMA !== null && prevLongEMA !== null && shortEMA !== null && longEMA !== null) {
        const prevDiff = prevShortEMA - prevLongEMA;
        const currDiff = shortEMA - longEMA;
        if (prevDiff <= 0 && currDiff > 0) trendSignal = 1.0;
        else if (prevDiff >= 0 && currDiff < 0) trendSignal = -1.0;
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

      if (Math.abs(composite) < compositeThreshold) return null;

      const direction: "UP" | "DOWN" = composite > 0 ? "UP" : "DOWN";
      const stakeAmt = Math.round(balance * PARAMS.stakePercent * 100) / 100;
      if (stakeAmt < minStake) return null;

      ticksSinceLastTrade = 0;
      return { direction, stake: stakeAmt, duration: PARAMS.contractDuration };
    },

    reset() {
      lowShortEMA = null;
      lowLongEMA = null;
      prevLowShortEMA = null;
      prevLowLongEMA = null;
      highShortEMA = null;
      highLongEMA = null;
      prevHighShortEMA = null;
      prevHighLongEMA = null;
      priceHistory = [];
      priceChanges = [];
      lastPrice = null;
      ticksSinceLastTrade = PARAMS.cooldownTicks;
      totalTicks = 0;
    },
  };
}
