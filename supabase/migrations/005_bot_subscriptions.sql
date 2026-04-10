-- ============================================================
-- Bot Subscriptions — $200/month recurring revenue per bot type
-- ============================================================
-- Players must subscribe to a bot strategy ($200/month from
-- game_token_balance) before they can hire that bot in lobbies.
-- Lazy renewal: checked on access, not via cron.

CREATE TABLE bot_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  bot_strategy TEXT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, bot_strategy)
);

-- Enable RLS
ALTER TABLE bot_subscriptions ENABLE ROW LEVEL SECURITY;

-- Open policy (matches existing tables — no Deriv OAuth, anon key only)
CREATE POLICY "Allow all access to bot_subscriptions"
  ON bot_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Realtime for live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE bot_subscriptions;
