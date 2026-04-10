import { supabase } from "@/lib/supabase";
import type { TradeDirection, TradeStatus } from "@/lib/types/database";

// ============================================================
// Rise/Fall Game Module
// Shared by both human trading UI and BotEngine.
// Simulates Rise/Fall contracts using Deriv as a Price Oracle.
// ============================================================

/** Payout multiplier for Rise (UP): $10 bet → $19.54 on win */
export const RISE_PAYOUT = 1.954;

/** Payout multiplier for Fall (DOWN): $10 bet → $19.52 on win */
export const FALL_PAYOUT = 1.952;

/** Get the payout multiplier for a given direction */
export function getPayoutMultiplier(direction: TradeDirection): number {
  return direction === "UP" ? RISE_PAYOUT : FALL_PAYOUT;
}

/** Default number of ticks before a trade resolves */
export const DEFAULT_TICK_DURATION = 5;

/** Available tick duration options */
export const TICK_DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10] as const;
export type TickDuration = (typeof TICK_DURATION_OPTIONS)[number];

// ============================================================
// Trade Placement
// ============================================================

export interface PlaceTradeParams {
  playerId: string;
  lobbyId: string;
  direction: TradeDirection;
  stake: number;
  entryPrice: number;
}

export interface PlaceTradeResult {
  tradeId: string;
  direction: TradeDirection;
  stake: number;
  entryPrice: number;
}

/**
 * Place a Rise/Fall trade: insert into Supabase `trades` table.
 * The caller is responsible for deducting the stake from the player's balance.
 */
export async function placeTrade(
  params: PlaceTradeParams
): Promise<PlaceTradeResult> {
  const { playerId, lobbyId, direction, stake, entryPrice } = params;

  const { data, error } = await supabase
    .from("trades")
    .insert({
      player_id: playerId,
      lobby_id: lobbyId,
      direction,
      stake,
      entry_price: entryPrice,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `[RiseFall] Failed to place trade: ${error?.message ?? "no data returned"}`
    );
  }

  console.log(
    `[RiseFall] Trade placed: ${direction} $${stake.toFixed(2)} @ ${entryPrice.toFixed(2)} (trade: ${data.id})`
  );

  return {
    tradeId: data.id,
    direction,
    stake,
    entryPrice,
  };
}

// ============================================================
// Trade Resolution
// ============================================================

export interface ResolveTradeParams {
  tradeId: string;
  entryPrice: number;
  exitPrice: number;
  direction: TradeDirection;
  stake: number;
}

export interface ResolveTradeResult {
  status: TradeStatus;
  /** Gross payout: stake * direction multiplier on win, 0 on loss */
  grossPayout: number;
  /** Net PnL: positive on win, negative (= -stake) on loss */
  netPnl: number;
}

/**
 * Resolve a Rise/Fall trade by comparing exit price to entry price.
 * Updates the trade record in Supabase.
 *
 * Win condition:
 *   - UP: exit_price > entry_price
 *   - DOWN: exit_price < entry_price
 *   - Exact same price = loss (no movement = no win)
 */
export async function resolveTrade(
  params: ResolveTradeParams
): Promise<ResolveTradeResult> {
  const { tradeId, entryPrice, exitPrice, direction, stake } = params;

  const won = didTradeWin(direction, entryPrice, exitPrice);
  const status: TradeStatus = won ? "won" : "lost";
  const multiplier = getPayoutMultiplier(direction);
  const grossPayout = won ? round2(stake * multiplier) : 0;
  const netPnl = won ? round2(grossPayout - stake) : -stake;

  const { error } = await supabase
    .from("trades")
    .update({
      exit_price: exitPrice,
      payout: netPnl,
      status,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", tradeId);

  if (error) {
    console.error(`[RiseFall] Failed to resolve trade ${tradeId}:`, error.message);
  }

  console.log(
    `[RiseFall] Trade ${tradeId} ${status.toUpperCase()}: ${direction} $${stake.toFixed(2)} → ${won ? `+$${grossPayout.toFixed(2)}` : `-$${stake.toFixed(2)}`} (entry: ${entryPrice.toFixed(2)}, exit: ${exitPrice.toFixed(2)})`
  );

  return { status, grossPayout, netPnl };
}

// ============================================================
// Pure helpers (no side effects — usable in tests)
// ============================================================

/**
 * Determine if a Rise/Fall trade won based on direction and price movement.
 */
export function didTradeWin(
  direction: TradeDirection,
  entryPrice: number,
  exitPrice: number
): boolean {
  if (direction === "UP") return exitPrice > entryPrice;
  if (direction === "DOWN") return exitPrice < entryPrice;
  return false;
}

/**
 * Calculate the gross payout for a winning trade.
 */
export function calculatePayout(stake: number, won: boolean, direction: TradeDirection): number {
  return won ? round2(stake * getPayoutMultiplier(direction)) : 0;
}

/**
 * Calculate net PnL for a trade.
 */
export function calculateNetPnl(stake: number, won: boolean, direction: TradeDirection): number {
  return won ? round2(stake * getPayoutMultiplier(direction) - stake) : -stake;
}

/** Round to 2 decimal places (avoid floating-point drift) */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
