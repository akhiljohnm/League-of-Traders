# 🚀 Pitch Deck & Concept: League of Traders

## 💡 The Core Vision
**League of Traders** is the world’s first Co-Op PvE (Player vs. Environment) trading game. It takes the notoriously isolating, high-stress experience of retail trading and transforms it into a highly engaging, multiplayer social experience. By grouping players into 5-person squads and implementing a unique "Profit Contribution" game theory, we make trading safer for beginners while highly rewarding for experts.

---

## 📣 Marketing Slogans
* *"The market is ruthless. Your squad doesn’t have to be."*
* *"Skin in the game. Safety in the squad."*
* *"Raid the market. Share the glory."*
* *"Co-op trading for the competitive soul."*

---

## 🧭 The 5 W's

### 👤 WHO is this for?
* **The "Alpha" Trader (The Carry):** Experienced or lucky traders who want to flex their skills, top leaderboards, and earn bonus payouts by carrying their team to victory.
* **The Novice (The Learner):** Beginners who are intimidated by solo trading. They can join a lobby, learn the ropes, and rely on the team's "Safety Net" to cushion their early losses.
* **The Business (Deriv):** A gamified product designed to drastically lower user churn, acquire Gen-Z/gamer demographics, and exponentially increase trading volume (API calls) per session.

### ⚙️ WHAT is it?
A real-time, browser-based web application powered by the Deriv API. 
* **The Setup:** 5 players enter a lobby and are granted $500 in virtual Game Tokens.
* **The Gameplay:** A synchronized 5-minute frenzy where players place UP/DOWN predictions based on live Deriv market ticks.
* **The Math (80/20 System):** At the end of the round, profitable players keep 80% of their gains and pay a 20% "tax" into a Safety Net fund. This fund automatically bails out the losing players (capped at their original $500). 

### ⏱️ WHEN does the action happen?
League of Traders is designed around **high-octane micro-sessions**. 
Games last exactly 5 minutes. This creates intense, focused engagement loops perfect for mobile and web. It prevents the fatigue of staring at long-term charts and delivers immediate dopamine hits and fast resolution.

### 🌍 WHERE does it live?
The app is a universally accessible Next.js web application deployed on Vercel. Behind the scenes, it utilizes Supabase as an ultra-fast, real-time ledger to handle the multiplayer lobbies, while relying on the **Deriv API V2** as the ultimate, un-hackable "Price Oracle" streaming live market data.

### 🔥 WHY is it a game-changer? (The Problem it Solves)
**The Problem:** Traditional retail trading has a high churn rate. When new users lose their initial deposit, they feel defeated and leave the platform. It is a lonely, zero-sum experience.
**The Solution:** We introduce **Social Loss Mitigation**. By utilizing the 80/20 Profit Contribution model, a busted player doesn't leave angry; they get a partial "Bailout" funded by the winning players. They feel a sense of camaraderie, gratitude toward the "Carry", and are immediately incentivized to queue up for another 5-minute match to try and become the Alpha themselves.

---

## 🏆 Why this wins the Grand Prix (The "Secret Sauce")

We aren't just putting a UI over an API; we engineered a behavioral loop. 

1. **Eliminates Moral Hazard:** We didn't build a communist utopia where losers get free money. Losers are *partially* bailed out, but can never profit from the Safety Net. This forces every player to actively try to win.
2. **Rewards Excellence:** The "Alpha" trader is heavily rewarded. Even after paying the 20% tax to save their friends, they take home massive profits, satisfying the ego-driven nature of trading.
3. **Massive API Utilization:** Because of the "Active Trader Quota" (requiring users to make multiple trades to qualify for bailouts), every single 5-minute game generates dozens of API calls and simulated contract executions, proving the scalability and speed of the Deriv platform.