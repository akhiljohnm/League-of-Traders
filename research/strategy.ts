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
  // Primary (slow) EMA Crossover — high quality signal
  slowShortWindow: 8,        // Slow EMA pair short
  slowLongWindow: 21,        // Slow EMA pair long
  slowCooldown: 4,           // Ticks between slow-tier trades (quality spacing)

  // Secondary (fast) EMA Crossover — supplemental signal
  fastShortWindow: 5,        // Fast EMA pair short
  fastLongWindow: 13,        // Fast EMA pair long
  fastCooldown: 3,           // Ticks between fast-tier trades

  // Both EMAs must agree (slow and fast both in same direction) for fast trades
  // Slow trades fire independently on slow crossover + momentum

  // Bollinger Bands (Mean Reversion — disabled at 3.0)
  bbWindow: 20,
  bbMultiplier: 3.0,

  // Trade Management
  contractDuration: 4,       // Ticks per contract
  stakePercent: 0.14,        // Fraction of balance per trade
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
  let slowShortEMA: number | null = null;
  let slowLongEMA: number | null = null;
  let prevSlowShortEMA: number | null = null;
  let prevSlowLongEMA: number | null = null;

  let fastShortEMA: number | null = null;
  let fastLongEMA: number | null = null;
  let prevFastShortEMA: number | null = null;
  let prevFastLongEMA: number | null = null;

  let priceHistory: number[] = [];
  let lastPrice: number | null = null;
  let ticksSinceSlowTrade = PARAMS.slowCooldown;
  let ticksSinceFastTrade = PARAMS.fastCooldown;
  let totalTicks = 0;

  return {
    name: "AutoResearch 2-tier EMA (slow8/21 cd4 + fast5/13 cd3 both-agree) s14 dur4",

    onTick(tick: Tick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      totalTicks++;
      ticksSinceSlowTrade++;
      ticksSinceFastTrade++;

      priceHistory.push(price);
      if (priceHistory.length > PARAMS.bbWindow * 2) {
        priceHistory = priceHistory.slice(-PARAMS.bbWindow * 2);
      }

      prevSlowShortEMA = slowShortEMA;
      prevSlowLongEMA = slowLongEMA;
      prevFastShortEMA = fastShortEMA;
      prevFastLongEMA = fastLongEMA;

      slowShortEMA = updateEMA(slowShortEMA, price, PARAMS.slowShortWindow);
      slowLongEMA = updateEMA(slowLongEMA, price, PARAMS.slowLongWindow);
      fastShortEMA = updateEMA(fastShortEMA, price, PARAMS.fastShortWindow);
      fastLongEMA = updateEMA(fastLongEMA, price, PARAMS.fastLongWindow);

      const prevPrice = lastPrice;
      lastPrice = price;

      if (totalTicks < PARAMS.minTicks) return null;

      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      if (slowShortEMA === null || slowLongEMA === null || fastShortEMA === null || fastLongEMA === null) return null;
      if (prevSlowShortEMA === null || prevSlowLongEMA === null || prevFastShortEMA === null || prevFastLongEMA === null) return null;

      const momentumUp = prevPrice !== null && price > prevPrice;
      const momentumDown = prevPrice !== null && price < prevPrice;

      const slowPrevDiff = prevSlowShortEMA - prevSlowLongEMA;
      const slowCurrDiff = slowShortEMA - slowLongEMA;
      const fastPrevDiff = prevFastShortEMA - prevFastLongEMA;
      const fastCurrDiff = fastShortEMA - fastLongEMA;

      const slowUptrend = slowCurrDiff > 0;
      const slowDowntrend = slowCurrDiff < 0;
      const fastUptrend = fastCurrDiff > 0;
      const fastDowntrend = fastCurrDiff < 0;

      // ---- Tier 1: Slow EMA (8/21) crossover + momentum → cooldown=4 ----
      const slowCrossUp = slowPrevDiff <= 0 && slowCurrDiff > 0 && momentumUp;
      const slowCrossDown = slowPrevDiff >= 0 && slowCurrDiff < 0 && momentumDown;

      if (ticksSinceSlowTrade >= PARAMS.slowCooldown) {
        if (slowCrossUp) {
          ticksSinceSlowTrade = 0;
          ticksSinceFastTrade = 0; // also resets fast cooldown
          const stakeAmt = Math.round(balance * PARAMS.stakePercent * 100) / 100;
          if (stakeAmt >= minStake) return { direction: "UP", stake: stakeAmt, duration: PARAMS.contractDuration };
        }
        if (slowCrossDown) {
          ticksSinceSlowTrade = 0;
          ticksSinceFastTrade = 0;
          const stakeAmt = Math.round(balance * PARAMS.stakePercent * 100) / 100;
          if (stakeAmt >= minStake) return { direction: "DOWN", stake: stakeAmt, duration: PARAMS.contractDuration };
        }
      }

      // ---- Tier 2: Fast EMA (5/13) crossover + BOTH EMAs agree + momentum → cooldown=3 ----
      const fastCrossUp = fastPrevDiff <= 0 && fastCurrDiff > 0 && momentumUp && slowUptrend;
      const fastCrossDown = fastPrevDiff >= 0 && fastCurrDiff < 0 && momentumDown && slowDowntrend;

      if (ticksSinceFastTrade >= PARAMS.fastCooldown) {
        if (fastCrossUp) {
          ticksSinceFastTrade = 0;
          const stakeAmt = Math.round(balance * PARAMS.stakePercent * 100) / 100;
          if (stakeAmt >= minStake) return { direction: "UP", stake: stakeAmt, duration: PARAMS.contractDuration };
        }
        if (fastCrossDown) {
          ticksSinceFastTrade = 0;
          const stakeAmt = Math.round(balance * PARAMS.stakePercent * 100) / 100;
          if (stakeAmt >= minStake) return { direction: "DOWN", stake: stakeAmt, duration: PARAMS.contractDuration };
        }
      }

      return null;
    },

    reset() {
      slowShortEMA = null;
      slowLongEMA = null;
      prevSlowShortEMA = null;
      prevSlowLongEMA = null;
      fastShortEMA = null;
      fastLongEMA = null;
      prevFastShortEMA = null;
      prevFastLongEMA = null;
      priceHistory = [];
      lastPrice = null;
      ticksSinceSlowTrade = PARAMS.slowCooldown;
      ticksSinceFastTrade = PARAMS.fastCooldown;
      totalTicks = 0;
    },
  };
}
