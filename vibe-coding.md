# Vibe-Coding Documentation: League of Traders

A comprehensive log of AI-assisted development for the Deriv API Grand Prix 2026.

---

## Phase 1: Project Scaffolding & Setup

### Entry 1: Manual Next.js Initialization in Existing Repo

* **Prompt/Problem:** We needed to initialize a Next.js project inside an existing git repo named "League of Traders." Running `create-next-app .` failed because the directory name contains spaces and capital letters, which violates npm naming restrictions.
* **AI Architecture/Solution:** Instead of fighting the CLI tool, we bypassed `create-next-app` entirely and manually scaffolded the project — `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` — giving us full control over every config value. This was actually faster than running the CLI and deleting the boilerplate it generates.
* **Technical Execution:** Created `package.json` with name `league-of-traders`, installed `next@latest`, `react@latest`, `tailwindcss@4`, `@supabase/supabase-js`, and all TypeScript tooling via `npm install`. Configured Tailwind v4 via `@tailwindcss/postcss` plugin. First `next build` passed with zero errors.

### Entry 2: Cyber-Terminal Dark Theme System

* **Prompt/Problem:** The design spec calls for an "elite, high-frequency e-sports trading terminal" aesthetic with strict dark mode, specific brand colors, and monospace fonts for all numerical data.
* **AI Architecture/Solution:** Built a comprehensive CSS theme layer using Tailwind v4's `@theme` directive to define semantic color tokens (`bg-primary`, `alpha-green`, `rekt-crimson`, `safety-cyan`) and font variables. Added utility classes for glow effects (`glow-green`, `glow-red`, `glow-cyan`) and a live-pulse animation for real-time data indicators. Used Google Fonts (`Inter` + `JetBrains Mono`) loaded via `next/font/google` for zero layout shift.
* **Technical Execution:** `globals.css` defines the full theme via `@theme {}` block. `layout.tsx` loads both font families as CSS variables. Landing page uses the theme tokens directly in Tailwind classes (`bg-bg-primary`, `text-safety-cyan`, `font-mono-numbers`). The `.font-mono-numbers` class applies `font-variant-numeric: tabular-nums` to prevent price/timer jitter.

---

## Phase 2: The Database Ledger (Supabase Schema)

### Entry 3: Supabase Schema Design & Migration

* **Prompt/Problem:** We needed to design a complete database schema to support multiplayer lobbies, player balances, paper trades, and bot mechanics — all with real-time capabilities for the live game UI.
* **AI Architecture/Solution:** Designed a 4-table relational schema: `players` (humans + bots with a `bot_strategy` field), `lobbies` (with an enum status lifecycle: waiting → locked → in_progress → completed), `lobby_players` (join table with `hired_by` to track which human hired which bot, plus `final_balance` for post-game payouts), and `trades` (with enum direction UP/DOWN and status open/won/lost). Enabled RLS with open policies (no Deriv OAuth, anon key only). Added Supabase Realtime publication on `lobbies`, `lobby_players`, and `trades` for live multiplayer sync.
* **Technical Execution:** SQL migration at `supabase/migrations/001_initial_schema.sql`. Pushed via `supabase db push`. TypeScript types at `src/lib/types/database.ts` with row types, insert types, and joined types for UI queries.

### Entry 4: uuid_generate_v4() Bug on Supabase

* **Prompt/Problem:** First `supabase db push` failed with `ERROR: function uuid_generate_v4() does not exist (SQLSTATE 42883)` even though `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` ran without error. The extension existed but its functions weren't accessible in the `public` schema.
* **AI Architecture/Solution:** Supabase installs `uuid-ossp` in the `extensions` schema by default, not `public`. Rather than adding schema qualifiers or search_path hacks, we switched all UUID defaults to PostgreSQL's built-in `gen_random_uuid()` (available since Postgres 13, which Supabase uses). This is actually the modern best practice — no extension dependency at all.
* **Technical Execution:** Replaced all `uuid_generate_v4()` calls with `gen_random_uuid()` in the migration SQL, removed the `CREATE EXTENSION` line. Re-ran `supabase db push` — all 4 tables created successfully. Verified via Supabase JS client: `players: OK`, `lobbies: OK`, `lobby_players: OK`, `trades: OK`.

---

## Landing Page: Full Marketing Website

### Entry 5: Multi-Section Landing Page with Cyber-Terminal Aesthetic

* **Prompt/Problem:** The initial `page.tsx` was a simple centered card. We needed a proper marketing website that explains the League of Traders concept to first-time visitors — the gameplay loop, the 80/20 payout engine, and the AI Mercenary Bots — with a prominent "Join the League" CTA.
* **AI Architecture/Solution:** Designed a 5-section scroll-through landing page: (1) Hero with animated grid background, gradient text, and glowing CTA, (2) "How It Works" 3-step card flow, (3) The 80/20 Engine payout breakdown with Alpha vs Rescued cards, (4) Mercenary Bots showcase with risk-level tags, (5) Footer CTA with game stats. Built entirely with Tailwind utility classes + custom CSS animations — zero JavaScript state, zero dependencies added. Every section uses the existing Cyber-Terminal theme tokens.
* **Technical Execution:** Extended `globals.css` with hero grid background (`hero-grid`, `hero-radial`), glowing button effect (`btn-glow` with box-shadow), fade-up entrance animation (`animate-fade-up` with stagger delays), gradient text (`text-gradient-cyan`), and card hover lift (`card-hover`). Rewrote `page.tsx` with 5 component functions (`StepCard`, `PayoutCard`, `BotCard`, `Stat`) — all typed with TypeScript interfaces. Production build passes clean.

### Entry 6: Sticky Navbar with Scroll-Tracking + Vibe-Coding Showcase Section

* **Prompt/Problem:** The landing page needed a navigation system — a sticky top nav with tabs highlighting the different sections, including a dedicated Vibe-Coding section to showcase the AI-assisted development log for the judges.
* **AI Architecture/Solution:** Built a `Navbar` client component with glassmorphism effect (`backdrop-blur + rgba background`), `IntersectionObserver`-based active section tracking, and a mobile hamburger menu. Added `id` attributes to every section (`#home`, `#how-it-works`, `#engine`, `#bots`, `#vibe-coding`, `#join`). Created a Vibe-Coding section with a vertical timeline layout — each entry shows Phase badge, Problem (red), Solution (green), and Tech (cyan) in a card format with connector dots and gradient lines. The section links back to the full `vibe-coding.md` file.
* **Technical Execution:** `src/components/Navbar.tsx` — client component with `useEffect` for `IntersectionObserver` (rootMargin `-40% 0px -55% 0px` for center-of-viewport detection) and scroll-based background opacity. CSS additions: `.nav-glass` for glassmorphism, `scroll-padding-top: 5rem` for fixed nav offset, `.timeline-line` for vertical connector. `VibeEntry` component renders the timeline cards. All smooth-scroll handled via CSS `scroll-behavior: smooth` + JS `scrollIntoView`.

### Entry 7: Vibe-Coding Extracted to Dedicated Route

* **Prompt/Problem:** The Vibe-Coding timeline section was cluttering the homepage. User wanted it as its own page to keep the landing page focused on selling the concept.
* **AI Architecture/Solution:** Moved the Vibe-Coding content to a new Next.js route at `/vibe-coding`. Updated the `Navbar` to support hybrid navigation — anchor scroll links for homepage sections (`#home`, `#how-it-works`, etc.) and a Next.js `Link` for the Vibe-Coding route. Added `usePathname()` to detect which page we're on so the Navbar knows when to use `IntersectionObserver` (homepage only) vs route-based active state (`/vibe-coding` page). The Vibe-Coding page got its own `metadata`, breadcrumb, stats bar, numbered timeline entries, and a footer CTA back to home.
* **Technical Execution:** `src/app/vibe-coding/page.tsx` — new route with `ENTRIES` data array, `VibeEntry` component with numbered timeline dots. Navbar updated with `NavItem` interface adding `isRoute` flag. Homepage sections now use `/#section` hrefs when navigating from other pages. Build output confirms both routes: `○ /` and `○ /vibe-coding`.

---

## Phase 3: The Price Oracle (Deriv API V2 Integration)

### Entry 8: Correcting from V3 to V2 API via llms.md

* **Prompt/Problem:** Initial research pointed to the old Deriv WebSocket v3 API (`wss://ws.derivws.com/websockets/v3?app_id=XXX`). The user flagged we must follow `llms.md` which documents the **Deriv API V2** — a completely different URL structure, symbol naming, and no app_id requirement for public data.
* **AI Architecture/Solution:** Audited `llms.md` thoroughly. Key corrections: (1) Public WebSocket URL is `wss://api.derivws.com/trading/v1/options/ws/public` — no auth or app_id needed for tick data. (2) Volatility 100 Index symbol is `1HZ100V`, not `R_100`. (3) The `forget_all` parameter takes an array of strings, not a plain string. (4) Best practices mandate pinging every 30s, using `req_id` on all requests, and max 100 subscriptions per connection.
* **Technical Execution:** Updated `NEXT_PUBLIC_DERIV_WS_URL` in `.env.local`. Built all TypeScript types in `src/lib/types/deriv.ts` matching the exact V2 response shapes from `llms.md`.

### Entry 9: useDerivTicker Hook — Production-Grade WebSocket Manager

* **Prompt/Problem:** Need a React hook that manages the full WebSocket lifecycle: connect, subscribe, receive ticks, ping keepalive, handle errors, reconnect on disconnect, and clean up on unmount.
* **AI Architecture/Solution:** Built `useDerivTicker` as a self-contained client hook. On mount: opens WebSocket → subscribes to ticks with `req_id` → starts 25s ping interval. On each tick: updates `currentTick` and shifts previous tick for direction calculation. On disconnect: exponential backoff reconnect (1s → 2s → 4s → ... → 30s cap). On unmount: sends `forget_all: ["ticks"]` before closing to cleanly unsubscribe per Deriv best practices. Stores `subscription.id` from first tick response for potential per-stream `forget` calls.
* **Technical Execution:** `src/hooks/useDerivTicker.ts` — returns `{ currentTick, previousTick, isConnected, connectionState, error, tickCount }`. `LiveTicker` component at `src/components/LiveTicker.tsx` consumes the hook — shows live quote with green/red glow on direction change, ask/bid spread, tick counter, and connection status indicator. Embedded in the homepage hero section.

---

## Phase 4: Player Onboarding & Matchmaking

### Entry 10: Variable Buy-in Lobby System

* **Prompt/Problem:** The original design had a flat $10,000 buy-in per game. The user clarified that players start with $10,000 but the buy-in per game should be variable (minimum $100). This changes matchmaking — players should be grouped with others at the same stake level.
* **AI Architecture/Solution:** Added a `buy_in` column to the `lobbies` table (migration 003). Rewrote `findOrCreateLobby(buyIn)` to match players to waiting lobbies with the same buy-in amount. Bot hire cost now dynamically equals the lobby's buy-in, not a flat fee. The `joinLobby` function deducts the variable buy-in from the player's persistent balance. This creates a tiered matchmaking system — $100 beginners play together, $10,000 high rollers play together.
* **Technical Execution:** `supabase/migrations/003_add_lobby_buyin.sql` adds `buy_in NUMERIC(10,2) NOT NULL DEFAULT 100.00`. `src/lib/actions/lobby.ts` contains `findOrCreateLobby()`, `joinLobby()` (with balance deduction), `hireMercenaryBot()` (deducts lobby buy-in from hiring player), and `checkAndLockLobby()` (auto-locks at 5 players). All functions include descriptive console logs.

### Entry 11: Full Player Flow — Username → Buy-in → Lobby → Real-time Sync

* **Prompt/Problem:** Need the complete multiplayer onboarding flow: enter a username, choose a buy-in tier, get matched to a lobby, see other players join in real-time, and hire AI bots to fill empty slots.
* **AI Architecture/Solution:** Built a 4-phase client page at `/play` with state machine flow: `login` → `buy-in` → `matchmaking` → `lobby`. The `UsernameForm` component handles player creation with validation. The `BuyInSelector` shows 5 tier options ($100–$10,000) and grays out tiers the player can't afford. The `LobbyView` component subscribes to Supabase Realtime on both `lobby_players` (INSERT events) and `lobbies` (UPDATE events for lock detection). Player cards fill in live as others join. A "Hire Mercenary Bot" expandable panel lets you pick from 3 AI strategies. Session persistence via `localStorage` skips the login screen on return visits.
* **Technical Execution:** `src/app/play/page.tsx` orchestrates the flow with `useState<PlayPhase>`. `src/components/UsernameForm.tsx` — input form with character count, validation, loading spinner. `src/components/LobbyView.tsx` — Supabase Realtime channel (`lobby-${id}`) with postgres_changes listeners, player/empty slot cards, bot strategy selector grid, progress bar, balance refresh interval. Homepage "JOIN THE LEAGUE" buttons now use Next.js `<Link href="/play">` for client-side navigation.

### Entry 12: Live Market Selection from Deriv API

* **Prompt/Problem:** The buy-in screen only let players choose a stake amount. We need to let them also pick which market/instrument to trade on, pulled live from the Deriv API. Players should be matched to lobbies by BOTH buy-in AND selected symbol.
* **AI Architecture/Solution:** Used the Deriv `active_symbols` endpoint (no auth required) over the public WebSocket. Built a one-shot `useActiveSymbols` hook that opens a WebSocket, sends `{ "active_symbols": "brief" }`, groups results by `market` → `submarket`, filters out suspended/closed markets, then closes the connection. Added a `symbol` column to the `lobbies` table (migration 004) so matchmaking filters by `buy_in + symbol`. Redesigned the buy-in page into a 2-step MarketSelector: (1) pick a market from collapsible category groups, (2) pick a buy-in tier. A "FIND MATCH" button only activates when both are selected.
* **Technical Execution:** `src/hooks/useActiveSymbols.ts` — one-shot WS with 15s timeout, `groupByMarket()` function sorts by market priority (synthetics first). `supabase/migrations/004_add_lobby_symbol.sql` adds `symbol TEXT NOT NULL DEFAULT '1HZ100V'` + composite matchmaking index. `findOrCreateLobby(buyIn, symbol)` now filters on both fields. `LobbyView` displays the selected market symbol in the lobby header. Types already existed in `deriv.ts` (`DerivActiveSymbol`, `DerivActiveSymbolsMessage`) — zero new types needed.

---

## Phase 6: Autonomous AI Bots (The Karpathy Protocol)

### Entry 13: Bot Strategy Architecture & 3 Trading Brains

* **Prompt/Problem:** Mercenary bots exist in the lobby but have no trading intelligence. Need to implement 3 distinct strategies — Trend Follower (low risk), Mean Reverter (medium risk), High-Frequency Gambler (high risk) — each with tunable hyperparameters for later optimization with Karpathy's auto-research framework.
* **AI Architecture/Solution:** Designed a shared `BotStrategyInstance` interface where each strategy is a **stateful tick processor**: it accumulates price history, maintains indicators (EMAs, Bollinger Bands, momentum counters), and on each tick either returns a `TradeDecision { direction, stake }` or null (hold). All hyperparameters are extracted into typed config objects (`TrendFollowerParams`, `MeanReverterParams`, `HighFreqGamblerParams`) with sensible defaults — ready for auto-research to override. Trade resolution uses a 5-tick duration window with 1.85x payout multiplier.
* **Technical Execution:**
  - **Trend Follower** (`strategies/trend-follower.ts`): Dual EMA (5-tick short, 15-tick long) with crossover detection. Bullish crossover → UP, bearish → DOWN. 6% stake, 8-tick cooldown. Uses `EMA_new = price * k + EMA_old * (1-k)` formula.
  - **Mean Reverter** (`strategies/mean-reverter.ts`): Rolling Bollinger Bands (20-tick window, 2σ multiplier). Price above upper band → DOWN (overbought), below lower band → UP (oversold). 10% stake, 6-tick cooldown. Flat-market detection (σ < 0.01% of mean) prevents noise trades.
  - **High-Freq Gambler** (`strategies/high-freq-gambler.ts`): Trades every 4 ticks regardless. Follows micro-momentum (65% probability of following last tick direction, 35% contrarian). 4% stakes, no cooldown beyond the interval. Maximum trade volume.
  - **BotEngine** (`bots/engine.ts`): Manages all bots in a lobby. `processTick()` feeds ticks to strategies, executes trades to Supabase, and resolves matured trades (5-tick duration). `resolveAllTrades()` force-closes all open positions at game end. Tracks per-bot balance, trade count, and PnL for the post-game scoreboard.
  - **Factory** (`bots/index.ts`): `createStrategy("trend_follower")` → TrendFollower instance.

### Entry 14: Rise/Fall Game Mode — Shared Trade Module

* **Prompt/Problem:** The user clarified that the core trade mechanic is **Rise/Fall** — predict if price goes higher or lower after X ticks, with a 1.954x payout on win (not 1.85x as originally hardcoded). This logic needs to be shared between the human trading UI and the BotEngine, not duplicated.
* **AI Architecture/Solution:** Created a dedicated `src/lib/game/rise-fall.ts` module as the single source of truth for all Rise/Fall trade mechanics. Exports `RISE_FALL_PAYOUT = 1.954`, `placeTrade()` (inserts into Supabase), `resolveTrade()` (determines win/loss, calculates payout, updates DB), and pure helper functions (`didTradeWin`, `calculatePayout`, `calculateNetPnl`) usable in tests without side effects. Refactored `BotEngine` to delegate trade placement and resolution to this shared module instead of inlining Supabase queries. Updated `bots/types.ts` to re-export the new payout constant for backwards compatibility. Updated `CLAUDE.md` and `game-logic.md` with full Rise/Fall documentation including payout formula, tick duration options, and win conditions.
* **Technical Execution:** `src/lib/game/rise-fall.ts` — `placeTrade()` wraps Supabase insert, `resolveTrade()` uses `didTradeWin(direction, entryPrice, exitPrice)` and `stake × 1.954` payout math, updates trade row with `exit_price`, `payout` (net PnL), `status`, and `resolved_at`. `BotEngine.executeTrade()` now calls `placeTrade()` and `BotEngine.resolveMaturedTrades()` calls `resolveTrade()`, crediting `grossPayout` to bot balance. Tick duration options: 1, 3, 5, 10 ticks. Build passes clean.

---

## Phase 5: The Game Loop & Paper Trading Engine

### Entry 15: Full Game Loop — useGameEngine Hook + Trading Cockpit UI

* **Prompt/Problem:** The player flow dead-ended at the lobby screen. Clicking "START GAME" locked the lobby but nothing happened next. We needed to build the entire game experience: a 5-minute trading session where humans place Rise/Fall trades with a configurable tick duration selector (1-10 ticks), bots trade autonomously via BotEngine, and all player balances update live after every trade resolution.
* **AI Architecture/Solution:** Designed a client-side game loop architecture using a `useGameEngine` custom hook as the single orchestrator. The hook manages: (1) Deriv WebSocket tick stream via `useDerivTicker` for the lobby's selected market symbol, (2) a 5-minute countdown timer using `Date.now()` delta to prevent drift, (3) a `BotEngine` instance (held in a ref) that processes ticks and drives all bot strategies, (4) human pending trades with tick-based resolution (mirrors BotEngine's pattern), (5) an optimistic balance system — stake deducted on trade placement, gross payout credited on resolution, no round-trip to DB for balance reads. The `GameView` component renders a full trading cockpit: live price display with directional coloring, tick duration selector (1,2,3,4,5,6,8,10), stake input with percentage quick-buttons showing potential win amount, large UP/DOWN trade buttons with glow effects, active trades panel with progress bars counting down ticks, trade history with win/loss flash animations, and a team leaderboard showing all players ranked by balance in real-time. Modified `startLobby()` to transition directly to `in_progress` (skipping the intermediate `locked` state), added `endGame()` and `updatePlayerFinalBalance()` actions. The `/play` page gained a `"game"` phase with the Navbar hidden for a full-screen trading experience.
* **Technical Execution:**
  - **`src/hooks/useGameEngine.ts`**: Core game hook. `useDerivTicker({ symbol })` for ticks. `useRef<BotEngine>` for bot management. `setPendingTrades` with functional updater to check maturity on each tick. `handleGameEnd` force-resolves all open trades, writes `final_balance` to `lobby_players`, sets lobby to `completed`. Returns `{ currentTick, timeRemainingMs, humanBalance, pendingTrades, tradeHistory, placeHumanTrade, playerBalances, gamePhase }`.
  - **`src/components/GameView.tsx`**: 10 sub-components: `GameHeader` (timer + connection), `PriceDisplay` (quote with glow), `PlayerStatsBar` (balance + PnL), tick selector, stake controls with `RISE_FALL_PAYOUT` preview, `TradeButtons` (UP/DOWN with `btn-glow-green`/`btn-glow-red`), `PendingTradesPanel` (progress bars), `TradeHistoryPanel` (win/loss badges), `TeamLeaderboard` (ranked by balance), `GameOverOverlay` (final standings).
  - **`src/lib/actions/lobby.ts`**: `startLobby()` now uses `.in("status", ["waiting", "locked"])` and sets `status: "in_progress"` + `started_at`. New `endGame()` sets `completed` + `ended_at`. New `updatePlayerFinalBalance()` writes to `lobby_players.final_balance`.
  - **`src/app/play/page.tsx`**: Added `"game"` PlayPhase. `handleGameStart` fetches all players, transitions to game. Navbar hidden in game phase.
  - **`src/app/globals.css`**: Added `btn-glow-green`, `btn-glow-red`, `animate-win-flash`, `animate-loss-flash`, `animate-timer-urgent`.
  - Build passes clean with all 4 routes: `/`, `/_not-found`, `/play`, `/vibe-coding`.

---

## Phase 7: The 80/20 Payout Math (The Core Engine)

### Entry 16: 80/20 Payout Engine — Pure Calculation + Game Integration + Breakdown Overlay

* **Prompt/Problem:** When the 5-minute game timer expired, raw balances were displayed in a simple game-over overlay, but no cooperative payout redistribution happened. The core game theory — the 80/20 Profit Contribution Model — was not implemented. We needed: (1) a pure payout calculation engine, (2) integration into the game loop, and (3) a detailed breakdown overlay showing exactly how the redistribution worked.
* **AI Architecture/Solution:** Built a pure-function payout engine (`calculatePayouts`) with zero side effects, making it fully testable and deterministic. The 5-step algorithm: (1) **Inactive Forfeit** — players with < 5 trades forfeit their entire balance to the Safety Net and receive $0. (2) **Alpha Tax** — winners (balance > buyIn) keep 80% of their profit; the other 20% goes to the Safety Net. (3) **Bailout** — Safety Net is distributed to Rescue players (balance < buyIn), sorted by smallest deficit first so capping works naturally — each Rescue gets an equal share capped at their deficit (buyIn - rawBalance). (4) **Victory Spillover** — any remaining Safety Net after bailout is returned to Alphas proportionally by their profit contribution. (5) **Bot Profit Routing** — hired bots' net profit (finalBalance - buyIn) is transferred to the human who hired them. The overlay visualizes each player's journey: raw balance → role classification → tax/bailout/spillover adjustments → final balance, with color-coded role badges (green=Alpha, red=Rescue, gray=Inactive, cyan=Even).
* **Technical Execution:**
  - **`src/lib/game/payout-engine.ts`**: Pure function `calculatePayouts(inputs: PayoutInput[], buyIn: number): PayoutSummary`. Types: `PayoutInput`, `PayoutResult` (with `role`, `alphaTax`, `bailoutReceived`, `spilloverReceived`, `botProfitRouted`), `PayoutSummary`. Sort-based bailout distribution avoids iterative redistribution complexity. `round2()` helper prevents floating-point drift.
  - **`src/hooks/useGameEngine.ts`**: Added `payoutSummary: PayoutSummary | null` state. In `handleGameEnd`, after force-resolving all trades, builds `PayoutInput[]` from human balance + BotEngine balances + `hired_by` from `LobbyPlayer`, calls `calculatePayouts()`, and uses payout-adjusted `finalBalance` values for the DB writes via `updatePlayerFinalBalance()`.
  - **`src/components/GameView.tsx`**: Replaced simple `GameOverOverlay` with `PayoutBreakdownOverlay`. Shows: Safety Net/Bailout/Spillover summary bar, each player's card with role badge (ALPHA/RESCUE/INACTIVE/EVEN), detailed flow line (Raw → Tax → Bailout → Spillover → Bot Routing → Final), inactive player explanation. Players sorted by final balance. Current player highlighted with cyan ring.
  - Build passes clean. All Phase 7 roadmap items checked off.

### Entry 17: Game-Aware Bot Strategies — Quota Safety + Role-Aware Staking

* **Prompt/Problem:** The three bot strategies (Trend Follower, Mean Reverter, High-Freq Gambler) had zero awareness of the 80/20 payout engine rules. Two critical problems: (1) **Quota Death** — Trend Follower and Mean Reverter are signal-gated and can produce fewer than 5 trades in a 300-tick game, causing the payout engine to classify them as "inactive" and forfeit their entire $10k buy-in to the Safety Net. (2) **Role Blindness** — no strategy adjusted behavior based on whether it was winning (Alpha, taxed 20%) or losing (Rescue, bailed out capped at buyIn).
* **AI Architecture/Solution:** Chose a self-tracking approach with no interface changes — strategies already tracked `totalTicks` internally, so we added `tradesPlaced` self-tracking and imported new game constants (`GAME_TOTAL_TICKS=300`, `MIN_TRADES_QUOTA=5`, `ALPHA_TAX_RATE=0.20`). The `BotStrategyInstance.onTick(tick, balance, buyIn)` interface and BotEngine remained unchanged. Three game-aware behaviors added: (1) **Quota Urgency Gate** — when `tradesNeeded > 0 && ticksRemaining <= tradesNeeded * N` (N=12 for TF, 10 for MR based on their cooldowns), force a trade bypassing signal and cooldown checks, using EMA/mean as directional proxy. (2) **Role-Aware Stake Multiplier** — Rescue (balance < buyIn): 1.5x stake since bailout caps recovery at buyIn anyway; Alpha (balance > buyIn): 0.8x since marginal profit taxed 20%; Late-game Alpha (< 60 ticks left): 0.56x to lock in gains. (3) **HFG Rescue Interval** — High-Freq Gambler reduces trade interval by 1 tick when losing (every 3 ticks instead of 4) for more recovery attempts.
* **Technical Execution:**
  - **`src/lib/bots/types.ts`**: Added `GAME_TOTAL_TICKS`, `MIN_TRADES_QUOTA`, `ALPHA_TAX_RATE` as exported constants alongside existing `TRADE_DURATION_TICKS`.
  - **`src/lib/game/payout-engine.ts`**: Replaced local `MIN_TRADES_QUOTA` and `ALPHA_TAX_RATE` with imports from `types.ts` — single source of truth.
  - **`src/lib/bots/strategies/trend-follower.ts`**: Added `tradesPlaced` tracking, `computeStake()` with role-aware multiplier, quota urgency gate before cooldown check. Direction from EMA relationship on forced trades.
  - **`src/lib/bots/strategies/mean-reverter.ts`**: Same pattern. Quota urgency uses mean reversion logic (price > mean → DOWN). Multiplier 10 (cooldown 6 + buffer 4).
  - **`src/lib/bots/strategies/high-freq-gambler.ts`**: Role-aware staking + rescue interval reduction. No quota gate needed (already ~74 trades/game). Console logs now show role state.
  - Build passes clean. Trend Follower and Mean Reverter can no longer end a game with < 5 trades.

### Entry 18: Auto-Research Framework — Karpathy-Inspired Strategy Optimizer

* **Prompt/Problem:** Bot strategies use hardcoded hyperparameters (EMA windows, Bollinger Band multipliers, stake percentages) chosen by intuition. We needed a systematic way to iterate on these parameters using live market data, inspired by Andrej Karpathy's `autoresearch` framework that lets an LLM agent autonomously optimize ML training code.
* **AI Architecture/Solution:** Adapted the core auto-research pattern: **one mutable file** (`research/strategy.ts` — the strategy the LLM edits), **one immutable evaluator** (`research/backtest-engine.ts` — replays recorded tick data, simulates Rise/Fall trades, computes a composite `score`), and **one instruction prompt** (`research/program.md` — tells the LLM how to iterate). The key insight from Karpathy is that you don't write code anymore — you write Markdown that programs AI agents who write the code for you. The strategy file is a self-contained hybrid that blends EMA crossover, Bollinger Bands, and micro-momentum via weighted signals, with all hyperparameters in a `PARAMS` block at the top. The backtest engine is completely standalone — no Supabase, no Next.js, pure TypeScript math that runs in milliseconds via `tsx`. A tick collector records live Deriv market data to JSON for deterministic replay.
* **Technical Execution:**
  - **`research/types.ts`**: Standalone types (`Tick`, `TickDataset`, `StrategyInstance`, `BacktestResult`) — no `@/` imports, runs outside Next.js.
  - **`research/backtest-engine.ts`**: Immutable evaluator. `runBacktest(ticks, strategy)` → simulates trades with 5-tick duration, 1.954x/1.952x payout, tracks balance/drawdown/Sharpe. Composite `score = pnlNorm*100 + sharpe*20 + winRate*10`. Machine-parseable `printResults()`.
  - **`research/strategy.ts`**: Mutable file. `PARAMS` block with 15 tunable hyperparameters. Hybrid strategy blending 3 signal types with configurable weights. Exports `createStrategy(): StrategyInstance`.
  - **`research/collect-ticks.ts`**: Connects to Deriv V2 public WebSocket, records ticks to `research/data/<symbol>_<timestamp>.json`. Supports configurable symbol and duration. Ctrl+C graceful save.
  - **`research/run-backtest.ts`**: Runner script. Loads all datasets, runs strategy, prints structured output. `grep "^score:"` extracts the metric.
  - **`research/program.md`**: The agent OS. Defines the full experiment loop: branch → commit → run → extract score → keep/discard → repeat. Includes a 5-phase strategy exploration roadmap from hyperparameter sweeps to advanced regime detection.
  - npm scripts: `research:collect`, `research:backtest`, `research:run`.

### Entry 19: Full Karpathy Autoresearch Integration — Multi-Market + Live Data + M2 Mac

* **Prompt/Problem:** The initial research setup was "inspired by" autoresearch but didn't mirror the actual framework's conventions. Three specific gaps: (1) output format didn't match Karpathy's `---` prefix convention, (2) only collected from one market (1HZ100V), allowing overfitting, (3) no live data validation capability. User also required M2 Mac compatibility.
* **AI Architecture/Solution:** Deep-dived into the actual autoresearch repo (program.md, prepare.py, train.py, pyproject.toml) plus both Mac forks (miolini/autoresearch-macos using PyTorch MPS, trevin-creator/autoresearch-mlx using Apple MLX). Key architectural decisions: (1) **Output format** — switched to Karpathy's exact `--- key: value` format making every metric greppable (`grep "^--- avg_score:"`). (2) **Multi-market** — new `collect-all-markets.ts` opens 5 parallel WebSocket connections (one per volatility index) with 1-second staggered connects to avoid rate limits. The `avg_score` across ALL markets becomes the optimization target, preventing overfitting. (3) **Live validation** — two-stage evaluation: Stage 1 (fast, default) runs pre-recorded backtests in milliseconds for the iteration loop; Stage 2 (`--live` flag) connects to the live Deriv market for 5 minutes as periodic spot-check for overfitting. (4) **results.tsv** — matched Karpathy's 5-column format (`commit  avg_score  datasets  status  description`), replacing `memory_gb` with `datasets` (memory irrelevant for TypeScript math; market count is meaningful). (5) **program.md** — complete rewrite mirroring Karpathy's exact section structure: Setup, Experimentation, Output format, Logging results, The experiment loop, NEVER STOP. Added monorepo note from MLX fork (`git add research/strategy.ts` only, never `git add -A`). M2 Mac is inherently compatible — pure TypeScript math, no GPU/CUDA dependency.
* **Technical Execution:**
  - **`research/collect-all-markets.ts`**: Parallel collection from 1HZ100V, 1HZ75V, 1HZ50V, 1HZ25V, 1HZ10V simultaneously. 5 WebSocket connections, staggered 1s apart, shared timer, graceful SIGINT handling. Outputs 5 JSON files per run.
  - **`research/live-evaluator.ts`**: `runLiveEvaluation(symbol, targetTicks)` → connects to Deriv WS, collects ticks, runs same `runBacktest()` engine. 7-minute timeout (Apple Silicon convention from MLX fork). Returns identical `BacktestResult` for direct score comparison.
  - **`research/backtest-engine.ts`**: `printResults()` rewritten to use `--- key: value` format with padded alignment. Greppable with `grep "^--- score:"`.
  - **`research/run-backtest.ts`**: Aggregate output uses `--- avg_score:` as primary metric. `--live` flag triggers Stage 2 live validation after pre-recorded backtest. Compares live vs recorded score, warns if delta < -10 (overfitting indicator).
  - **`research/program.md`**: Full rewrite. Mirrors Karpathy's exact sections. Includes Rise/Fall domain knowledge, multi-market health checks, live validation cadence guidance ("every 5-10 improvements"), and ~120 experiments/hour throughput estimate.
  - **`research/analysis.ipynb`**: Jupyter notebook matching Karpathy's analysis.ipynb. Score trajectory with Cyber-Terminal dark theme (green=keep, red=discard), monotonic best-score frontier, summary statistics, top improvements table.
  - npm scripts: `research:collect-all`, `research:live` added.

### Entry 20: One Brain, Three Personalities — AutoResearch Bot Architecture

* **Prompt/Problem:** We initially assumed autoresearch would optimize all three bot strategies independently (Trend Follower, Mean Reverter, High-Frequency Gambler). But the framework is designed around a single mutable file with a single scalar metric. Running three separate optimization loops would triple the complexity for marginal gains. The question: optimize three strategies independently, or one core strategy with personality wrappers?
* **AI Architecture/Solution:** Chose **"One Brain, Three Personalities"** — the autoresearch loop optimizes a single signal engine (the "brain" in `research/strategy.ts`), and the three bot personalities are thin runtime wrappers that differ only in *how they act on the brain's signal*, not *what signal they compute*. The brain outputs a composite signal from -1 (strong DOWN) to +1 (strong UP) by blending EMA crossover, Bollinger Bands, and micro-momentum. Each personality then applies its own confidence threshold, stake sizing, cooldown, and signal interpretation. This means every time autoresearch improves the brain, ALL three bots improve. The shared `BRAIN_PARAMS` in `src/lib/bots/brain.ts` is synced from `research/strategy.ts` after each optimization run.
* **Technical Execution:**
  - **`src/lib/bots/brain.ts`** (NEW): Shared signal engine. `createBrain()` returns a `BrainInstance` with a `process(tick)` method that outputs `BrainSignal { composite, trend, reversion, momentum, warming }`. PARAMS synced from research optimizer.
  - **`src/lib/bots/strategies/trend-follower.ts`** (REWRITTEN): Wraps brain. Only trades when `|composite| >= 0.4` (high confidence). Conservative 6% stakes, 8-tick cooldown. Patient, selective, follows the blend.
  - **`src/lib/bots/strategies/mean-reverter.ts`** (REWRITTEN): Wraps brain. Only trades when the `reversion` signal fires (Bollinger Band overbought/oversold). Uses the reversion *direction* rather than composite — contrarian by design. 10% stakes, 6-tick cooldown.
  - **`src/lib/bots/strategies/high-freq-gambler.ts`** (REWRITTEN): Wraps brain. Trades on any signal `|composite| >= 0.05`, falls back to momentum, then coin flip. Micro-stakes 4%, every 4 ticks. Maximum volume.
  - All three still implement `BotStrategyInstance` interface — zero changes to `BotEngine`, `index.ts`, or any game code. Drop-in replacement.

