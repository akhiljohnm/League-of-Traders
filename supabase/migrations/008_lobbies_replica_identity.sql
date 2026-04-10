-- Enable REPLICA IDENTITY FULL on lobbies table so Supabase Realtime
-- reliably delivers filtered UPDATE events (needed for game start navigation).
ALTER TABLE lobbies REPLICA IDENTITY FULL;
