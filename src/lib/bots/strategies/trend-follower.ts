import type { DerivTick } from "@/lib/types/deriv";
import type { BotStrategyInstance, TradeDecision, TrendFollowerParams } from "../types";
import { DEFAULT_TREND_FOLLOWER_PARAMS, GAME_TOTAL_TICKS, MIN_TRADES_QUOTA } from "../types";
import { createBrain } from "../brain";

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

      if (tradesNeeded > 0 && ticksRemaining <= tradesNeeded * 12) {
        const direction: "UP" | "DOWN" = signal.composite >= 0 ? "UP" : "DOWN";
        const stake = computeStake(balance, buyIn);
        if (stake < minStake) return null;

        ticksSinceLastTrade = 0;
        tradesPlaced++;
        console.log(
          `[TF] QUOTA URGENCY: forced trade #${tradesPlaced} -> ${direction} $${stake.toFixed(2)} (${tradesNeeded - 1} more needed, ${ticksRemaining} ticks left)`
        );
        return { direction, stake };
      }

      // Respect cooldown
      if (ticksSinceLastTrade < config.cooldownTicks) return null;

      // PERSONALITY: Only trade on STRONG signals (trend-following patience)
      if (Math.abs(signal.composite) < CONFIDENCE_THRESHOLD) return null;

      const direction: "UP" | "DOWN" = signal.composite > 0 ? "UP" : "DOWN";
      const stake = computeStake(balance, buyIn);
      if (stake < minStake) return null;

      ticksSinceLastTrade = 0;
      tradesPlaced++;
      console.log(
        `[TF] Signal: ${signal.composite.toFixed(3)} (trend=${signal.trend}, bb=${signal.reversion}, mom=${signal.momentum}) -> ${direction} $${stake.toFixed(2)} (trade #${tradesPlaced})`
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
