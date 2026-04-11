import type { DerivTick } from "@/lib/types/deriv";
import type { BotStrategyInstance, TradeDecision, HighFreqGamblerParams } from "../types";
import { DEFAULT_HIGH_FREQ_GAMBLER_PARAMS, GAME_TOTAL_TICKS } from "../types";
import { createBrain, BRAIN_PARAMS } from "../brain";

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

    onTick(tick: DerivTick, balance: number, buyIn: number, openTrades: number): TradeDecision | null {
      totalTicks++;
      ticksSinceLastTrade++;

      const signal = brain.process(tick, balance, buyIn);

      // Wait for minimum tick history
      if (signal.warming) return null;

      // Hard stop: near-bankruptcy
      const minStake = buyIn * 0.005;
      if (balance < buyIn * BRAIN_PARAMS.hardStopAt) return null;
      if (balance < minStake * 2) return null;

      const isRescue = balance < buyIn;
      const isAlpha = balance > buyIn;

      // Role-aware interval
      const effectiveInterval = isRescue
        ? Math.max(2, config.tradeInterval - 1)
        : config.tradeInterval;

      // Only check signal at the configured interval (signal frequency — not trade resolution)
      if (ticksSinceLastTrade < effectiveInterval) return null;

      // Cap concurrent exposure
      if (openTrades >= config.maxConcurrentTrades) return null;

      // Mid-game freeze: HFG slows down (reduced stake) rather than full stop —
      // it still needs to hit the 5-trade quota and its personality is volume.
      const midGameStakeMultiplier = signal.isMidGameFreeze ? 0.3 : 1.0;

      // PERSONALITY: gambler — use adaptive threshold halved to stay aggressive,
      // but respect the high-vol filter to avoid noise in wild markets.
      const threshold = signal.adaptiveThreshold * 0.5;

      let direction: "UP" | "DOWN";
      if (Math.abs(signal.composite) >= threshold) {
        direction = signal.composite > 0 ? "UP" : "DOWN";
      } else if (signal.momentum !== 0) {
        direction = signal.momentum > 0 ? "UP" : "DOWN";
      } else {
        direction = Math.random() < 0.5 ? "UP" : "DOWN";
      }

      // Stake: use brain's suggested pct as base, modified by personality and role.
      // HFG caps per-trade exposure lower than TF/MR to enable more concurrent trades.
      const basePct = signal.suggestedStakePct > 0 ? signal.suggestedStakePct : config.stakePercent;
      let multiplier = midGameStakeMultiplier;
      if (isRescue) multiplier *= 1.3;
      else if (isAlpha) multiplier *= 0.8;

      const stake = Math.min(
        Math.round(balance * basePct * multiplier * 100) / 100,
        balance * 0.20   // HFG hard cap: never bet > 20% on a single trade
      );
      if (stake < minStake) return null;

      ticksSinceLastTrade = 0;
      tradesPlaced++;
      const phase = signal.isLateGame ? "LATE" : signal.isMidGameFreeze ? "MID-FREEZE" : "normal";
      console.log(
        `[HFG] Trade #${tradesPlaced} [${phase}]: ${direction} $${stake.toFixed(2)} @ ${tick.quote.toFixed(2)} (signal=${signal.composite.toFixed(3)}, vol=${signal.relVol.toFixed(5)}, ${isRescue ? "RESCUE" : isAlpha ? "ALPHA" : "EVEN"}, open=${openTrades + 1}) dur=${signal.suggestedDuration}`
      );
      return { direction, stake, duration: signal.suggestedDuration };
    },

    reset() {
      brain.reset();
      totalTicks = 0;
      ticksSinceLastTrade = config.tradeInterval;
      tradesPlaced = 0;
    },
  };
}
