# 📜 Game Logic: League of Traders (PvE Co-Op)

## 🎯 Game Overview
"League of Traders" is a cooperative, multiplayer trading game built on the Deriv API. Players join a 5-person lobby, pool virtual funds, and trade as a team against the market within a set timeframe. The core objective is to maximize individual profit while contributing to a team safety net that rescues struggling players.

---

## ⚙️ Core Mechanics

### 1. The Lobby & Buy-in
* **Lobby Size:** 5 Players.
* **Buy-in Amount:** $10,000 (Deriv Virtual Funds).
* **Initial Team Pool:** $50,000.
* **Game Duration:** A fixed timeframe (e.g., 5 minutes) or a fixed number of market ticks.

### 2. The "Skin in the Game" Quota (Anti-Leech)
To prevent "free-riding" (players joining and going AFK to farm the safety net), players must meet an **Active Trader Quota**.
* **Rule:** A player must execute a minimum of 5 trades during the game timer to be eligible for *any* payouts or bailouts.
* **Penalty:** If the quota is not met, their ending balance is forfeited to the Safety Net Fund, and they receive $0.

---

## 📈 Rise/Fall Game Mode (Core Trade Mechanic)

All trades in League of Traders use the **Rise/Fall** contract type. This is a simulated binary options mechanic — we use Deriv only as a Price Oracle for live tick data, and handle all trade logic ourselves.

### How It Works
1. **Place a Trade:** A player (human or bot) picks a direction — **Rise (UP)** or **Fall (DOWN)** — and stakes an amount from their balance.
2. **Entry Price:** The current tick quote at the moment of trade placement becomes the `entry_price`.
3. **Wait for Resolution:** After a configurable number of ticks (`duration`, default: 5 ticks), the trade resolves automatically.
4. **Exit Price:** The tick quote at the resolution moment becomes the `exit_price`.
5. **Determine Outcome:**
   * **Win:** If direction is **UP** and `exit_price > entry_price`, OR direction is **DOWN** and `exit_price < entry_price`.
   * **Loss:** All other cases, including `exit_price == entry_price` (no movement = no win).

### Payout Formula
* **On Win:** Player receives `stake × 1.954` (gross payout). Net profit = `stake × 0.954`.
  * Example: $10 stake → $19.54 returned → $9.54 net profit.
* **On Loss:** Player forfeits the entire stake. Net loss = `-stake`.
  * Example: $10 stake → $0 returned → -$10 net loss.

### Tick Duration Options
The number of ticks before resolution can vary. Allowed values: **1, 2, 3, 4, 5, 6, 8, 10**.
* **1–2 ticks:** Ultra-fast, highest variance
* **3–4 ticks:** Short-term
* **5–6 ticks:** Standard (default: 5 ticks, recommended for humans and bots)
* **8–10 ticks:** Medium-term, smoother signal but slower feedback

### Concurrent Positions
A player or bot does **not** need to wait for an open contract to resolve before placing the next one. Multiple contracts can be live simultaneously.
* **Stake deduction is immediate:** The moment a trade is placed, the stake is subtracted from the player's balance. The available balance for the next trade is the post-deduction amount.
* **Concurrent cap:** Each bot personality enforces a maximum number of simultaneously open trades (`maxConcurrentTrades`) to prevent runaway capital exposure. Bots use a separate cooldown to control signal frequency independently of trade resolution.
* **Human players** face the same rules — they may stack trades freely, limited only by their available balance.

### Implementation
* **Shared Module:** `src/lib/game/rise-fall.ts` — used by both human trading UI and BotEngine
* **Trade Lifecycle:** `open` → `won` / `lost` (stored in Supabase `trades` table)
* **Balance Management:** Stake is deducted on placement, payout is credited on resolution

---

## 💰 The Payout Engine (80/20 Profit Contribution Model)

At the end of the game timer, all open contracts are settled, and the backend calculates each player's individual Profit and Loss (PnL). The final payouts are calculated in the following order:

### Phase 1: Determine Individual PnL
Each player is categorized into one of two groups:
* **The Alphas (Winners):** Ending balance > $10,000 (Positive PnL).
* **The Rescues (Losers):** Ending balance < $10,000 (Negative PnL).

### Phase 2: The 80/20 Split (Taxing the Winners)
For every "Alpha" player:
* **The Alpha Cut (80%):** The player keeps 80% of their generated profit, plus their original $10,000 buy-in.
* **The Safety Net Tax (20%):** The remaining 20% of their profit is diverted into the centralized **Safety Net Fund**.

### Phase 3: The Bailout (Rescuing the Losers)
The total Safety Net Fund is divided evenly among all "Rescue" players, subject to a strict cap.
* **The Bailout Cap:** A player can **never** receive a bailout that puts their final balance above their original $10,000 buy-in. Losers cannot profit from the Safety Net.

### Phase 4: Victory Spillover (Excess Funds)
If the Safety Net Fund is large enough to completely refund all losing players back to their $10,000 buy-in, any remaining funds left in the Safety Net are divided proportionally and returned to the "Alpha" players as an extra bonus.

---

## 📊 Scenario Walkthroughs

### Scenario 1: The Hard Carry (Partial Bailout)
*Initial State: 5 Players, $10,000 Buy-in.*
* **Player 1:** +$20,000 profit (Balance: $30,000)
* **Player 2:** +$10,000 profit (Balance: $20,000)
* **Player 3:** -$10,000 loss (Busted, Balance: $0)
* **Player 4:** -$10,000 loss (Busted, Balance: $0)
* **Player 5:** $0 (Broke even, Balance: $10,000)

**The Math:**
1. **P1 Tax:** 20% of $20,000 = $4,000. (P1 keeps $26,000).
2. **P2 Tax:** 20% of $10,000 = $2,000. (P2 keeps $18,000).
3. **Safety Net Fund:** $6,000 total.
4. **The Bailout:** P3 and P4 split the $6,000 evenly. 
5. **Final Result:** P1 gets $26,000, P2 gets $18,000, P3 gets $3,000, P4 gets $3,000, P5 gets $10,000. 

### Scenario 2: The Massive Win (Victory Spillover)
*Initial State: 5 Players, $10,000 Buy-in.*
* **Player 1:** +$80,000 profit (Balance: $90,000)
* **Player 2:** -$6,000 loss (Balance: $4,000)
*(Players 3, 4, 5 broke even).*

**The Math:**
1. **P1 Tax:** 20% of $80,000 = $16,000 into the Safety Net. (P1 secures $74,000).
2. **The Bailout:** Player 2 needs exactly $6,000 to get back to their original $10,000 buy-in. The Safety Net gives them $6,000.
3. **Victory Spillover:** The Safety Net has $10,000 left over ($16,000 - $6,000). Because nobody else needs a rescue, this $10,000 spills back to the only winner, Player 1.
4. **Final Result:** P1 gets $84,000 ($74,000 base + $10,000 spillover). P2 gets $10,000 (fully rescued).

---

## 🛠 Deriv API Integration Notes
* The game relies strictly on **Deriv Virtual Accounts** to avoid regulatory hurdles regarding pooled real-world funds.
* Our custom backend acts as the Ledger, taking a "snapshot" of virtual balances at the start of the timer, and calculating the 80/20 math based on the PnL of contracts executed before the timer expires.