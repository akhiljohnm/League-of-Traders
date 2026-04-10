import { supabase } from "@/lib/supabase";
import type { BotStrategy, BotSubscription } from "@/lib/types/database";
import { BOT_SUBSCRIPTION_COST, BOT_SUBSCRIPTION_DAYS } from "@/lib/types/database";

// ============================================================
// Bot Subscription Actions — $200/month recurring revenue
// ============================================================
// Lazy renewal: we check expiry on every access. No cron needed.
// If expired + sufficient balance → auto-renew.
// If expired + insufficient balance → lock (is_active = false).
// ============================================================

/**
 * Purchase (or renew) a bot subscription.
 * Deducts $200 from game_token_balance, sets expires_at to +30 days.
 */
export async function purchaseBotSubscription(
  playerId: string,
  strategy: BotStrategy
): Promise<BotSubscription> {
  // Check balance
  const { data: player, error: playerErr } = await supabase
    .from("players")
    .select("game_token_balance")
    .eq("id", playerId)
    .single();

  if (playerErr || !player) throw new Error("Player not found");
  if (player.game_token_balance < BOT_SUBSCRIPTION_COST) {
    throw new Error(
      `Insufficient balance. Need $${BOT_SUBSCRIPTION_COST} to subscribe (you have $${player.game_token_balance.toLocaleString()})`
    );
  }

  // Deduct subscription cost
  const { error: deductErr } = await supabase
    .from("players")
    .update({
      game_token_balance: player.game_token_balance - BOT_SUBSCRIPTION_COST,
    })
    .eq("id", playerId);

  if (deductErr) throw new Error(`Failed to deduct subscription cost: ${deductErr.message}`);

  // Upsert subscription (one row per player+strategy)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + BOT_SUBSCRIPTION_DAYS);

  const { data: sub, error: subErr } = await supabase
    .from("bot_subscriptions")
    .upsert(
      {
        player_id: playerId,
        bot_strategy: strategy,
        purchased_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
      },
      { onConflict: "player_id,bot_strategy" }
    )
    .select()
    .single();

  if (subErr || !sub) throw new Error(`Failed to create subscription: ${subErr?.message}`);

  console.log(
    `[Subscription] ${playerId} subscribed to ${strategy} for $${BOT_SUBSCRIPTION_COST} (expires: ${expiresAt.toISOString()})`
  );

  return sub as BotSubscription;
}

/**
 * Get all subscriptions for a player.
 * Runs lazy renewal/lock on any expired subscriptions.
 */
export async function getPlayerSubscriptions(
  playerId: string
): Promise<BotSubscription[]> {
  const { data: subs, error } = await supabase
    .from("bot_subscriptions")
    .select("*")
    .eq("player_id", playerId);

  if (error) throw new Error(`Failed to get subscriptions: ${error.message}`);
  if (!subs || subs.length === 0) return [];

  // Lazy renewal check on expired subscriptions
  const now = new Date();
  const results: BotSubscription[] = [];

  for (const sub of subs as BotSubscription[]) {
    if (new Date(sub.expires_at) < now && sub.is_active) {
      // Expired — attempt auto-renew
      const renewed = await attemptRenewal(playerId, sub);
      results.push(renewed);
    } else {
      results.push(sub);
    }
  }

  return results;
}

/**
 * Check if a player has an active subscription for a specific bot strategy.
 * Triggers lazy renewal if expired.
 */
export async function hasActiveSubscription(
  playerId: string,
  strategy: BotStrategy
): Promise<boolean> {
  const { data: sub, error } = await supabase
    .from("bot_subscriptions")
    .select("*")
    .eq("player_id", playerId)
    .eq("bot_strategy", strategy)
    .single();

  if (error || !sub) return false;

  const typed = sub as BotSubscription;
  const now = new Date();

  // Active and not expired
  if (typed.is_active && new Date(typed.expires_at) >= now) {
    return true;
  }

  // Expired — attempt renewal
  if (new Date(typed.expires_at) < now) {
    const renewed = await attemptRenewal(playerId, typed);
    return renewed.is_active;
  }

  return typed.is_active;
}

/**
 * Attempt to auto-renew an expired subscription.
 * If player has sufficient balance, deduct $200 and extend 30 days.
 * If not, set is_active = false (lock the bot).
 */
async function attemptRenewal(
  playerId: string,
  sub: BotSubscription
): Promise<BotSubscription> {
  const { data: player } = await supabase
    .from("players")
    .select("game_token_balance")
    .eq("id", playerId)
    .single();

  if (player && player.game_token_balance >= BOT_SUBSCRIPTION_COST) {
    // Auto-renew: deduct and extend
    const { error: deductErr } = await supabase
      .from("players")
      .update({
        game_token_balance: player.game_token_balance - BOT_SUBSCRIPTION_COST,
      })
      .eq("id", playerId);

    if (!deductErr) {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + BOT_SUBSCRIPTION_DAYS);

      const { data: renewed } = await supabase
        .from("bot_subscriptions")
        .update({
          expires_at: newExpiry.toISOString(),
          purchased_at: new Date().toISOString(),
          is_active: true,
        })
        .eq("id", sub.id)
        .select()
        .single();

      console.log(
        `[Subscription] Auto-renewed ${sub.bot_strategy} for ${playerId} ($${BOT_SUBSCRIPTION_COST} deducted)`
      );

      return (renewed as BotSubscription) ?? { ...sub, is_active: true, expires_at: newExpiry.toISOString() };
    }
  }

  // Cannot renew — lock the bot
  const { data: locked } = await supabase
    .from("bot_subscriptions")
    .update({ is_active: false })
    .eq("id", sub.id)
    .select()
    .single();

  console.log(
    `[Subscription] ${sub.bot_strategy} LOCKED for ${playerId} — insufficient balance for renewal`
  );

  return (locked as BotSubscription) ?? { ...sub, is_active: false };
}
