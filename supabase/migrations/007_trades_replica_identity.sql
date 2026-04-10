-- Enable REPLICA IDENTITY FULL on trades table so Supabase Realtime
-- sends the complete row on UPDATE events (needed for live leaderboard).
ALTER TABLE trades REPLICA IDENTITY FULL;
