-- Add variable buy-in amount to lobbies (minimum $100)
ALTER TABLE lobbies ADD COLUMN buy_in NUMERIC(10, 2) NOT NULL DEFAULT 100.00;
