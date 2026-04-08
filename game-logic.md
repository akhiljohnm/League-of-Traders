# 📜 Game Logic: League of Traders (PvE Co-Op)

## 🎯 Game Overview
"League of Traders" is a cooperative, multiplayer trading game built on the Deriv API. Players join a 5-person lobby, pool virtual funds, and trade as a team against the market within a set timeframe. The core objective is to maximize individual profit while contributing to a team safety net that rescues struggling players.

---

## ⚙️ Core Mechanics

### 1. The Lobby & Buy-in
* **Lobby Size:** 5 Players.
* **Buy-in Amount:** $500 (Deriv Virtual Funds).
* **Initial Team Pool:** $2,500.
* **Game Duration:** A fixed timeframe (e.g., 5 minutes) or a fixed number of market ticks.

### 2. The "Skin in the Game" Quota (Anti-Leech)
To prevent "free-riding" (players joining and going AFK to farm the safety net), players must meet an **Active Trader Quota**.
* **Rule:** A player must execute a minimum of 5 trades during the game timer to be eligible for *any* payouts or bailouts.
* **Penalty:** If the quota is not met, their ending balance is forfeited to the Safety Net Fund, and they receive $0.

---

## 💰 The Payout Engine (80/20 Profit Contribution Model)

At the end of the game timer, all open contracts are settled, and the backend calculates each player's individual Profit and Loss (PnL). The final payouts are calculated in the following order:

### Phase 1: Determine Individual PnL
Each player is categorized into one of two groups:
* **The Alphas (Winners):** Ending balance > $500 (Positive PnL).
* **The Rescues (Losers):** Ending balance < $500 (Negative PnL).

### Phase 2: The 80/20 Split (Taxing the Winners)
For every "Alpha" player:
* **The Alpha Cut (80%):** The player keeps 80% of their generated profit, plus their original $500 buy-in.
* **The Safety Net Tax (20%):** The remaining 20% of their profit is diverted into the centralized **Safety Net Fund**.

### Phase 3: The Bailout (Rescuing the Losers)
The total Safety Net Fund is divided evenly among all "Rescue" players, subject to a strict cap.
* **The Bailout Cap:** A player can **never** receive a bailout that puts their final balance above their original $500 buy-in. Losers cannot profit from the Safety Net.

### Phase 4: Victory Spillover (Excess Funds)
If the Safety Net Fund is large enough to completely refund all losing players back to their $500 buy-in, any remaining funds left in the Safety Net are divided proportionally and returned to the "Alpha" players as an extra bonus.

---

## 📊 Scenario Walkthroughs

### Scenario 1: The Hard Carry (Partial Bailout)
*Initial State: 5 Players, $500 Buy-in.*
* **Player 1:** +$1,000 profit (Balance: $1,500)
* **Player 2:** +$500 profit (Balance: $1,000)
* **Player 3:** -$500 loss (Busted, Balance: $0)
* **Player 4:** -$500 loss (Busted, Balance: $0)
* **Player 5:** $0 (Broke even, Balance: $500)

**The Math:**
1. **P1 Tax:** 20% of $1,000 = $200. (P1 keeps $1,300).
2. **P2 Tax:** 20% of $500 = $100. (P2 keeps $900).
3. **Safety Net Fund:** $300 total.
4. **The Bailout:** P3 and P4 split the $300 evenly. 
5. **Final Result:** P1 gets $1,300, P2 gets $900, P3 gets $150, P4 gets $150, P5 gets $500. 

### Scenario 2: The Massive Win (Victory Spillover)
*Initial State: 5 Players, $500 Buy-in.*
* **Player 1:** +$4,000 profit (Balance: $4,500)
* **Player 2:** -$300 loss (Balance: $200)
*(Players 3, 4, 5 broke even).*

**The Math:**
1. **P1 Tax:** 20% of $4,000 = $800 into the Safety Net. (P1 secures $3,700).
2. **The Bailout:** Player 2 needs exactly $300 to get back to their original $500 buy-in. The Safety Net gives them $300.
3. **Victory Spillover:** The Safety Net has $500 left over ($800 - $300). Because nobody else needs a rescue, this $500 spills back to the only winner, Player 1.
4. **Final Result:** P1 gets $4,200 ($3,700 base + $500 spillover). P2 gets $500 (fully rescued).

---

## 🛠 Deriv API Integration Notes
* The game relies strictly on **Deriv Virtual Accounts** to avoid regulatory hurdles regarding pooled real-world funds.
* Our custom backend acts as the Ledger, taking a "snapshot" of virtual balances at the start of the timer, and calculating the 80/20 math based on the PnL of contracts executed before the timer expires.