-- ============================================================
-- League of Traders: Initial Database Schema
-- Phase 2 - The Database Ledger
-- ============================================================

-- Uses built-in gen_random_uuid() (Postgres 13+)

-- ============================================================
-- 1. PLAYERS TABLE
-- Tracks every human or bot entity in the game.
-- ============================================================
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  game_token_balance NUMERIC(10, 2) NOT NULL DEFAULT 10000.00,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  bot_strategy TEXT, -- 'trend_follower' | 'mean_reverter' | 'high_freq_gambler' | NULL for humans
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick username lookups
CREATE INDEX idx_players_username ON players(username);

-- ============================================================
-- 2. LOBBIES TABLE
-- Each lobby holds up to 5 entities for a single game round.
-- ============================================================
CREATE TYPE lobby_status AS ENUM ('waiting', 'locked', 'in_progress', 'completed');

CREATE TABLE lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status lobby_status NOT NULL DEFAULT 'waiting',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding open lobbies quickly
CREATE INDEX idx_lobbies_status ON lobbies(status);

-- ============================================================
-- 3. LOBBY_PLAYERS JOIN TABLE
-- Links players (humans + bots) to a specific lobby.
-- Max 5 per lobby enforced at application level.
-- ============================================================
CREATE TABLE lobby_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  final_balance NUMERIC(10, 2), -- set at game end after 80/20 payout
  hired_by UUID REFERENCES players(id), -- if this is a bot, who hired it

  UNIQUE(lobby_id, player_id)
);

CREATE INDEX idx_lobby_players_lobby ON lobby_players(lobby_id);
CREATE INDEX idx_lobby_players_player ON lobby_players(player_id);

-- ============================================================
-- 4. TRADES TABLE
-- Every trade placed during a game round (paper trades).
-- ============================================================
CREATE TYPE trade_direction AS ENUM ('UP', 'DOWN');
CREATE TYPE trade_status AS ENUM ('open', 'won', 'lost');

CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  direction trade_direction NOT NULL,
  stake NUMERIC(10, 2) NOT NULL,
  entry_price NUMERIC(12, 4) NOT NULL,
  exit_price NUMERIC(12, 4),
  payout NUMERIC(10, 2), -- net gain/loss after resolution
  status trade_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_trades_player ON trades(player_id);
CREATE INDEX idx_trades_lobby ON trades(lobby_id);
CREATE INDEX idx_trades_status ON trades(status);

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- Enable RLS on all tables. Since we use anon key without
-- Deriv OAuth, we allow broad read/write for now and
-- tighten as needed.
-- ============================================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (anon key, no auth)
CREATE POLICY "Allow all access to players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to lobbies" ON lobbies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to lobby_players" ON lobby_players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to trades" ON trades FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. REALTIME
-- Enable Supabase Realtime on tables that need live updates.
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE lobby_players;
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
