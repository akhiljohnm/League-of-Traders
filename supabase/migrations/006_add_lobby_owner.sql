-- ============================================================
-- Add owner_id to lobbies table
-- The first player to join a lobby becomes the owner.
-- Only the owner can start the game.
-- ============================================================

ALTER TABLE lobbies
  ADD COLUMN owner_id UUID REFERENCES players(id);
