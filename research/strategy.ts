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
  longWindow: 25,            // Long EMA period

  // Bollinger Bands (Mean Reversion)
  bbWindow: 20,              // Rolling window for mean + stddev
  bbMultiplier: 3.0,         // Stddev multiplier for BB bands

  // RSI
  rsiWindow: 14,             // RSI period

  // Trade Management
  contractDuration: 4,       // Ticks per contract
  stakePercent: 0.17,        // Fraction of balance per trade
  cooldownTicks: 3,          // Min ticks between signal trades (lower to get more trades)
  minTicks: 15,              // Warmup period before first trade

  // Higher threshold = only very strong signals
  compositeThreshold: 0.6,   // Very strict: requires EMA + momentum alignment
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
  let lastCrossoverSignal = 0;      // 1 = bullish, -1 = bearish, 0 = none
  let ticksSinceCrossover = 999;    // ticks since last crossover
  let prevEMAGap: number | null = null;   // previous EMA gap for velocity calc

  // RSI state
  let avgGain: number | null = null;
  let avgLoss: number | null = null;

  function getMean(): number {
    const window = priceHistory.slice(-PARAMS.bbWindow);
    return window.reduce((s, p) => s + p, 0) / window.length;
  }

  function getStdDev(mean: number): number {
    const window = priceHistory.slice(-PARAMS.bbWindow);
    const variance = window.reduce((s, p) => s + (p - mean) ** 2, 0) / window.length;
    return Math.sqrt(variance);
  }

  function getRSI(): number {
    if (avgGain === null || avgLoss === null) return 50;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  return {
    name: "AutoResearch EMA 8/25 RSI+velocity 1tick-persist BB3.0 thresh0.6 cd3 s17 dur4",

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

      // Update RSI
      if (prevPrice !== null) {
        const change = price - prevPrice;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        avgGain = updateEMA(avgGain, gain, PARAMS.rsiWindow);
        avgLoss = updateEMA(avgLoss, loss, PARAMS.rsiWindow);
      }

      if (totalTicks < PARAMS.minTicks) return null;

      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      if (ticksSinceLastTrade < PARAMS.cooldownTicks) return null;

      // ---- Signals ----
      let trendSignal = 0;
      let reversionSignal = 0;
      let momentumSignal = 0;
      let velocitySignal = 0;   // EMA gap acceleration

      // 1. EMA Crossover + 1-tick persistence window (gated by RSI direction)
      ticksSinceCrossover++;
      if (prevShortEMA !== null && prevLongEMA !== null && shortEMA !== null && longEMA !== null) {
        const prevDiff = prevShortEMA - prevLongEMA;
        const currDiff = shortEMA - longEMA;
        if (prevDiff <= 0 && currDiff > 0) {
          lastCrossoverSignal = 1;
          ticksSinceCrossover = 0;
        } else if (prevDiff >= 0 && currDiff < 0) {
          lastCrossoverSignal = -1;
          ticksSinceCrossover = 0;
        }
      }
      // Allow crossover signal to persist for 1 tick; gate by RSI direction
      if (ticksSinceCrossover <= 1 && lastCrossoverSignal !== 0) {
        const rsi = getRSI();
        // RSI > 50 confirms bullish; RSI < 50 confirms bearish
        const rsiConfirms = (lastCrossoverSignal === 1 && rsi > 50) ||
                            (lastCrossoverSignal === -1 && rsi < 50);
        if (rsiConfirms) {
          trendSignal = lastCrossoverSignal;
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

      // 4. EMA Gap Velocity (is the trend accelerating?)
      if (shortEMA !== null && longEMA !== null) {
        const emaGap = shortEMA - longEMA;
        if (prevEMAGap !== null && emaGap !== prevEMAGap) {
          velocitySignal = emaGap > prevEMAGap ? 1.0 : -1.0;
        }
        prevEMAGap = emaGap;
      }

      // Blend: 0.4 trend + 0.2 reversion + 0.2 momentum + 0.2 velocity (threshold=0.6)
      const composite = trendSignal * 0.4 + reversionSignal * 0.2 + momentumSignal * 0.2 + velocitySignal * 0.2;

      if (Math.abs(composite) < PARAMS.compositeThreshold) return null;

      const direction: "UP" | "DOWN" = composite > 0 ? "UP" : "DOWN";
      // Fixed dollar sizing based on buy-in (not current balance) — reduces outcome variance
      const stakeAmt = Math.round(buyIn * PARAMS.stakePercent * 100) / 100;
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
      lastCrossoverSignal = 0;
      ticksSinceCrossover = 999;
      avgGain = null;
      avgLoss = null;
      prevEMAGap = null;
    },
  };
}
