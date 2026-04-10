import type { DerivTick } from "@/lib/types/deriv";
import type {
  BotStrategyInstance,
  TradeDecision,
  TrendFollowerParams,
} from "../types";
import {
  DEFAULT_TREND_FOLLOWER_PARAMS,
  GAME_TOTAL_TICKS,
  MIN_TRADES_QUOTA,
} from "../types";

// ============================================================
// The Trend Follower — LOW RISK, GAME-AWARE
// Uses EMA crossover to ride momentum. Conservative and patient.
// Now aware of: trade quota, alpha/rescue role, game clock.
// ============================================================

function updateEMA(
  currentEMA: number | null,
  price: number,
  period: number
): number {
  if (currentEMA === null) return price;
  const k = 2 / (period + 1);
  return price * k + currentEMA * (1 - k);
}

export function createTrendFollower(
  params: Partial<TrendFollowerParams> = {}
): BotStrategyInstance {
  const config = { ...DEFAULT_TREND_FOLLOWER_PARAMS, ...params };

  let shortEMA: number | null = null;
  let longEMA: number | null = null;
  let prevShortEMA: number | null = null;
  let prevLongEMA: number | null = null;
  let ticksSinceLastTrade = config.cooldownTicks; // Start ready to trade
  let totalTicks = 0;
  let tradesPlaced = 0;

  function computeStake(balance: number, buyIn: number): number {
    const ticksRemaining = GAME_TOTAL_TICKS - totalTicks;
    const isRescue = balance < buyIn;
    const isAlpha = balance > buyIn;
    const isLateGame = ticksRemaining < 60;

    let multiplier = 1.0;
    if (isRescue) {
      multiplier = 1.5;
    } else if (isAlpha) {
      multiplier = isLateGame ? 0.56 : 0.8;
    }

    return Math.min(
      Math.round(balance * config.stakePercent * multiplier * 100) / 100,
      balance * 0.25
    );
  }

  return {
    name: "Trend Follower",

    onTick(tick: DerivTick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      totalTicks++;
      ticksSinceLastTrade++;

      // Store previous EMAs for crossover detection
      prevShortEMA = shortEMA;
      prevLongEMA = longEMA;

      // Update EMAs
      shortEMA = updateEMA(shortEMA, price, config.shortWindow);
      longEMA = updateEMA(longEMA, price, config.longWindow);

      // Need enough ticks to establish both EMAs
      if (totalTicks < config.minTicks) return null;

      // Don't trade if balance is too low
      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      // --- QUOTA URGENCY: force trades to avoid inactive forfeit ---
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
        console.log(
          `[TF] QUOTA URGENCY: forced trade #${tradesPlaced} → ${direction} $${stake.toFixed(2)} (${tradesNeeded - 1} more needed, ${ticksRemaining} ticks left)`
        );
        return { direction, stake };
      }

      // Respect cooldown (only for signal trades, not forced)
      if (ticksSinceLastTrade < config.cooldownTicks) return null;

      // Need previous values for crossover detection
      if (prevShortEMA === null || prevLongEMA === null) return null;

      // Detect crossover
      const prevDiff = prevShortEMA - prevLongEMA;
      const currDiff = shortEMA! - longEMA!;

      // Bullish crossover: short EMA crosses above long EMA
      if (prevDiff <= 0 && currDiff > 0) {
        const stake = computeStake(balance, buyIn);
        if (stake < minStake) return null;

        ticksSinceLastTrade = 0;
        tradesPlaced++;
        console.log(
          `[TF] BULLISH crossover: shortEMA=${shortEMA!.toFixed(2)} > longEMA=${longEMA!.toFixed(2)} → UP $${stake.toFixed(2)} (trade #${tradesPlaced})`
        );
        return { direction: "UP", stake };
      }

      // Bearish crossover: short EMA crosses below long EMA
      if (prevDiff >= 0 && currDiff < 0) {
        const stake = computeStake(balance, buyIn);
        if (stake < minStake) return null;

        ticksSinceLastTrade = 0;
        tradesPlaced++;
        console.log(
          `[TF] BEARISH crossover: shortEMA=${shortEMA!.toFixed(2)} < longEMA=${longEMA!.toFixed(2)} → DOWN $${stake.toFixed(2)} (trade #${tradesPlaced})`
        );
        return { direction: "DOWN", stake };
      }

      return null;
    },

    reset() {
      shortEMA = null;
      longEMA = null;
      prevShortEMA = null;
      prevLongEMA = null;
      ticksSinceLastTrade = config.cooldownTicks;
      totalTicks = 0;
      tradesPlaced = 0;
    },
  };
}
