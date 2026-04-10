import type { DerivTick } from "@/lib/types/deriv";
import type { BotStrategyInstance, TradeDecision, MeanReverterParams } from "../types";
import { DEFAULT_MEAN_REVERTER_PARAMS, GAME_TOTAL_TICKS, MIN_TRADES_QUOTA } from "../types";
import { createBrain } from "../brain";

// ============================================================
// The Mean Reverter — MEDIUM RISK personality
// Uses the shared AutoResearch brain for signals.
// Personality: contrarian — trades when Bollinger Band signal
// fires (overbought/oversold), medium stakes, acts on
// reversion signal rather than composite trend.
// ============================================================

export function createMeanReverter(
  params: Partial<MeanReverterParams> = {}
): BotStrategyInstance {
  const config = { ...DEFAULT_MEAN_REVERTER_PARAMS, ...params };

  const brain = createBrain();
  let ticksSinceLastTrade = config.cooldownTicks;
  let totalTicks = 0;
  let tradesPlaced = 0;

  /**
   * The Mean Reverter prioritizes the Bollinger Band reversion signal.
   * It trades when the reversion signal fires (price outside bands),
   * using the reversion direction rather than the blended composite.
   * Falls back to composite for quota urgency.
   */
  const REVERSION_THRESHOLD = 0.3;

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
      totalTicks++;
      ticksSinceLastTrade++;

      const signal = brain.process(tick);

      // Warmup
      if (totalTicks < config.minTicks || signal.warming) return null;

      // Don't trade if balance is too low
      const minStake = buyIn * 0.01;
      if (balance < minStake * 2) return null;

      // --- QUOTA URGENCY: force trades to avoid inactive forfeit ---
      const ticksRemaining = GAME_TOTAL_TICKS - totalTicks;
      const tradesNeeded = MIN_TRADES_QUOTA - tradesPlaced;

      if (tradesNeeded > 0 && ticksRemaining <= tradesNeeded * 10) {
        const direction: "UP" | "DOWN" =
          signal.reversion !== 0
            ? (signal.reversion > 0 ? "UP" : "DOWN")
            : (signal.composite >= 0 ? "UP" : "DOWN");
        const stake = computeStake(balance, buyIn);
        if (stake < minStake) return null;

        ticksSinceLastTrade = 0;
        tradesPlaced++;
        console.log(
          `[MR] QUOTA URGENCY: forced trade #${tradesPlaced} -> ${direction} $${stake.toFixed(2)} (${tradesNeeded - 1} more needed, ${ticksRemaining} ticks left)`
        );
        return { direction, stake };
      }

      // Respect cooldown
      if (ticksSinceLastTrade < config.cooldownTicks) return null;

      // PERSONALITY: Only trade when the REVERSION signal fires
      // (price is outside Bollinger Bands — overbought or oversold)
      if (Math.abs(signal.reversion) < REVERSION_THRESHOLD) return null;

      // Use the reversion signal direction (contrarian play)
      const direction: "UP" | "DOWN" = signal.reversion > 0 ? "UP" : "DOWN";
      const stake = computeStake(balance, buyIn);
      if (stake < minStake) return null;

      ticksSinceLastTrade = 0;
      tradesPlaced++;
      console.log(
        `[MR] Reversion signal: ${signal.reversion > 0 ? "OVERSOLD->UP" : "OVERBOUGHT->DOWN"} (composite=${signal.composite.toFixed(3)}) -> ${direction} $${stake.toFixed(2)} (trade #${tradesPlaced})`
      );
      return { direction, stake };
    },

    reset() {
      brain.reset();
      ticksSinceLastTrade = config.cooldownTicks;
      totalTicks = 0;
      tradesPlaced = 0;
    },
  };
}
