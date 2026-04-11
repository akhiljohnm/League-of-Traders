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
  // EMA Crossover (Trend Following) — synced from research/strategy.ts v12
  shortWindow: 8,
  longWindow: 18,

  // Bollinger Bands (Mean Reversion)
  bbWindow: 20,
  bbMultiplier: 1.90,

  // Signal Weights (how to blend indicators)
  trendWeight: 0.5,
  reversionWeight: 0.3,
  momentumWeight: 0.2,

  // Regime Detection
  flatMarketThreshold: 0.00025,

  // ---- Game Phase Detection (from research/strategy.ts v12) ----
  minTicks: 8,              // Warmup ticks before any trade
  midGameFreezeTick: 134,   // Capital-conservation phase begins
  lateGameTick: 212,        // All-in phase begins
  lateGameVolThreshold: 0.0002, // Max relVol for late-game trigger
  suggestedDuration: 4,     // Optimized contract duration (ticks)

  // ---- Adaptive Threshold Params ----
  baseThreshold: 0.25,      // Default signal threshold
  winningThreshold: 0.20,   // Relaxed when on a winning streak
  highVolThreshold1: 0.35,  // relVol > 0.0003 → stricter
  highVolThreshold2: 0.50,  // relVol > 0.0006 → strictest
  lateGameThreshold: 0.70,  // Late game requires trend+momentum alignment
  winningStreakPct: 0.05,    // Recent balance growth to consider "winning"

  // ---- Stake Sizing ----
  stakePercent: 0.625,      // Normal stake fraction (from research)
  lateGameStakePct: 1.0,    // All-in during late game
  bankruptcyBrakeAt: 0.50,  // Below this fraction of buyIn, apply brake
  bankruptcyBrakeFactor: 0.10, // Multiply stake by this when near bankruptcy
  hardStopAt: 0.10,         // Below this fraction of buyIn, no trades at all
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
  /** Relative volatility: stdDev / mean (0 during warmup) */
  relVol: number;
  /** Whether we're in warmup period (not enough ticks yet) */
  warming: boolean;

  // ---- Advanced game-phase signals (from research/strategy.ts v12) ----
  /** Vol + performance adjusted threshold. Trade only if |composite| >= this. */
  adaptiveThreshold: number;
  /** Tick 212+ with low vol: switch to all-in staking, use lateGameThreshold. */
  isLateGame: boolean;
  /**
   * Ticks 134–211: capital-conservation phase. Stake should be 0 (or heavily
   * reduced) so balance is preserved for the late-game all-in.
   */
  isMidGameFreeze: boolean;
  /** Research-optimized contract duration: 4 ticks. */
  suggestedDuration: number;
  /** Recommended stake fraction of balance for this tick. */
  suggestedStakePct: number;
}

export interface BrainInstance {
  /**
   * Feed a tick plus current balance context, get back the full signal state.
   * balance and buyIn are needed for adaptive threshold + phase-aware staking.
   */
  process(tick: DerivTick, balance: number, buyIn: number): BrainSignal;
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
  let balanceHistory: number[] = [];

  function getMean(): number {
    const window = priceHistory.slice(-BRAIN_PARAMS.bbWindow);
    return window.reduce((s, p) => s + p, 0) / window.length;
  }

  function getStdDev(mean: number): number {
    const window = priceHistory.slice(-BRAIN_PARAMS.bbWindow);
    const variance = window.reduce((s, p) => s + (p - mean) ** 2, 0) / window.length;
    return Math.sqrt(variance);
  }

  const P = BRAIN_PARAMS;

  return {
    process(tick: DerivTick, balance: number, buyIn: number): BrainSignal {
      const price = tick.quote;
      totalTicks++;

      // Update price history
      priceHistory.push(price);
      if (priceHistory.length > P.bbWindow * 2) {
        priceHistory = priceHistory.slice(-P.bbWindow * 2);
      }

      // Track recent balance for adaptive threshold (last 15 ticks)
      balanceHistory.push(balance);
      if (balanceHistory.length > 15) balanceHistory.shift();

      // Update EMAs
      prevShortEMA = shortEMA;
      prevLongEMA = longEMA;
      shortEMA = updateEMA(shortEMA, price, P.shortWindow);
      longEMA = updateEMA(longEMA, price, P.longWindow);

      const prevPrice = lastPrice;
      lastPrice = price;

      // Warmup: use research-derived minTicks (8), not bbWindow
      const warmupTicks = Math.max(P.minTicks, P.bbWindow);
      if (totalTicks < warmupTicks) {
        return {
          composite: 0, trend: 0, reversion: 0, momentum: 0, relVol: 0, warming: true,
          adaptiveThreshold: P.baseThreshold, isLateGame: false, isMidGameFreeze: false,
          suggestedDuration: P.suggestedDuration, suggestedStakePct: P.stakePercent,
        };
      }

      // ---- Compute individual signals ----

      let trend = 0;
      let reversion = 0;
      let momentum = 0;
      let relVol = 0;

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
      if (priceHistory.length >= P.bbWindow) {
        const mean = getMean();
        const stdDev = getStdDev(mean);
        relVol = stdDev / mean;

        if (stdDev > mean * P.flatMarketThreshold) {
          const upperBand = mean + P.bbMultiplier * stdDev;
          const lowerBand = mean - P.bbMultiplier * stdDev;

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
        trend * P.trendWeight +
        reversion * P.reversionWeight +
        momentum * P.momentumWeight;

      // ---- Game Phase Detection ----
      const isLateGame = totalTicks >= P.lateGameTick && relVol < P.lateGameVolThreshold;
      const isMidGameFreeze = !isLateGame && totalTicks >= P.midGameFreezeTick;

      // ---- Adaptive Signal Threshold (research/strategy.ts v12) ----
      let adaptiveThreshold = P.baseThreshold;

      // Winning streak → relax threshold slightly
      if (balanceHistory.length >= 15) {
        const recentTrend = (balance - balanceHistory[0]) / balanceHistory[0];
        if (recentTrend > P.winningStreakPct) adaptiveThreshold = P.winningThreshold;
      }

      // High-vol regime → require stronger signal to avoid noise trades
      if (relVol > 0.0006) {
        adaptiveThreshold = Math.max(adaptiveThreshold, P.highVolThreshold2);
      } else if (relVol > 0.0003) {
        adaptiveThreshold = Math.max(adaptiveThreshold, P.highVolThreshold1);
      }

      // Late game: trend+momentum must be aligned (strong conviction only)
      if (isLateGame) adaptiveThreshold = P.lateGameThreshold;

      // ---- Suggested Stake Percentage ----
      let suggestedStakePct: number;
      if (isLateGame) {
        suggestedStakePct = P.lateGameStakePct;
      } else if (isMidGameFreeze) {
        suggestedStakePct = 0; // Capital conservation — don't stake
      } else if (balance < buyIn * P.bankruptcyBrakeAt) {
        suggestedStakePct = P.stakePercent * P.bankruptcyBrakeFactor;
      } else {
        suggestedStakePct = P.stakePercent;
      }

      return {
        composite, trend, reversion, momentum, relVol, warming: false,
        adaptiveThreshold, isLateGame, isMidGameFreeze,
        suggestedDuration: P.suggestedDuration, suggestedStakePct,
      };
    },

    reset() {
      shortEMA = null;
      longEMA = null;
      prevShortEMA = null;
      prevLongEMA = null;
      priceHistory = [];
      lastPrice = null;
      totalTicks = 0;
      balanceHistory = [];
    },
  };
}
