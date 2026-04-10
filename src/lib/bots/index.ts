import type { BotStrategy } from "@/lib/types/database";
import type { BotStrategyInstance } from "./types";
import { createTrendFollower } from "./strategies/trend-follower";
import { createMeanReverter } from "./strategies/mean-reverter";
import { createHighFreqGambler } from "./strategies/high-freq-gambler";

/**
 * Factory: create a strategy instance from a BotStrategy type.
 */
export function createStrategy(type: BotStrategy): BotStrategyInstance {
  switch (type) {
    case "trend_follower":
      return createTrendFollower();
    case "mean_reverter":
      return createMeanReverter();
    case "high_freq_gambler":
      return createHighFreqGambler();
    default:
      throw new Error(`Unknown bot strategy: ${type}`);
  }
}

export { createTrendFollower } from "./strategies/trend-follower";
export { createMeanReverter } from "./strategies/mean-reverter";
export { createHighFreqGambler } from "./strategies/high-freq-gambler";
export type { BotStrategyInstance, TradeDecision } from "./types";
