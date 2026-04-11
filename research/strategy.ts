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
  shortWindow: 8,           // Short EMA period
  longWindow: 21,           // Long EMA period

  // Bollinger Bands (Mean Reversion)
  bbWindow: 20,             // Rolling window for mean + stddev
  bbMultiplier: 1.80,       // Stddev multiplier for low-vol markets
  bbMultiplierHigh: 1.86,   // Stddev multiplier for high-vol markets
  bbVolThreshold: 0.0004,   // RelVol above this = use high multiplier

  // Trade Management
  contractDuration: 4,      // Ticks per contract. Allowed: 1,2,3,4,5,6,8,10
  stakePercent: 0.45,       // Fraction of balance per trade
  lateGameMultiplier: 2.25, // Stake boost in final 60 ticks when winning
  lateGameTick: 234,        // Tick threshold for late-game boost
  cooldownTicks: 5,         // Min ticks between signal trades
  minTicks: 8,              // Warmup period before first trade

  // Signal Weights (how to blend indicators)
  trendWeight: 0.5,         // Weight for EMA crossover signal
  reversionWeight: 0.3,     // Weight for Bollinger Band signal
  momentumWeight: 0.2,      // Weight for micro-momentum signal

  // Regime Detection
  flatMarketThreshold: 0.00030, // Below this relative stddev, skip trading
  lateGameThreshold: 0.70,  // Higher quality filter for all-in late game trades
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
  // ---- Internal state ----
  let shortEMA: number | null = null;
  let longEMA: number | null = null;
  let prevShortEMA: number | null = null;
  let prevLongEMA: number | null = null;
  let priceHistory: number[] = [];
  let lastPrice: number | null = null;
  let ticksSinceLastTrade = PARAMS.cooldownTicks;
  let totalTicks = 0;
  let balanceHistory: number[] = [];  // last 15 ticks for adaptive threshold

  // ---- Bollinger Band helpers ----
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
    name: "AutoResearch Hybrid v12",

    onTick(tick: Tick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      totalTicks++;
      ticksSinceLastTrade++;

      // Update price history
      priceHistory.push(price);
      if (priceHistory.length > PARAMS.bbWindow * 2) {
        priceHistory = priceHistory.slice(-PARAMS.bbWindow * 2);
      }

      // Update EMAs
      prevShortEMA = shortEMA;
      prevLongEMA = longEMA;
      shortEMA = updateEMA(shortEMA, price, PARAMS.shortWindow);
      longEMA = updateEMA(longEMA, price, PARAMS.longWindow);

      const prevPrice = lastPrice;
      lastPrice = price;

      // Track balance for adaptive threshold
      balanceHistory.push(balance);
      if (balanceHistory.length > 15) balanceHistory.shift();

      // Warmup
      if (totalTicks < PARAMS.minTicks) return null;

      // Minimum stake check
      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      // ---- Cooldown check (adaptive: longer in losing regime) ----
      const activeCooldown = (balanceHistory.length >= 15 && (balance - balanceHistory[0]) / balanceHistory[0] < -0.03)
        ? PARAMS.cooldownTicks + 3
        : PARAMS.cooldownTicks;
      if (ticksSinceLastTrade < activeCooldown) return null;

      // ---- Compute signals ----
      let trendSignal = 0;  // -1 to +1
      let reversionSignal = 0;  // -1 to +1
      let momentumSignal = 0;  // -1 to +1

      // 1. EMA Crossover (Trend)
      if (prevShortEMA !== null && prevLongEMA !== null && shortEMA !== null && longEMA !== null) {
        const prevDiff = prevShortEMA - prevLongEMA;
        const currDiff = shortEMA - longEMA;

        if (prevDiff <= 0 && currDiff > 0) {
          trendSignal = 1.0; // Bullish crossover
        } else if (prevDiff >= 0 && currDiff < 0) {
          trendSignal = -1.0; // Bearish crossover
        }
      }

      // 2. Bollinger Bands (Mean Reversion)
      let relVol = 0;
      if (priceHistory.length >= PARAMS.bbWindow) {
        const mean = getMean();
        const stdDev = getStdDev(mean);
        relVol = stdDev / mean;

        if (stdDev > mean * PARAMS.flatMarketThreshold) {
          const mult = relVol > PARAMS.bbVolThreshold ? PARAMS.bbMultiplierHigh : PARAMS.bbMultiplier;
          const upperBand = mean + mult * stdDev;
          const lowerBand = mean - mult * stdDev;

          if (price > upperBand) {
            reversionSignal = -1.0; // Overbought → expect DOWN
          } else if (price < lowerBand) {
            reversionSignal = 1.0; // Oversold → expect UP
          }
        }
      }

      // 3. Micro-Momentum
      if (prevPrice !== null && price !== prevPrice) {
        momentumSignal = price > prevPrice ? 1.0 : -1.0;
      }

      // ---- Blend signals ----
      const composite =
        trendSignal * PARAMS.trendWeight +
        reversionSignal * PARAMS.reversionWeight +
        momentumSignal * PARAMS.momentumWeight;

      // Only trade if composite signal is strong enough
      const isLateGame = totalTicks >= PARAMS.lateGameTick && balance > buyIn;
      // Adaptive threshold: lower when winning
      let regularThreshold = 0.25;
      if (balanceHistory.length >= 15) {
        const recentTrend = (balance - balanceHistory[0]) / balanceHistory[0];
        if (recentTrend > 0.05) regularThreshold = 0.20;       // winning regime → more trades
      }
      const signalThreshold = isLateGame ? PARAMS.lateGameThreshold : regularThreshold;
      if (Math.abs(composite) < signalThreshold) return null;

      const direction: "UP" | "DOWN" = composite > 0 ? "UP" : "DOWN";
      // Soft floor: emergency brake at <34% balance to prevent total bankruptcy
      const bankruptcyFactor = balance < buyIn * 0.34 ? 0.10 : 1.0;
      // High-vol markets (1HZ100V) get 75% stake to reduce noise losses
      const highVolFactor = relVol > PARAMS.bbVolThreshold ? 0.75 : 1.0;
      const stakeAmt = Math.round(
        balance * (isLateGame ? PARAMS.stakePercent * PARAMS.lateGameMultiplier : PARAMS.stakePercent * bankruptcyFactor * highVolFactor) * 100
      ) / 100;
      if (stakeAmt < minStake) return null;

      // Use shorter duration in high-vol markets (mean reversion resolves faster)
      const tradeDuration = relVol > PARAMS.bbVolThreshold ? 3 : PARAMS.contractDuration;
      ticksSinceLastTrade = 0;
      return { direction, stake: stakeAmt, duration: tradeDuration };
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
      balanceHistory = [];
    },
  };
}
