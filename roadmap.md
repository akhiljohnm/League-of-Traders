# 🗺️ Project Roadmap: League of Traders

**Deadline:** April 17, 2026
**Goal:** Deploy a functional, real-time PvE multiplayer trading game using the Deriv API, backed by comprehensive AI "vibe-coding" documentation.

---

## Phase 1: Project Scaffolding & Setup 🏗️
*Goal: Get the foundation built and instantly deployed.*
- [ ] Initialize Next.js project (TypeScript, Tailwind CSS, App Router).
- [ ] Create a Supabase project and secure the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Register an application on the Deriv API Hub to generate the `app_id`.
- [ ] Setup `.env.local` for local development.
- [ ] Push initial commit to GitHub and deploy to Vercel.

## Phase 2: The Database Ledger (Supabase Schema) 🗄️
*Goal: Build the custom backend to manage virtual funds and multiplayer lobbies.*
- [ ] Create `players` table (id, username, game_token_balance, is_bot).
- [ ] Create `lobbies` table (id, status, started_at).
- [ ] Create `lobby_players` join table (to track the 5 players/bots per lobby).
- [ ] Create `trades` table (id, player_id, lobby_id, direction, stake, entry_price, exit_price, status).

## Phase 3: The Price Oracle (Deriv API Integration) 📈
*Goal: Connect to Deriv's WebSockets to stream live market data.*
- [ ] Write a custom React Hook (`useDerivTicker`) to manage the WebSocket connection.
- [ ] Subscribe to a continuous index tick stream (e.g., Volatility 100 Index).
- [ ] Build a basic frontend component to verify the live price stream is updating in real-time.

## Phase 4: Player Onboarding & Matchmaking 🤝
*Goal: Allow users to "login" and automatically group into 5-player lobbies.*
- [ ] Build a lightweight login/username creation screen.
- [ ] Grant new users exactly $500 Game Tokens upon creation.
- [ ] Build the Lobby UI ("Waiting for players...").
- [ ] Implement Supabase Realtime subscriptions to update the lobby UI instantly.
- [ ] **NEW:** Add "Hire Mercenary Bot" button. User pays a $500 virtual buy-in fee to fill an empty lobby slot with an AI bot.

## Phase 5: The Game Loop & Paper Trading Engine ⚔️
*Goal: The core gameplay where humans make trades against the live Deriv Oracle.*
- [ ] Implement a synchronized 5-minute global game timer.
- [ ] Build the Trading UI (Live chart, current balance, UP/DOWN buttons).
- [ ] Write the function to log human trades in the `trades` database using the live Deriv price.
- [ ] Write the auto-resolution logic (e.g., evaluating if a trade won/lost after 10 ticks).

## Phase 6: Autonomous AI Bots (The Karpathy Protocol) 🤖
*Goal: Implement 3 distinct bot trading strategies refined by AI auto-research.*
- [ ] Define Bot 1: **"The Trend Follower"** (Uses moving average logic; trades cautiously).
- [ ] Define Bot 2: **"The Mean Reverter"** (Bets on reversals when prices spike; medium risk).
- [ ] Define Bot 3: **"The High-Frequency Gambler"** (Rapid-fire, low-stake trades; highly volatile).
- [ ] Use Andrej Karpathy’s `auto-research` framework to simulate historical Deriv tick data and fine-tune the hyper-parameters for these 3 strategies.
- [ ] Write the Next.js backend Cron/Interval job that allows the hired bots to automatically push trades into the `trades` table during the 5-minute game loop alongside the human player.

## Phase 7: The 80/20 Payout Math (The Core Engine) 🧠
*Goal: Execute the profit contribution game theory when the timer ends.*
- [ ] Lock the game UI when the timer hits 00:00.
- [ ] Fetch the final balances of all 5 entities (humans + bots).
- [ ] Execute the 80/20 Math: Deduct the 20% Safety Net tax from Alphas (winners).
- [ ] Distribute Bailouts to Rescues (losers, including busted bots).
- [ ] Route the final Net Profit of hired bots back to the human who paid their buy-in.
- [ ] Update all final balances in the Supabase database.

## Phase 8: Post-Game Leaderboard & Polish ✨
*Goal: Provide a satisfying UX conclusion and finalize deliverables.*
- [ ] Build the Post-Game Leaderboard UI to visualize the 80/20 payout breakdown.
- [ ] Highlight if an AI Bot carried the team or needed rescuing.
- [ ] Complete the "Vibe-Coding Docs" detailing prompt history, the Karpathy auto-research logs, and AI troubleshooting.
- [ ] Final verification of the live Vercel deployment for the judges.