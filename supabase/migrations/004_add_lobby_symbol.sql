-- Add market symbol to lobbies so players are matched by instrument
ALTER TABLE lobbies ADD COLUMN symbol TEXT NOT NULL DEFAULT '1HZ100V';

-- Index for matchmaking queries (status + buy_in + symbol)
CREATE INDEX idx_lobbies_matchmaking ON lobbies(status, buy_in, symbol);
