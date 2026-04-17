import { supabase } from "@/lib/supabase";
import type { Lobby, LobbyPlayer, Player, BotStrategy } from "@/lib/types/database";

const MAX_LOBBY_SIZE = 5;
const MIN_LOBBY_SIZE = 2;
const MIN_BUY_IN = 100;
const LOBBY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const BOT_NAMES: Record<BotStrategy, string[]> = {
  trend_follower: ["TF-Alpha", "TF-Sigma", "TF-Nova"],
  mean_reverter: ["MR-Viper", "MR-Ghost", "MR-Echo"],
  high_freq_gambler: ["HF-Blitz", "HF-Surge", "HF-Chaos"],
};

function randomBotName(strategy: BotStrategy): string {
  const names = BOT_NAMES[strategy];
  const suffix = Math.floor(Math.random() * 999)
    .toString()
    .padStart(3, "0");
  return `${names[Math.floor(Math.random() * names.length)]}-${suffix}`;
}

/**
 * Clean up stale waiting lobbies older than LOBBY_TIMEOUT_MS.
 * Marks them as completed, refunds buy-ins to all players.
 */
export async function cleanupStaleLobbies(): Promise<number> {
  const cutoff = new Date(Date.now() - LOBBY_TIMEOUT_MS).toISOString();

  // Find all stale waiting lobbies
  const { data: staleLobbies } = await supabase
    .from("lobbies")
    .select("id, buy_in")
    .eq("status", "waiting")
    .lt("created_at", cutoff);

  if (!staleLobbies || staleLobbies.length === 0) return 0;

  const staleIds = staleLobbies.map((l) => l.id);
  console.log(`[Lobby] Cleaning up ${staleIds.length} stale lobbies`);

  // Get all players in stale lobbies so we can refund buy-ins
  const { data: stalePlayers } = await supabase
    .from("lobby_players")
    .select("player_id, lobby_id")
    .in("lobby_id", staleIds);

  // Build a map of lobby_id -> buy_in for refund amounts
  const buyInMap = new Map(staleLobbies.map((l) => [l.id, l.buy_in ?? 0]));

  // Refund each player's buy-in (skip bots — their balance doesn't matter)
  if (stalePlayers && stalePlayers.length > 0) {
    for (const lp of stalePlayers) {
      const refund = buyInMap.get(lp.lobby_id) ?? 0;
      if (refund > 0) {
        const { data: player } = await supabase
          .from("players")
          .select("game_token_balance, is_bot")
          .eq("id", lp.player_id)
          .single();

        if (player && !player.is_bot) {
          await supabase
            .from("players")
            .update({ game_token_balance: player.game_token_balance + refund })
            .eq("id", lp.player_id);
          console.log(`[Lobby] Refunded $${refund} to player ${lp.player_id}`);
        }
      }
    }
  }

  // Mark all stale lobbies as completed
  await supabase
    .from("lobbies")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .in("id", staleIds);

  console.log(`[Lobby] Cleaned up ${staleIds.length} stale lobbies`);
  return staleIds.length;
}

/**
 * Find a waiting lobby with matching buy-in and open slots, or create a new one.
 */
export async function findOrCreateLobby(
  buyIn: number,
  symbol: string,
  playerId: string
): Promise<{
  lobby: Lobby;
  playerCount: number;
}> {
  if (buyIn < MIN_BUY_IN) {
    throw new Error(`Minimum buy-in is $${MIN_BUY_IN}`);
  }

  // Clean up stale lobbies before matchmaking
  await cleanupStaleLobbies();

  // Only match lobbies created within the timeout window
  const cutoff = new Date(Date.now() - LOBBY_TIMEOUT_MS).toISOString();

  // Find waiting lobbies with matching buy-in AND symbol
  const { data: waitingLobbies } = await supabase
    .from("lobbies")
    .select("*, lobby_players(count)")
    .eq("status", "waiting")
    .eq("buy_in", buyIn)
    .eq("symbol", symbol)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true });

  if (waitingLobbies) {
    for (const lobby of waitingLobbies) {
      const count =
        (lobby.lobby_players as { count: number }[])?.[0]?.count ?? 0;
      if (count < MAX_LOBBY_SIZE) {
        console.log(
          `[Lobby] Found waiting lobby: ${lobby.id} ($${buyIn} buy-in, ${symbol}, ${count}/${MAX_LOBBY_SIZE})`
        );
        return { lobby: lobby as Lobby, playerCount: count };
      }
    }
  }

  // No available lobby — create one (creator becomes owner)
  const { data: newLobby, error } = await supabase
    .from("lobbies")
    .insert({ status: "waiting", buy_in: buyIn, symbol, owner_id: playerId })
    .select()
    .single();

  if (error || !newLobby) {
    throw new Error(`Failed to create lobby: ${error?.message}`);
  }

  console.log(`[Lobby] Created new lobby: ${newLobby.id} ($${buyIn} buy-in, ${symbol})`);
  return { lobby: newLobby as Lobby, playerCount: 0 };
}

/**
 * Join a player into a lobby. Deducts the buy-in from their balance.
 */
export async function joinLobby(
  lobbyId: string,
  playerId: string
): Promise<LobbyPlayer> {
  // Check if already in this lobby
  const { data: existing } = await supabase
    .from("lobby_players")
    .select("*")
    .eq("lobby_id", lobbyId)
    .eq("player_id", playerId)
    .single();

  if (existing) {
    console.log(`[Lobby] Player already in lobby: ${playerId}`);
    return existing as LobbyPlayer;
  }

  // Check lobby isn't full
  const { count } = await supabase
    .from("lobby_players")
    .select("*", { count: "exact", head: true })
    .eq("lobby_id", lobbyId);

  if ((count ?? 0) >= MAX_LOBBY_SIZE) {
    throw new Error("Lobby is full");
  }

  // Get lobby details and player balance
  const [lobbyRes, playerRes] = await Promise.all([
    supabase.from("lobbies").select("buy_in, owner_id").eq("id", lobbyId).single(),
    supabase
      .from("players")
      .select("game_token_balance")
      .eq("id", playerId)
      .single(),
  ]);

  const buyIn = lobbyRes.data?.buy_in ?? 0;
  const balance = playerRes.data?.game_token_balance ?? 0;

  // If lobby has no owner yet, this player becomes the owner
  if (!lobbyRes.data?.owner_id) {
    await supabase
      .from("lobbies")
      .update({ owner_id: playerId })
      .eq("id", lobbyId);
    console.log(`[Lobby] Player ${playerId} is now the owner of lobby ${lobbyId}`);
  }

  if (balance < buyIn) {
    throw new Error(
      `Insufficient balance. Need $${buyIn.toLocaleString()} but have $${balance.toLocaleString()}`
    );
  }

  // Deduct buy-in from player
  const { error: deductErr } = await supabase
    .from("players")
    .update({ game_token_balance: balance - buyIn })
    .eq("id", playerId);

  if (deductErr)
    throw new Error(`Failed to deduct buy-in: ${deductErr.message}`);

  const { data, error } = await supabase
    .from("lobby_players")
    .insert({ lobby_id: lobbyId, player_id: playerId })
    .select()
    .single();

  if (error) throw new Error(`Failed to join lobby: ${error.message}`);

  console.log(
    `[Lobby] Player ${playerId} joined lobby ${lobbyId} (paid $${buyIn} buy-in)`
  );

  await checkAndLockLobby(lobbyId);
  return data as LobbyPlayer;
}

/**
 * Get all players in a lobby with their player details.
 */
export async function getLobbyPlayers(
  lobbyId: string
): Promise<(LobbyPlayer & { player: Player })[]> {
  const { data, error } = await supabase
    .from("lobby_players")
    .select("*, player:players!player_id(*)")
    .eq("lobby_id", lobbyId)
    .order("joined_at", { ascending: true });

  if (error) throw new Error(`Failed to get lobby players: ${error.message}`);
  return (data ?? []) as (LobbyPlayer & { player: Player })[];
}

/**
 * Hire a mercenary bot into the lobby. Bot buy-in matches the lobby's buy-in.
 */
export async function hireMercenaryBot(
  lobbyId: string,
  hiredByPlayerId: string,
  strategy: BotStrategy
): Promise<{ bot: Player; lobbyPlayer: LobbyPlayer }> {
  // Check lobby isn't full
  const { count } = await supabase
    .from("lobby_players")
    .select("*", { count: "exact", head: true })
    .eq("lobby_id", lobbyId);

  if ((count ?? 0) >= MAX_LOBBY_SIZE) {
    throw new Error("Lobby is full — no room for a bot");
  }

  // Get lobby buy-in
  const { data: lobby } = await supabase
    .from("lobbies")
    .select("buy_in")
    .eq("id", lobbyId)
    .single();

  const buyIn = lobby?.buy_in ?? MIN_BUY_IN;

  // Check human has enough balance for the bot's buy-in
  const { data: human, error: humanErr } = await supabase
    .from("players")
    .select("game_token_balance")
    .eq("id", hiredByPlayerId)
    .single();

  if (humanErr || !human) throw new Error("Could not find hiring player");
  if (human.game_token_balance < buyIn) {
    throw new Error(
      `Insufficient balance. Need $${buyIn.toLocaleString()} to hire a bot`
    );
  }

  // Deduct from human
  const { error: deductErr } = await supabase
    .from("players")
    .update({ game_token_balance: human.game_token_balance - buyIn })
    .eq("id", hiredByPlayerId);

  if (deductErr)
    throw new Error(`Failed to deduct hire cost: ${deductErr.message}`);

  // Create bot player with the lobby's buy-in as their balance
  const botName = randomBotName(strategy);
  const { data: bot, error: botErr } = await supabase
    .from("players")
    .insert({
      username: botName,
      game_token_balance: buyIn,
      is_bot: true,
      bot_strategy: strategy,
    })
    .select()
    .single();

  if (botErr) throw new Error(`Failed to create bot: ${botErr.message}`);

  // Add bot to lobby
  const { data: lp, error: lpErr } = await supabase
    .from("lobby_players")
    .insert({
      lobby_id: lobbyId,
      player_id: bot.id,
      hired_by: hiredByPlayerId,
    })
    .select()
    .single();

  if (lpErr) throw new Error(`Failed to add bot to lobby: ${lpErr.message}`);

  console.log(
    `[Lobby] Bot ${botName} (${strategy}) hired for $${buyIn} by ${hiredByPlayerId}`
  );

  await checkAndLockLobby(lobbyId);
  return { bot: bot as Player, lobbyPlayer: lp as LobbyPlayer };
}

/**
 * Start the game for a lobby. Transitions to `in_progress` and sets `started_at`.
 * Accepts lobbies in either `waiting` or `locked` status.
 */
export async function startLobby(lobbyId: string, playerId: string): Promise<Lobby> {
  // Verify the caller is the lobby owner
  const { data: lobbyCheck } = await supabase
    .from("lobbies")
    .select("owner_id")
    .eq("id", lobbyId)
    .single();

  if (lobbyCheck?.owner_id !== playerId) {
    throw new Error("Only the lobby owner can start the game");
  }

  const { count } = await supabase
    .from("lobby_players")
    .select("*", { count: "exact", head: true })
    .eq("lobby_id", lobbyId);

  if ((count ?? 0) < MIN_LOBBY_SIZE) {
    throw new Error(
      `Need at least ${MIN_LOBBY_SIZE} players to start (currently ${count ?? 0})`
    );
  }

  const { data, error } = await supabase
    .from("lobbies")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .eq("id", lobbyId)
    .in("status", ["waiting", "locked"])
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to start lobby: ${error?.message ?? "Lobby not found or already started"}`);
  }

  console.log(
    `[Lobby] Lobby ${lobbyId} started IN_PROGRESS with ${count} players`
  );
  return data as Lobby;
}

/**
 * End the game for a lobby. Sets status to `completed` and `ended_at`.
 */
export async function endGame(lobbyId: string): Promise<Lobby> {
  const { data, error } = await supabase
    .from("lobbies")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
    })
    .eq("id", lobbyId)
    .eq("status", "in_progress")
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to end game: ${error?.message ?? "Lobby not in progress"}`);
  }

  console.log(`[Lobby] Lobby ${lobbyId} COMPLETED`);
  return data as Lobby;
}

/**
 * Update a player's final balance in the lobby (called at game end).
 */
export async function updatePlayerFinalBalance(
  lobbyId: string,
  playerId: string,
  finalBalance: number
): Promise<void> {
  const { error } = await supabase
    .from("lobby_players")
    .update({ final_balance: finalBalance })
    .eq("lobby_id", lobbyId)
    .eq("player_id", playerId);

  if (error) {
    console.error(
      `[Lobby] Failed to update final balance for ${playerId}:`,
      error.message
    );
  }
}

/**
 * If a lobby hits max capacity (5), auto-lock it.
 */
async function checkAndLockLobby(lobbyId: string): Promise<boolean> {
  const { count } = await supabase
    .from("lobby_players")
    .select("*", { count: "exact", head: true })
    .eq("lobby_id", lobbyId);

  if ((count ?? 0) >= MAX_LOBBY_SIZE) {
    const { error } = await supabase
      .from("lobbies")
      .update({ status: "locked" })
      .eq("id", lobbyId);

    if (!error) {
      console.log(
        `[Lobby] Lobby ${lobbyId} auto-LOCKED (${count}/${MAX_LOBBY_SIZE})`
      );
      return true;
    }
  }
  return false;
}

/**
 * Get a lobby by ID.
 */
export async function getLobby(lobbyId: string): Promise<Lobby | null> {
  const { data, error } = await supabase
    .from("lobbies")
    .select("*")
    .eq("id", lobbyId)
    .single();

  if (error || !data) return null;
  return data as Lobby;
}
