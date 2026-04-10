import { supabase } from "@/lib/supabase";
import type { Player } from "@/lib/types/database";

const STARTING_BALANCE = 10_000;

/**
 * Get or create a player by username.
 * If the username exists, return the existing player.
 * If not, create a new one with $10,000 starting balance.
 */
export async function getOrCreatePlayer(username: string): Promise<Player> {
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
    console.log(`[Player] Found existing player: ${existing.username} (${existing.id})`);
    return existing as Player;
  }

  // Create new player
  const { data: created, error: createError } = await supabase
    .from("players")
    .insert({
      username: trimmed,
      game_token_balance: STARTING_BALANCE,
      is_bot: false,
    })
    .select()
    .single();

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
