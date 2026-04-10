// ============================================================
// Database Types - Matches Supabase schema exactly
// ============================================================

export type LobbyStatus = "waiting" | "locked" | "in_progress" | "completed";
export type TradeDirection = "UP" | "DOWN";
export type TradeStatus = "open" | "won" | "lost";
export type BotStrategy =
  | "trend_follower"
  | "mean_reverter"
  | "high_freq_gambler";

// ---- Row Types ----

export interface Player {
  id: string;
  username: string;
  game_token_balance: number;
  is_bot: boolean;
  bot_strategy: BotStrategy | null;
  created_at: string;
}

export interface Lobby {
  id: string;
  status: LobbyStatus;
  buy_in: number;
  symbol: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface LobbyPlayer {
  id: string;
  lobby_id: string;
  player_id: string;
  joined_at: string;
  final_balance: number | null;
  hired_by: string | null;
}

export interface Trade {
  id: string;
  player_id: string;
  lobby_id: string;
  direction: TradeDirection;
  stake: number;
  entry_price: number;
  exit_price: number | null;
  payout: number | null;
  status: TradeStatus;
  created_at: string;
  resolved_at: string | null;
}

// ---- Insert Types (omit server-generated fields) ----

export type PlayerInsert = Pick<Player, "username"> &
  Partial<Pick<Player, "is_bot" | "bot_strategy" | "game_token_balance">>;

export type TradeInsert = Pick<
  Trade,
  "player_id" | "lobby_id" | "direction" | "stake" | "entry_price"
>;

// ---- Joined / Enriched Types (for UI) ----

export interface LobbyPlayerWithDetails extends LobbyPlayer {
  player: Player;
}

export interface TradeWithPlayer extends Trade {
  player: Player;
}
