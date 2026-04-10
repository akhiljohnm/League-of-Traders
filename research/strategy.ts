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
  shortWindow: 5,           // Short EMA period
  longWindow: 15,           // Long EMA period

  // Bollinger Bands (Mean Reversion)
  bbWindow: 20,             // Rolling window for mean + stddev
  bbMultiplier: 2.0,        // Stddev multiplier for band width

  // Momentum
  momentumBias: 0.65,       // Probability of following micro-momentum

  // Trade Management
  stakePercent: 0.06,       // Fraction of balance per trade
  maxStakePercent: 0.25,    // Hard cap on stake as fraction of balance
  cooldownTicks: 6,         // Min ticks between signal trades
  minTicks: 15,             // Warmup period before first trade

  // Game-Aware Sizing
  rescueMultiplier: 1.5,    // Stake multiplier when losing (balance < buyIn)
  alphaMultiplier: 0.8,     // Stake multiplier when winning
  lateGameMultiplier: 0.56, // Stake multiplier in last 60 ticks when winning

  // Signal Weights (how to blend indicators)
  trendWeight: 0.5,         // Weight for EMA crossover signal
  reversionWeight: 0.3,     // Weight for Bollinger Band signal
  momentumWeight: 0.2,      // Weight for micro-momentum signal

  // Regime Detection
  flatMarketThreshold: 0.0001, // Below this relative stddev, skip trading
};

// Game constants (match the actual game)
const GAME_TOTAL_TICKS = 300;
const MIN_TRADES_QUOTA = 5;

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
  let tradesPlaced = 0;

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

  // ---- Stake sizing ----
  function computeStake(balance: number, buyIn: number): number {
    const ticksRemaining = GAME_TOTAL_TICKS - totalTicks;
    const isRescue = balance < buyIn;
    const isAlpha = balance > buyIn;
    const isLateGame = ticksRemaining < 60;

    let multiplier = 1.0;
    if (isRescue) {
      multiplier = PARAMS.rescueMultiplier;
    } else if (isAlpha) {
      multiplier = isLateGame ? PARAMS.lateGameMultiplier : PARAMS.alphaMultiplier;
    }

    return Math.min(
      Math.round(balance * PARAMS.stakePercent * multiplier * 100) / 100,
      balance * PARAMS.maxStakePercent
    );
  }

  return {
    name: "AutoResearch Hybrid v1",

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

      // Warmup
      if (totalTicks < PARAMS.minTicks) return null;

      // Minimum stake check
      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      // ---- QUOTA URGENCY ----
      const ticksRemaining = GAME_TOTAL_TICKS - totalTicks;
      const tradesNeeded = MIN_TRADES_QUOTA - tradesPlaced;

      if (tradesNeeded > 0 && ticksRemaining <= tradesNeeded * 12) {
        const direction: "UP" | "DOWN" =
          shortEMA !== null && longEMA !== null
            ? shortEMA >= longEMA ? "UP" : "DOWN"
            : Math.random() < 0.5 ? "UP" : "DOWN";

        const stake = computeStake(balance, buyIn);
        if (stake < minStake) return null;

        ticksSinceLastTrade = 0;
        tradesPlaced++;
        return { direction, stake };
      }

      // ---- Cooldown check (for signal trades) ----
      if (ticksSinceLastTrade < PARAMS.cooldownTicks) return null;

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
      if (priceHistory.length >= PARAMS.bbWindow) {
        const mean = getMean();
        const stdDev = getStdDev(mean);

        if (stdDev > mean * PARAMS.flatMarketThreshold) {
          const upperBand = mean + PARAMS.bbMultiplier * stdDev;
          const lowerBand = mean - PARAMS.bbMultiplier * stdDev;

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
      if (Math.abs(composite) < 0.3) return null;

      const direction: "UP" | "DOWN" = composite > 0 ? "UP" : "DOWN";
      const stake = computeStake(balance, buyIn);
      if (stake < minStake) return null;

      ticksSinceLastTrade = 0;
      tradesPlaced++;
      return { direction, stake };
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
      tradesPlaced = 0;
    },
  };
}
