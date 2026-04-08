# 🏗️ Tech Stack & Implementation Blueprint: League of Traders

## 💻 The Tech Stack
To build this rapidly and deploy it reliably, we will use a modern JavaScript/TypeScript stack.

* **Frontend Framework:** **Next.js (React)** * *Why:* Allows us to build both the frontend UI and backend API routes in a single repository. Deploys effortlessly to Vercel.
* **Styling:** **Tailwind CSS**
  * *Why:* Rapid UI development. Perfect for creating a slick, fast-paced trading interface.
* **Database, Auth & Real-time:** **Supabase** (PostgreSQL + Realtime WebSockets)
  * *Why:* Handles anonymous/simple user creation, stores our custom "Game Token" balances, and manages the live multiplayer lobby via real-time subscriptions.
* **Market Data Oracle:** **Deriv API V2 (WebSocket)**
  * *Why:* We will connect to Deriv's WebSocket strictly to stream live market prices (ticks) to resolve our in-game trades. 
* **Deployment:** **Vercel**
  * *Why:* Push to GitHub, and it automatically goes live.



---

## 🔑 Core Requirements
1. **Deriv Application ID:** Register a free app on the Deriv API dashboard to get an `app_id` (needed to open the public WebSocket for market data).
2. **Supabase Project:** A free-tier Supabase project with tables for `users`, `lobbies`, and `trades`.

---

## 🛠️ Feature Implementation Plan

### Step 1: User Initialization & The Bank (Supabase)
* **How it works:** We bypass complex OAuth. When a user opens the app, they just enter a username (or we auto-generate one).
* **Action:** We create a new user record in Supabase and instantly credit them with a starting balance of **$500 Game Tokens**.

### Step 2: The Lobby System (Supabase Realtime)
* **How it works:** Users click "Find Game." They are inserted into a Supabase `lobbies` table.
* **Action:** The Next.js frontend subscribes to this database row. As soon as the lobby hits exactly 5 players, the backend flags the lobby as `status: 'locked'` and triggers the game countdown.

### Step 3: The Game Loop & The Oracle (Deriv API)
* **How it works:** A 5-minute global timer begins. We open a public WebSocket connection to Deriv (`wss://ws.derivws.com/websockets/v3`) and subscribe to a specific market's tick stream (e.g., Volatility 100 Index).
* **Action:** 1. **Live Chart:** The frontend displays the live Deriv prices.
  2. **Placing Trades:** When a user clicks "Buy UP", we DO NOT send this to Deriv. Instead, we log a row in our Supabase `trades` table: `[User ID, Direction: UP, Stake: $50, Entry Price: Current Deriv Tick, Status: Open]`.

### Step 4: Trade Resolution & The 80/20 Payout Logic
* **How it works:** When the 5-minute timer ends, the game stops accepting new trades.
* **Action:**
  1. We grab the *final closing price* from the Deriv API tick stream.
  2. Our Next.js backend evaluates all open trades in Supabase. (e.g., If User bet UP, and Closing Price > Entry Price, they win their stake multiplied by a fixed payout rate).
  3. We calculate the final Net Profit/Loss (PnL) for all 5 users.
  4. **The Algorithm runs:** We apply the 80/20 Profit Contribution logic to the final balances, distributing the Safety Net to the losers and the Alpha Cut to the winners.
  5. **The Display:** We route users to the "Post-Game Leaderboard" to see the final payout breakdown.

### Supabase Integration
* **Keys:**
https://fbkvtzhqanefmdhzykiu.supabase.co
sb_publishable_k5o-vF0vWfr_7ug5MWfNTA_JfT990OR
postgresql://postgres:[DerivDubai123!]@db.fbkvtzhqanefmdhzykiu.supabase.co:5432/postgres
* **CLI setup commands:**
supabase login
supabase init
supabase link --project-ref fbkvtzhqanefmdhzykiu