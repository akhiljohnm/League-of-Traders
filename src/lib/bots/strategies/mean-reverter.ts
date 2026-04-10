import type { DerivTick } from "@/lib/types/deriv";
import type {
  BotStrategyInstance,
  TradeDecision,
  MeanReverterParams,
} from "../types";
import {
  DEFAULT_MEAN_REVERTER_PARAMS,
  GAME_TOTAL_TICKS,
  MIN_TRADES_QUOTA,
} from "../types";

// ============================================================
// The Mean Reverter — MEDIUM RISK, GAME-AWARE
// Uses Bollinger Bands to bet against spikes. Contrarian player.
// Now aware of: trade quota, alpha/rescue role, game clock.
// ============================================================

export function createMeanReverter(
  params: Partial<MeanReverterParams> = {}
): BotStrategyInstance {
  const config = { ...DEFAULT_MEAN_REVERTER_PARAMS, ...params };

  let priceHistory: number[] = [];
  let ticksSinceLastTrade = config.cooldownTicks;
  let totalTicks = 0;
  let tradesPlaced = 0;

  function getMean(): number {
    const window = priceHistory.slice(-config.window);
    return window.reduce((sum, p) => sum + p, 0) / window.length;
  }

  function getStdDev(mean: number): number {
    const window = priceHistory.slice(-config.window);
    const variance =
      window.reduce((sum, p) => sum + (p - mean) ** 2, 0) / window.length;
    return Math.sqrt(variance);
  }

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
    name: "Mean Reverter",

    onTick(tick: DerivTick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      totalTicks++;
      ticksSinceLastTrade++;

      priceHistory.push(price);
      // Keep history bounded
      if (priceHistory.length > config.window * 2) {
        priceHistory = priceHistory.slice(-config.window * 2);
      }

      // Need a full window to calculate bands
      if (totalTicks < config.minTicks) return null;

      // Don't trade if balance is too low
      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      // --- QUOTA URGENCY: force trades to avoid inactive forfeit ---
      const ticksRemaining = GAME_TOTAL_TICKS - totalTicks;
      const tradesNeeded = MIN_TRADES_QUOTA - tradesPlaced;

      if (tradesNeeded > 0 && ticksRemaining <= tradesNeeded * 10) {
        // Direction from mean reversion logic: price above mean → DOWN, below → UP
        const mean = priceHistory.length >= config.window ? getMean() : price;
        const direction: "UP" | "DOWN" =
          price > mean ? "DOWN" : price < mean ? "UP" : (Math.random() < 0.5 ? "UP" : "DOWN");

        const stake = computeStake(balance, buyIn);
        if (stake < minStake) return null;

        ticksSinceLastTrade = 0;
        tradesPlaced++;
        console.log(
          `[MR] QUOTA URGENCY: forced trade #${tradesPlaced} → ${direction} $${stake.toFixed(2)} (${tradesNeeded - 1} more needed, ${ticksRemaining} ticks left)`
        );
        return { direction, stake };
      }

      // Respect cooldown (only for signal trades)
      if (ticksSinceLastTrade < config.cooldownTicks) return null;

      const mean = getMean();
      const stdDev = getStdDev(mean);

      // Avoid trading in flat markets (σ ≈ 0)
      if (stdDev < mean * 0.0001) return null;

      const upperBand = mean + config.bandMultiplier * stdDev;
      const lowerBand = mean - config.bandMultiplier * stdDev;

      const stake = computeStake(balance, buyIn);
      if (stake < minStake) return null;

      // Price above upper band → overbought → bet DOWN (expect reversion)
      if (price > upperBand) {
        ticksSinceLastTrade = 0;
        tradesPlaced++;
        console.log(
          `[MR] OVERBOUGHT: price=${price.toFixed(2)} > upper=${upperBand.toFixed(2)} (μ=${mean.toFixed(2)}, σ=${stdDev.toFixed(4)}) → DOWN $${stake.toFixed(2)} (trade #${tradesPlaced})`
        );
        return { direction: "DOWN", stake };
      }

      // Price below lower band → oversold → bet UP (expect reversion)
      if (price < lowerBand) {
        ticksSinceLastTrade = 0;
        tradesPlaced++;
        console.log(
          `[MR] OVERSOLD: price=${price.toFixed(2)} < lower=${lowerBand.toFixed(2)} (μ=${mean.toFixed(2)}, σ=${stdDev.toFixed(4)}) → UP $${stake.toFixed(2)} (trade #${tradesPlaced})`
        );
        return { direction: "UP", stake };
      }

      return null;
    },

    reset() {
      priceHistory = [];
      ticksSinceLastTrade = config.cooldownTicks;
      totalTicks = 0;
      tradesPlaced = 0;
    },
  };
}
