import type { DerivTick } from "@/lib/types/deriv";
import type { BotStrategyInstance, TradeDecision, TrendFollowerParams } from "../types";
import { DEFAULT_TREND_FOLLOWER_PARAMS, GAME_TOTAL_TICKS, MIN_TRADES_QUOTA } from "../types";
import { createBrain, BRAIN_PARAMS } from "../brain";

// ============================================================
// The Trend Follower — LOW RISK personality
// Uses the shared AutoResearch brain for signals.
// Personality: patient, only trades on strong signals,
// conservative stakes, long cooldowns.
// ============================================================

export function createTrendFollower(
  params: Partial<TrendFollowerParams> = {}
): BotStrategyInstance {
  const config = { ...DEFAULT_TREND_FOLLOWER_PARAMS, ...params };

  const brain = createBrain();
  let ticksSinceLastTrade = config.cooldownTicks;
  let totalTicks = 0;
  let tradesPlaced = 0;

  /** Only trade when composite signal is strong (high confidence) */
  const CONFIDENCE_THRESHOLD = 0.4;

  /**
   * Compute stake using the brain's suggestedStakePct as the base.
   * Role-aware multipliers still apply on top for rescue/alpha scenarios,
   * but are capped so the research-derived sizing isn't overridden wildly.
   */
  function computeStake(balance: number, buyIn: number, suggestedStakePct: number): number {
    const isRescue = balance < buyIn;
    const isAlpha = balance > buyIn;

    let multiplier = 1.0;
    if (isRescue) multiplier = 1.2;       // Rescue: push harder but don't blow up
    else if (isAlpha) multiplier = 0.85;  // Alpha: slight protection on gains

    const base = suggestedStakePct > 0 ? suggestedStakePct : config.stakePercent;
    return Math.min(
      Math.round(balance * base * multiplier * 100) / 100,
      balance * 0.95 // never stake more than 95% in one go
    );
  }

  return {
    name: "Trend Follower",

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

      if (tradesNeeded > 0 && ticksRemaining <= tradesNeeded * 12) {
        const direction: "UP" | "DOWN" = signal.composite >= 0 ? "UP" : "DOWN";
        const stake = computeStake(balance, buyIn, signal.suggestedStakePct);
        if (stake < minStake) return null;

        ticksSinceLastTrade = 0;
        tradesPlaced++;
        console.log(
          `[TF] QUOTA URGENCY: forced trade #${tradesPlaced} -> ${direction} $${stake.toFixed(2)} (${tradesNeeded - 1} more needed, ${ticksRemaining} ticks left, open=${openTrades})`
        );
        return { direction, stake, duration: signal.suggestedDuration };
      }

      // Mid-game freeze: conserve capital for late-game all-in
      if (signal.isMidGameFreeze) return null;

      // Respect cooldown (signal frequency — not trade resolution)
      if (ticksSinceLastTrade < config.cooldownTicks) return null;

      // Cap concurrent exposure
      if (openTrades >= config.maxConcurrentTrades) return null;

      // PERSONALITY: patience — require composite to exceed adaptive threshold × personality multiplier.
      // TrendFollower stays selective even when the adaptive threshold relaxes.
      const threshold = Math.max(signal.adaptiveThreshold, CONFIDENCE_THRESHOLD);
      if (Math.abs(signal.composite) < threshold) return null;

      const direction: "UP" | "DOWN" = signal.composite > 0 ? "UP" : "DOWN";
      const stake = computeStake(balance, buyIn, signal.suggestedStakePct);
      if (stake < minStake) return null;

      ticksSinceLastTrade = 0;
      tradesPlaced++;
      const phase = signal.isLateGame ? "LATE-GAME" : "normal";
      console.log(
        `[TF] ${phase} signal: ${signal.composite.toFixed(3)} (threshold=${threshold.toFixed(2)}, vol=${signal.relVol.toFixed(5)}) -> ${direction} $${stake.toFixed(2)} dur=${signal.suggestedDuration} (trade #${tradesPlaced}, open=${openTrades + 1})`
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
