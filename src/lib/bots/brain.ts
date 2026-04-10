// ============================================================
// AutoResearch Brain — Shared Signal Engine
// ============================================================
// This is the core "brain" optimized by the autoresearch loop.
// The PARAMS below are synced from research/strategy.ts after
// each optimization run. All three bot personalities (Trend
// Follower, Mean Reverter, High-Freq Gambler) consume the same
// signal output — they differ only in how they ACT on it.
//
// The brain computes a composite signal from -1 (strong DOWN)
// to +1 (strong UP) by blending three indicators:
//   1. EMA Crossover (trend following)
//   2. Bollinger Bands (mean reversion)
//   3. Micro-Momentum (short-term direction)
// ============================================================

import type { DerivTick } from "@/lib/types/deriv";

// ============================================================
// OPTIMIZED PARAMS — Synced from research/strategy.ts
// These values are the output of the autoresearch optimizer.
// After an optimization run, copy the PARAMS block here.
// ============================================================

export const BRAIN_PARAMS = {
  // EMA Crossover (Trend Following)
  shortWindow: 5,
  longWindow: 15,

  // Bollinger Bands (Mean Reversion)
  bbWindow: 20,
  bbMultiplier: 2.0,

  // Signal Weights (how to blend indicators)
  trendWeight: 0.5,
  reversionWeight: 0.3,
  momentumWeight: 0.2,

  // Regime Detection
  flatMarketThreshold: 0.0001,
};

// ============================================================
// Signal Output — What the brain returns each tick
// ============================================================

export interface BrainSignal {
  /** Composite blended signal: -1 (strong DOWN) to +1 (strong UP) */
  composite: number;
  /** EMA crossover signal: -1, 0, or +1 */
  trend: number;
  /** Bollinger Band signal: -1, 0, or +1 */
  reversion: number;
  /** Micro-momentum signal: -1, 0, or +1 */
  momentum: number;
  /** Whether we're in warmup period (not enough ticks yet) */
  warming: boolean;
}

export interface BrainInstance {
  /** Feed a tick, get back the signal state */
  process(tick: DerivTick): BrainSignal;
  /** Reset all internal state */
  reset(): void;
}

// ============================================================
// Brain Factory
// ============================================================

function updateEMA(current: number | null, price: number, period: number): number {
  if (current === null) return price;
  const k = 2 / (period + 1);
  return price * k + current * (1 - k);
}

export function createBrain(): BrainInstance {
  let shortEMA: number | null = null;
  let longEMA: number | null = null;
  let prevShortEMA: number | null = null;
  let prevLongEMA: number | null = null;
  let priceHistory: number[] = [];
  let lastPrice: number | null = null;
  let totalTicks = 0;

  function getMean(): number {
    const window = priceHistory.slice(-BRAIN_PARAMS.bbWindow);
    return window.reduce((s, p) => s + p, 0) / window.length;
  }

  function getStdDev(mean: number): number {
    const window = priceHistory.slice(-BRAIN_PARAMS.bbWindow);
    const variance = window.reduce((s, p) => s + (p - mean) ** 2, 0) / window.length;
    return Math.sqrt(variance);
  }

  return {
    process(tick: DerivTick): BrainSignal {
      const price = tick.quote;
      totalTicks++;

      // Update price history
      priceHistory.push(price);
      if (priceHistory.length > BRAIN_PARAMS.bbWindow * 2) {
        priceHistory = priceHistory.slice(-BRAIN_PARAMS.bbWindow * 2);
      }

      // Update EMAs
      prevShortEMA = shortEMA;
      prevLongEMA = longEMA;
      shortEMA = updateEMA(shortEMA, price, BRAIN_PARAMS.shortWindow);
      longEMA = updateEMA(longEMA, price, BRAIN_PARAMS.longWindow);

      const prevPrice = lastPrice;
      lastPrice = price;

      // Warmup: need enough ticks for all indicators
      if (totalTicks < BRAIN_PARAMS.bbWindow) {
        return { composite: 0, trend: 0, reversion: 0, momentum: 0, warming: true };
      }

      // ---- Compute individual signals ----

      let trend = 0;
      let reversion = 0;
      let momentum = 0;

      // 1. EMA Crossover (Trend)
      if (prevShortEMA !== null && prevLongEMA !== null && shortEMA !== null && longEMA !== null) {
        const prevDiff = prevShortEMA - prevLongEMA;
        const currDiff = shortEMA - longEMA;

        if (prevDiff <= 0 && currDiff > 0) {
          trend = 1.0; // Bullish crossover
        } else if (prevDiff >= 0 && currDiff < 0) {
          trend = -1.0; // Bearish crossover
        }
      }

      // 2. Bollinger Bands (Mean Reversion)
      if (priceHistory.length >= BRAIN_PARAMS.bbWindow) {
        const mean = getMean();
        const stdDev = getStdDev(mean);

        if (stdDev > mean * BRAIN_PARAMS.flatMarketThreshold) {
          const upperBand = mean + BRAIN_PARAMS.bbMultiplier * stdDev;
          const lowerBand = mean - BRAIN_PARAMS.bbMultiplier * stdDev;

          if (price > upperBand) {
            reversion = -1.0; // Overbought -> expect DOWN
          } else if (price < lowerBand) {
            reversion = 1.0; // Oversold -> expect UP
          }
        }
      }

      // 3. Micro-Momentum
      if (prevPrice !== null && price !== prevPrice) {
        momentum = price > prevPrice ? 1.0 : -1.0;
      }

      // ---- Blend ----
      const composite =
        trend * BRAIN_PARAMS.trendWeight +
        reversion * BRAIN_PARAMS.reversionWeight +
        momentum * BRAIN_PARAMS.momentumWeight;

      return { composite, trend, reversion, momentum, warming: false };
    },

    reset() {
      shortEMA = null;
      longEMA = null;
      prevShortEMA = null;
      prevLongEMA = null;
      priceHistory = [];
      lastPrice = null;
      totalTicks = 0;
    },
  };
}
