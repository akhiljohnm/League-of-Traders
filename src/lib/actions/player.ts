import { supabase } from "@/lib/supabase";
import type { Player } from "@/lib/types/database";

const STARTING_BALANCE = 10_000;

/**
 * Get or create a player by username.
 * If the username exists, return the existing player.
 * If not, create a new one with $10,000 starting balance.
 */
export async function getOrCreatePlayer(username: string, avatarId?: number): Promise<Player> {
  const trimmed = username.trim().toLowerCase();

  if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
    throw new Error("Username must be 2-20 characters");
  }

  // Try to find existing player
  const { data: existing, error: findError } = await supabase
    .from("players")
    .select("*")
    .eq("username", trimmed)
    .single();

  if (existing && !findError) {
    // Backfill avatar if the player doesn't have one yet
    if (avatarId && !existing.avatar_id) {
      const { data: updated, error: updateErr } = await supabase
        .from("players")
        .update({ avatar_id: avatarId })
        .eq("id", existing.id)
        .select()
        .single();
      if (updated && !updateErr) {
        console.log(`[Player] Backfilled avatar ${avatarId} for ${existing.username}`);
        return updated as Player;
      }
      if (updateErr) {
        console.warn(`[Player] Avatar backfill failed (${updateErr.message}), continuing without it`);
      }
    }
    console.log(`[Player] Found existing player: ${existing.username} (${existing.id})`);
    return existing as Player;
  }

  // Create new player
  let created: Player | null = null;
  let createError: { code?: string; message: string } | null = null;

  // Try with avatar_id first, fall back without it if the column doesn't exist
  const insertPayload: Record<string, unknown> = {
    username: trimmed,
    game_token_balance: STARTING_BALANCE,
    is_bot: false,
    avatar_id: avatarId ?? null,
  };

  const result = await supabase
    .from("players")
    .insert(insertPayload)
    .select()
    .single();

  created = result.data as Player | null;
  createError = result.error;

  // If insert failed and it looks like an avatar_id column issue, retry without it
  if (createError && createError.code !== "23505") {
    console.warn(`[Player] Insert with avatar_id failed (${createError.message}), retrying without it`);
    const { avatar_id: _, ...payloadWithoutAvatar } = insertPayload as Record<string, unknown> & { avatar_id: unknown };
    const retry = await supabase
      .from("players")
      .insert(payloadWithoutAvatar)
      .select()
      .single();
    created = retry.data as Player | null;
    createError = retry.error;
  }

  if (createError) {
    // Handle race condition where another tab created the same username
    if (createError.code === "23505") {
      const { data: retry } = await supabase
        .from("players")
        .select("*")
        .eq("username", trimmed)
        .single();
      if (retry) return retry as Player;
    }
    throw new Error(`Failed to create player: ${createError.message}`);
  }

  console.log(`[Player] Created new player: ${created.username} (${created.id}) with $${STARTING_BALANCE}`);
  return created as Player;
}

/**
 * Credit an amount to a player's global game_token_balance.
 * Used after the 80/20 payout engine to refund the final balance.
 */
export async function creditPlayerBalance(
  playerId: string,
  amount: number
): Promise<Player> {
  const { data: current } = await supabase
    .from("players")
    .select("game_token_balance")
    .eq("id", playerId)
    .single();

  if (!current) throw new Error("Player not found");

  const newBalance = current.game_token_balance + amount;

  const { data, error } = await supabase
    .from("players")
    .update({ game_token_balance: newBalance })
    .eq("id", playerId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to credit balance: ${error?.message}`);
  }

  console.log(
    `[Player] Credited $${amount.toFixed(2)} to ${playerId} (new balance: $${newBalance.toFixed(2)})`
  );
  return data as Player;
}

/**
 * Get a player by ID (for session restore from localStorage).
 */
export async function getPlayerById(id: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Player;
}
