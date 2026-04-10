import type { DerivTick } from "@/lib/types/deriv";
import type { BotStrategyInstance, TradeDecision, HighFreqGamblerParams } from "../types";
import { DEFAULT_HIGH_FREQ_GAMBLER_PARAMS, GAME_TOTAL_TICKS } from "../types";
import { createBrain } from "../brain";

// ============================================================
// The High-Frequency Gambler — HIGH RISK personality
// Uses the shared AutoResearch brain for signals.
// Personality: aggressive — trades on ANY signal regardless
// of confidence, micro-stakes, rapid-fire volume.
// Maximum trades, maximum variance. Could carry or bust.
// ============================================================

export function createHighFreqGambler(
  params: Partial<HighFreqGamblerParams> = {}
): BotStrategyInstance {
  const config = { ...DEFAULT_HIGH_FREQ_GAMBLER_PARAMS, ...params };

  const brain = createBrain();
  let totalTicks = 0;
  let ticksSinceLastTrade = config.tradeInterval;
  let tradesPlaced = 0;

  /** Trades on even the weakest signal */
  const CONFIDENCE_THRESHOLD = 0.05;

  return {
    name: "High-Freq Gambler",

    onTick(tick: DerivTick, balance: number, buyIn: number): TradeDecision | null {
      totalTicks++;
      ticksSinceLastTrade++;

      const signal = brain.process(tick);

      // Wait for minimum tick history
      if (totalTicks < config.minTicks || signal.warming) return null;

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

      // PERSONALITY: Trade on any signal, even weak ones.
      // Use the brain's composite direction if signal exists,
      // fall back to momentum for rapid-fire decisions.
      let direction: "UP" | "DOWN";

      if (Math.abs(signal.composite) >= CONFIDENCE_THRESHOLD) {
        direction = signal.composite > 0 ? "UP" : "DOWN";
      } else if (signal.momentum !== 0) {
        // Follow micro-momentum when composite is flat
        direction = signal.momentum > 0 ? "UP" : "DOWN";
      } else {
        // No signal at all — coin flip (the gambler lives dangerously)
        direction = Math.random() < 0.5 ? "UP" : "DOWN";
      }

      ticksSinceLastTrade = 0;
      tradesPlaced++;
      console.log(
        `[HFG] Trade #${tradesPlaced}: ${direction} $${stake.toFixed(2)} @ ${tick.quote.toFixed(2)} (signal=${signal.composite.toFixed(3)}, ${isRescue ? "RESCUE" : isAlpha ? "ALPHA" : "EVEN"})`
      );
      return { direction, stake };
    },

    reset() {
      brain.reset();
      totalTicks = 0;
      ticksSinceLastTrade = config.tradeInterval;
      tradesPlaced = 0;
    },
  };
}
