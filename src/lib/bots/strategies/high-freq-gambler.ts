import type { DerivTick } from "@/lib/types/deriv";
import type {
  BotStrategyInstance,
  TradeDecision,
  HighFreqGamblerParams,
} from "../types";
import {
  DEFAULT_HIGH_FREQ_GAMBLER_PARAMS,
  GAME_TOTAL_TICKS,
} from "../types";

// ============================================================
// The High-Frequency Gambler — HIGH RISK, GAME-AWARE
// Rapid-fire micro-trades following short-term momentum.
// Maximum volume, maximum variance. Could carry or bust.
// Now aware of: alpha/rescue role, game clock.
// ============================================================

export function createHighFreqGambler(
  params: Partial<HighFreqGamblerParams> = {}
): BotStrategyInstance {
  const config = { ...DEFAULT_HIGH_FREQ_GAMBLER_PARAMS, ...params };

  let lastPrice: number | null = null;
  let totalTicks = 0;
  let ticksSinceLastTrade = config.tradeInterval; // Start ready
  let tradesPlaced = 0;

  return {
    name: "High-Freq Gambler",

    onTick(tick: DerivTick, balance: number, buyIn: number): TradeDecision | null {
      const price = tick.quote;
      const prevPrice = lastPrice;
      lastPrice = price;
      totalTicks++;
      ticksSinceLastTrade++;

      // Wait for minimum tick history
      if (totalTicks < config.minTicks) return null;

      // Role-aware interval: rescue bots trade more frequently to recover
      const isRescue = balance < buyIn;
      const effectiveInterval = isRescue
        ? Math.max(2, config.tradeInterval - 1)
        : config.tradeInterval;

      // Only trade at the configured interval
      if (ticksSinceLastTrade < effectiveInterval) return null;

      // Don't trade if balance is too low
      const minStake = buyIn * 0.005;
      if (balance < minStake * 2) return null;

      // Role-aware stake sizing
      const ticksRemaining = GAME_TOTAL_TICKS - totalTicks;
      const isAlpha = balance > buyIn;
      const isLateGame = ticksRemaining < 60;

      let multiplier = 1.0;
      if (isRescue) {
        multiplier = 1.5;
      } else if (isAlpha) {
        multiplier = isLateGame ? 0.56 : 0.8;
      }

      const stake = Math.min(
        Math.round(balance * config.stakePercent * multiplier * 100) / 100,
        balance * 0.15
      );
      if (stake < minStake) return null;

      // Determine direction using micro-momentum + randomness
      let direction: "UP" | "DOWN";

      if (prevPrice !== null && price !== prevPrice) {
        const momentum = price > prevPrice ? "UP" : "DOWN";
        if (Math.random() < config.momentumBias) {
          direction = momentum;
        } else {
          direction = momentum === "UP" ? "DOWN" : "UP";
        }
      } else {
        direction = Math.random() < 0.5 ? "UP" : "DOWN";
      }

      ticksSinceLastTrade = 0;
      tradesPlaced++;
      console.log(
        `[HFG] Trade #${tradesPlaced}: ${direction} $${stake.toFixed(2)} @ ${price.toFixed(2)} (${isRescue ? "RESCUE" : isAlpha ? "ALPHA" : "EVEN"}, interval=${effectiveInterval})`
      );
      return { direction, stake };
    },

    reset() {
      lastPrice = null;
      totalTicks = 0;
      ticksSinceLastTrade = config.tradeInterval;
      tradesPlaced = 0;
    },
  };
}
