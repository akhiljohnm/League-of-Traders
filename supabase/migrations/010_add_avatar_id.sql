-- Add avatar_id to players table.
-- Human players get a randomly assigned avatar (1-30) stored here.
-- Bots always stay NULL and use the robot icon instead.
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_id integer DEFAULT NULL;
