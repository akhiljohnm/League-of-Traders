import type { DerivTick } from "@/lib/types/deriv";
import type { TradeDirection } from "@/lib/types/database";

// ============================================================
// Bot Strategy Interface & Types
// ============================================================

/**
 * A trade decision produced by a strategy on a given tick.
 */
export interface TradeDecision {
  direction: TradeDirection;
  stake: number;
}

/**
 * Every bot strategy implements this interface.
 * Strategies are stateful — they accumulate tick history and
 * maintain internal indicators (EMAs, bands, counters).
 */
export interface BotStrategyInstance {
  /** Human-readable strategy name */
  readonly name: string;

  /**
   * Process a new tick. Returns a trade decision or null (hold).
   * @param tick  - The latest Deriv tick
   * @param balance - The bot's current virtual balance
   * @param buyIn - The lobby buy-in (used for stake floor calculations)
   */
  onTick(tick: DerivTick, balance: number, buyIn: number): TradeDecision | null;

  /** Reset internal state (for new game rounds) */
  reset(): void;
}

// ============================================================
// Hyperparameter Configs (tunable by auto-research)
// ============================================================

export interface TrendFollowerParams {
  shortWindow: number;   // Short EMA period (default: 5)
  longWindow: number;    // Long EMA period (default: 15)
  stakePercent: number;  // Fraction of balance to stake (default: 0.06)
  cooldownTicks: number; // Min ticks between trades (default: 8)
  minTicks: number;      // Min ticks before first trade (default: 15)
}

export interface MeanReverterParams {
  window: number;           // Rolling window for mean + σ (default: 20)
  bandMultiplier: number;   // σ multiplier for Bollinger Bands (default: 2.0)
  stakePercent: number;     // Fraction of balance to stake (default: 0.10)
  cooldownTicks: number;    // Min ticks between trades (default: 6)
  minTicks: number;         // Min ticks before first trade (default: 20)
}

export interface HighFreqGamblerParams {
  tradeInterval: number;   // Trade every N ticks (default: 4)
  stakePercent: number;    // Fraction of balance per trade (default: 0.04)
  momentumBias: number;    // Probability of following last tick direction (default: 0.65)
  minTicks: number;        // Min ticks before first trade (default: 3)
}

// ============================================================
// Default hyperparameters
// ============================================================

export const DEFAULT_TREND_FOLLOWER_PARAMS: TrendFollowerParams = {
  shortWindow: 5,
  longWindow: 15,
  stakePercent: 0.06,
  cooldownTicks: 8,
  minTicks: 15,
};

export const DEFAULT_MEAN_REVERTER_PARAMS: MeanReverterParams = {
  window: 20,
  bandMultiplier: 2.0,
  stakePercent: 0.10,
  cooldownTicks: 6,
  minTicks: 20,
};

export const DEFAULT_HIGH_FREQ_GAMBLER_PARAMS: HighFreqGamblerParams = {
  tradeInterval: 4,
  stakePercent: 0.04,
  momentumBias: 0.65,
  minTicks: 3,
};

/** Trade duration in ticks — how many ticks until a trade resolves */
export const TRADE_DURATION_TICKS = 5;

/** Approximate total ticks in a 5-minute game (~1 tick/sec) */
export const GAME_TOTAL_TICKS = 300;

/** Players with fewer trades than this forfeit their entire balance */
export const MIN_TRADES_QUOTA = 5;

/** Alphas (winners) pay this fraction of profit into the Safety Net */
export const ALPHA_TAX_RATE = 0.20;

/**
 * Payout multipliers are direction-dependent.
 * Use RISE_PAYOUT / FALL_PAYOUT or getPayoutMultiplier(direction) from src/lib/game/rise-fall.ts.
 */
export { RISE_PAYOUT, FALL_PAYOUT, getPayoutMultiplier } from "@/lib/game/rise-fall";
