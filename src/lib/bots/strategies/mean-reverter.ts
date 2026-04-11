import type { DerivTick } from "@/lib/types/deriv";
import type { BotStrategyInstance, TradeDecision, MeanReverterParams } from "../types";
import { DEFAULT_MEAN_REVERTER_PARAMS, GAME_TOTAL_TICKS, MIN_TRADES_QUOTA } from "../types";
import { createBrain, BRAIN_PARAMS } from "../brain";

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

  function computeStake(balance: number, buyIn: number, suggestedStakePct: number): number {
    const isRescue = balance < buyIn;
    const isAlpha = balance > buyIn;

    let multiplier = 1.0;
    if (isRescue) multiplier = 1.2;
    else if (isAlpha) multiplier = 0.85;

    const base = suggestedStakePct > 0 ? suggestedStakePct : config.stakePercent;
    return Math.min(
      Math.round(balance * base * multiplier * 100) / 100,
      balance * 0.95
    );
  }

  return {
    name: "Mean Reverter",

    onTick(tick: DerivTick, balance: number, buyIn: number, openTrades: number): TradeDecision | null {
      totalTicks++;
      ticksSinceLastTrade++;

      const signal = brain.process(tick, balance, buyIn);

      // Warmup
      if (signal.warming) return null;

      // Hard stop: near-bankruptcy → no trades at all
      const minStake = buyIn * 0.01;
      if (balance < buyIn * BRAIN_PARAMS.hardStopAt) return null;
      if (balance < minStake * 2) return null;

      // --- QUOTA URGENCY: force trades to avoid inactive forfeit ---
      const ticksRemaining = GAME_TOTAL_TICKS - totalTicks;
      const tradesNeeded = MIN_TRADES_QUOTA - tradesPlaced;

      if (tradesNeeded > 0 && ticksRemaining <= tradesNeeded * 10) {
        const direction: "UP" | "DOWN" =
          signal.reversion !== 0
            ? (signal.reversion > 0 ? "UP" : "DOWN")
            : (signal.composite >= 0 ? "UP" : "DOWN");
        const stake = computeStake(balance, buyIn, signal.suggestedStakePct);
        if (stake < minStake) return null;

        ticksSinceLastTrade = 0;
        tradesPlaced++;
        console.log(
          `[MR] QUOTA URGENCY: forced trade #${tradesPlaced} -> ${direction} $${stake.toFixed(2)} (${tradesNeeded - 1} more needed, ${ticksRemaining} ticks left, open=${openTrades})`
        );
        return { direction, stake, duration: signal.suggestedDuration };
      }

      // Mid-game freeze: conserve capital for late-game all-in
      if (signal.isMidGameFreeze) return null;

      // Respect cooldown (signal frequency — not trade resolution)
      if (ticksSinceLastTrade < config.cooldownTicks) return null;

      // Cap concurrent exposure
      if (openTrades >= config.maxConcurrentTrades) return null;

      // PERSONALITY: contrarian — only trade when reversion signal fires.
      // During late game, fall back to composite direction (any strong signal).
      if (signal.isLateGame) {
        if (Math.abs(signal.composite) < signal.adaptiveThreshold) return null;
      } else {
        if (Math.abs(signal.reversion) < REVERSION_THRESHOLD) return null;
        // Also gate on composite exceeding adaptive threshold to avoid high-vol noise
        if (Math.abs(signal.composite) < signal.adaptiveThreshold) return null;
      }

      const direction: "UP" | "DOWN" = signal.isLateGame
        ? (signal.composite > 0 ? "UP" : "DOWN")
        : (signal.reversion > 0 ? "UP" : "DOWN");

      const stake = computeStake(balance, buyIn, signal.suggestedStakePct);
      if (stake < minStake) return null;

      ticksSinceLastTrade = 0;
      tradesPlaced++;
      const phase = signal.isLateGame ? "LATE-GAME" : (signal.reversion > 0 ? "OVERSOLD->UP" : "OVERBOUGHT->DOWN");
      console.log(
        `[MR] ${phase} (composite=${signal.composite.toFixed(3)}, vol=${signal.relVol.toFixed(5)}) -> ${direction} $${stake.toFixed(2)} dur=${signal.suggestedDuration} (trade #${tradesPlaced}, open=${openTrades + 1})`
      );
      return { direction, stake, duration: signal.suggestedDuration };
    },

    reset() {
      brain.reset();
      ticksSinceLastTrade = config.cooldownTicks;
      totalTicks = 0;
      tradesPlaced = 0;
    },
  };
}
