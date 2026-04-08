# 🎨 Brand & UI/UX Design Guide: League of Traders

## 🌌 The Visual Identity: "Cyber-Terminal"
The brand identity sits on the frontier of innovation. It rejects the soft, friendly, and gamified looks of typical consumer apps. Instead, it adopts a highly technical, elevated, and "pro-trader" aesthetic. It should feel like you just logged into an exclusive, high-stakes trading floor.

**Keywords:** Edgy, High-Contrast, Data-Dense, Instantaneous, Professional.

---

## 🎨 Color Palette (Strict Dark Mode)
To achieve the pro-trading experience, the app operates strictly in dark mode. The background absorbs light, allowing the data and market movements to pop intensely.

* **The Void (Backgrounds):** `#09090B` (A near-pitch-black charcoal). Eliminates eye strain during intense 5-minute sessions.
* **Surface (Cards/Panels):** `#18181B` (Slightly elevated dark gray) with a subtle 1px border of `#27272A` to separate data zones.
* **Alpha Green (Profit/Up):** `#00FFA3` (A piercing, neon "laser" green). Used for winning trades, positive PnL, and the "Buy UP" button.
* **Rekt Crimson (Loss/Down):** `#FF3366` (An aggressive, glowing red). Used for losing trades, negative PnL, and the "Buy DOWN" button.
* **Safety Net Cyan (Brand Accent):** `#00E5FF` (Electric blue). Used for primary actions, lobby borders, and highlighting the Safety Net Fund mechanic.
* **Typography:** `#FAFAFA` (Pure white) for primary data/numbers, and `#A1A1AA` (Muted slate) for labels and secondary text.

---

## 🔤 Typography
We are mixing a highly readable UI font with a technical, monospaced font for all the numbers. A pro-trader interface relies heavily on numbers, so they need to look incredibly crisp.

* **Primary UI Font:** **Inter** (or San Francisco). It’s the gold standard for clean, professional, and elevated user interfaces. Used for buttons, labels, and lobby text.
* **Data & Metrics Font:** **JetBrains Mono** (or Roboto Mono). Used strictly for all numbers, timers, prices, and PnL. Monospace ensures that ticking market prices don't "jiggle" left and right as the numbers change, maintaining a rock-solid pro feel.

---

## 📐 UI/UX Core Principles

### 1. Data-Dense, Not Cluttered
Professional traders want information at a glance. We will minimize empty "whitespace" but use strict grid alignments and subtle borders to keep the screen organized. 

### 2. Micro-Interactions & Snappy Feedback
Because the game revolves around 5-minute frenzy trading, latency is the enemy. 
* Buttons should have an instant visual "press" state (scaling down by 2%).
* When a trade is placed, a subtle cyan flash should confirm the action instantly.
* The 5-minute countdown timer should pulse slightly when it drops below 30 seconds to induce urgency.

### 3. The "Vibe" Elements
* **The Leaderboard:** The top "Alpha" player should have a subtle golden or cyan glow around their avatar/row.
* **The Chart:** The live Deriv price chart should be a minimalist line chart (no grid lines behind it), filling the background of the trading panel.

---

## 💻 Component Mood Board

### The Lobby Screen
A stark, minimalist waiting room. 5 empty slots. As players join, their usernames lock in with a satisfying "clack" animation and a neon border illuminates.

### The Trading Dashboard (The Cockpit)
* **Top Bar:** The global 5-minute timer (JetBrains Mono, glowing), Total Team Profit metric.
* **Center Stage:** The live price chart streaming from the Deriv Oracle.
* **Bottom/Sides:** Massive, edge-to-edge `[ UP ]` and `[ DOWN ]` execution buttons.
* **Right Panel:** A live-updating leaderboard showing the 5 players' current PnL changing tick-by-tick.

### The Post-Game Resolution
A dramatic screen takeover. The background darkens further. 
1. The Alpha's profit counts up rapidly in green.
2. The 20% tax deduction flashes in cyan, visually traveling into a central "Safety Net" pool.
3. The pool distributes lines of cyan light to the losing players, instantly updating their busted balances back up to survival levels.