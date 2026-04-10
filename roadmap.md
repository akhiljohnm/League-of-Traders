# 🗺️ Project Roadmap: League of Traders

**Deadline:** April 17, 2026
**Goal:** Deploy a functional, real-time PvE multiplayer trading game using the Deriv API, backed by comprehensive AI "vibe-coding" documentation.

---

## Phase 1: Project Scaffolding & Setup 🏗️
*Goal: Get the foundation built and instantly deployed.*
- [x] Initialize Next.js project (TypeScript, Tailwind CSS, App Router).
- [x] Create a Supabase project and secure the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [x] Register an application on the Deriv API Hub to generate the `app_id`.
- [x] Setup `.env.local` for local development.
- [x] Push initial commit to GitHub and deploy to Vercel.

## Phase 2: The Database Ledger (Supabase Schema) 🗄️
*Goal: Build the custom backend to manage virtual funds and multiplayer lobbies.*
- [x] Create `players` table (id, username, game_token_balance, is_bot).
- [x] Create `lobbies` table (id, status, started_at).
- [x] Create `lobby_players` join table (to track the 5 players/bots per lobby).
- [x] Create `trades` table (id, player_id, lobby_id, direction, stake, entry_price, exit_price, status).

## Phase 3: The Price Oracle (Deriv API Integration) 📈
*Goal: Connect to Deriv's WebSockets to stream live market data.*
- [x] Write a custom React Hook (`useDerivTicker`) to manage the WebSocket connection.
- [x] Subscribe to a continuous index tick stream (e.g., Volatility 100 Index).
- [x] Build a basic frontend component to verify the live price stream is updating in real-time.

## Phase 4: Player Onboarding & Matchmaking 🤝
*Goal: Allow users to "login" and automatically group into 5-player lobbies.*
- [x] Build a lightweight login/username creation screen.
- [x] Grant new users exactly $10,000 Game Tokens upon creation.
- [x] Build the Lobby UI ("Waiting for players...").
- [x] Implement Supabase Realtime subscriptions to update the lobby UI instantly.
- [x] **NEW:** Add "Hire Mercenary Bot" button. User pays variable buy-in fee (min $100) to fill an empty lobby slot with an AI bot.

## Phase 5: The Game Loop & Paper Trading Engine ⚔️
*Goal: The core gameplay where humans make trades against the live Deriv Oracle.*
- [x] Implement a synchronized 5-minute global game timer.
- [x] Build the Trading UI (Live chart, current balance, UP/DOWN buttons).
- [x] Write the function to log human trades in the `trades` database using the live Deriv price.
- [x] Write the auto-resolution logic (e.g., evaluating if a trade won/lost after 10 ticks).

## Phase 6: Autonomous AI Bots (The Karpathy Protocol) 🤖
*Goal: One AutoResearch-optimized brain, three runtime personalities.*

**Architecture: "One Brain, Three Personalities"**
The AutoResearch loop (`research/strategy.ts`) optimizes a single core signal engine. The three bot personalities are thin wrappers that differ only in *how* they act on the brain’s signal — not *what* signal they compute.

- [x] Build the **AutoResearch Brain** (`src/lib/bots/brain.ts`) — shared signal engine ported from `research/strategy.ts`. Computes a composite signal (-1 to +1) by blending EMA crossover, Bollinger Bands, and micro-momentum.
- [x] Define Bot 1: **"The Trend Follower"** — LOW RISK personality. Only trades on strong signals (|composite| >= 0.4), conservative 6% stakes, 8-tick cooldown. Patient and selective.
- [x] Define Bot 2: **"The Mean Reverter"** — MEDIUM RISK personality. Only trades when Bollinger Band reversion signal fires (overbought/oversold), contrarian direction, 10% stakes, 6-tick cooldown.
- [x] Define Bot 3: **"The High-Frequency Gambler"** — HIGH RISK personality. Trades on any signal (|composite| >= 0.05), micro-stakes at 4%, every 4 ticks. Maximum volume, maximum variance.
- [x] Use Andrej Karpathy’s `auto-research` framework to optimize the shared brain’s hyperparameters across 5 volatility markets. All three personalities improve when the brain improves.
- [x] Write the BotEngine class that processes live ticks, feeds them to bot strategies, executes trades to the `trades` table, and auto-resolves after 5 ticks with 1.954x payout multiplier.
- [x] Make bot strategies game-aware: quota urgency (force trades to avoid inactive forfeit), role-aware staking (rescue=aggressive, alpha=conservative), late-game caution.

**Research Environment** (`research/`):
- [x] Multi-market tick data collection (all 5 Deriv volatility indices simultaneously).
- [x] Deterministic backtest engine with Karpathy’s `---` output format.
- [x] Live WebSocket validation (`--live` flag) for overfitting detection.
- [x] `program.md` agent instructions matching Karpathy’s exact autoresearch conventions.
- [x] `analysis.ipynb` for visualizing experiment results (score trajectory, best progression).
- [x] Baseline avg_score: **9.69** across 7 datasets (101 trades).

## Phase 7: The 80/20 Payout Math (The Core Engine) 🧠
*Goal: Execute the profit contribution game theory when the timer ends.*
- [x] Lock the game UI when the timer hits 00:00.
- [x] Fetch the final balances of all 5 entities (humans + bots).
- [x] Execute the 80/20 Math: Deduct the 20% Safety Net tax from Alphas (winners).
- [x] Distribute Bailouts to Rescues (losers, including busted bots).
- [x] Route the final Net Profit of hired bots back to the human who paid their buy-in.
- [x] Update all final balances in the Supabase database.

## Phase 8: Post-Game Leaderboard & Polish ✨
*Goal: Provide a satisfying UX conclusion and finalize deliverables.*
- [x] Build the Post-Game Leaderboard UI to visualize the 80/20 payout breakdown.
- [x] Highlight if an AI Bot carried the team or needed rescuing.
- [x] Complete the "Vibe-Coding Docs" detailing prompt history, the Karpathy auto-research logs, and AI troubleshooting.
- [x] Final verification of the live Vercel deployment for the judges.