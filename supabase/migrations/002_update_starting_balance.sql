-- Update starting balance from $500 to $10,000
ALTER TABLE players ALTER COLUMN game_token_balance SET DEFAULT 10000.00;
