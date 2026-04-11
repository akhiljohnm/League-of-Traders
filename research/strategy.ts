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
  // EMA Crossover — two timeframes must agree
  fastShortWindow: 5,        // Fast EMA pair: short period
  fastLongWindow: 13,        // Fast EMA pair: long period
  slowShortWindow: 8,        // Slow EMA pair: short period
  slowLongWindow: 21,        // Slow EMA pair: long period

  // Bollinger Bands (Mean Reversion — disabled at 3.0)
  bbWindow: 20,
  bbMultiplier: 3.0,

  // Trade Management
  contractDuration: 4,       // Ticks per contract
  stakePercent: 0.14,        // Fraction of balance per trade
  cooldownTicks: 3,          // Min ticks between signal trades
  minTicks: 15,              // Warmup period before first trade

  // Higher threshold = only very strong signals
  compositeThreshold: 0.6,   // Requires aligned multi-timeframe + momentum
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
  // Fast EMA pair
  let fastShortEMA: number | null = null;
  let fastLongEMA: number | null = null;
  let prevFastShortEMA: number | null = null;
  let prevFastLongEMA: number | null = null;
  // Slow EMA pair
  let slowShortEMA: number | null = null;
  let slowLongEMA: number | null = null;
  let prevSlowShortEMA: number | null = null;
  let prevSlowLongEMA: number | null = null;
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
    name: "AutoResearch multi-TF EMA (5/13 + 8/21 agree) thresh0.6 cd3 s14 dur4",

    onTick(tick: Tick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      totalTicks++;
      ticksSinceLastTrade++;

      priceHistory.push(price);
      if (priceHistory.length > PARAMS.bbWindow * 2) {
        priceHistory = priceHistory.slice(-PARAMS.bbWindow * 2);
      }

      prevFastShortEMA = fastShortEMA;
      prevFastLongEMA = fastLongEMA;
      prevSlowShortEMA = slowShortEMA;
      prevSlowLongEMA = slowLongEMA;
      fastShortEMA = updateEMA(fastShortEMA, price, PARAMS.fastShortWindow);
      fastLongEMA = updateEMA(fastLongEMA, price, PARAMS.fastLongWindow);
      slowShortEMA = updateEMA(slowShortEMA, price, PARAMS.slowShortWindow);
      slowLongEMA = updateEMA(slowLongEMA, price, PARAMS.slowLongWindow);

      const prevPrice = lastPrice;
      lastPrice = price;

      if (totalTicks < PARAMS.minTicks) return null;

      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      if (ticksSinceLastTrade < PARAMS.cooldownTicks) return null;

      // ---- Signals ----
      let trendSignal = 0;
      let momentumSignal = 0;

      // 1. Multi-Timeframe EMA Agreement
      // Both fast (5/13) and slow (8/21) crossovers must agree AND momentum confirms
      if (prevFastShortEMA !== null && prevFastLongEMA !== null && fastShortEMA !== null && fastLongEMA !== null &&
          prevSlowShortEMA !== null && prevSlowLongEMA !== null && slowShortEMA !== null && slowLongEMA !== null) {
        const fastPrevDiff = prevFastShortEMA - prevFastLongEMA;
        const fastCurrDiff = fastShortEMA - fastLongEMA;
        const slowPrevDiff = prevSlowShortEMA - prevSlowLongEMA;
        const slowCurrDiff = slowShortEMA - slowLongEMA;

        // Fast crossover
        const fastCrossUp = fastPrevDiff <= 0 && fastCurrDiff > 0;
        const fastCrossDown = fastPrevDiff >= 0 && fastCurrDiff < 0;

        // Slow crossover
        const slowCrossUp = slowPrevDiff <= 0 && slowCurrDiff > 0;
        const slowCrossDown = slowPrevDiff >= 0 && slowCurrDiff < 0;

        // Either fast or slow crossover fires, AND both EMAs agree on direction
        const fastUptrend = fastCurrDiff > 0;
        const fastDowntrend = fastCurrDiff < 0;
        const slowUptrend = slowCurrDiff > 0;
        const slowDowntrend = slowCurrDiff < 0;

        // Fire when EITHER pair crosses AND both timeframes agree on current direction
        if ((fastCrossUp || slowCrossUp) && fastUptrend && slowUptrend) trendSignal = 1.0;
        else if ((fastCrossDown || slowCrossDown) && fastDowntrend && slowDowntrend) trendSignal = -1.0;
      }

      // 2. Micro-Momentum
      if (prevPrice !== null && price !== prevPrice) {
        momentumSignal = price > prevPrice ? 1.0 : -1.0;
      }

      // Blend: 0.5 trend + 0.5 momentum (BB disabled)
      const composite = trendSignal * 0.5 + momentumSignal * 0.2;

      if (Math.abs(composite) < PARAMS.compositeThreshold) return null;

      const direction: "UP" | "DOWN" = composite > 0 ? "UP" : "DOWN";
      const stakeAmt = Math.round(balance * PARAMS.stakePercent * 100) / 100;
      if (stakeAmt < minStake) return null;

      ticksSinceLastTrade = 0;
      return { direction, stake: stakeAmt, duration: PARAMS.contractDuration };
    },

    reset() {
      fastShortEMA = null;
      fastLongEMA = null;
      prevFastShortEMA = null;
      prevFastLongEMA = null;
      slowShortEMA = null;
      slowLongEMA = null;
      prevSlowShortEMA = null;
      prevSlowLongEMA = null;
      priceHistory = [];
      lastPrice = null;
      ticksSinceLastTrade = PARAMS.cooldownTicks;
      totalTicks = 0;
    },
  };
}
