# Auto-Research: Autonomous Trading Strategy Optimization

## What Is This?

This is an implementation of [Andrej Karpathy's autoresearch](https://github.com/karpathy/autoresearch) framework, adapted for trading strategy optimization instead of ML model training. The core idea: **give an AI agent a single file to edit, a fixed evaluator, and one metric to optimize — then let it run autonomously overnight.**

In Karpathy's original, the agent edits `train.py` (a GPT model) and optimizes `val_bpb` (validation bits per byte). In ours, the agent edits `research/strategy.ts` (a Rise/Fall trading strategy) and optimizes `avg_score` (a composite of PnL, Sharpe ratio, and win rate across 5 live volatility markets).

You don't write Python anymore — you write Markdown that programs AI agents who write the code for you.

---

## Architecture

```
research/
├── program.md              ← The "Agent OS" (Karpathy's program.md)
│                              Instructions that drive the LLM optimizer
│
├── strategy.ts             ← MUTABLE (Karpathy's train.py)
│                              The ONLY file the optimizer edits
│                              Contains PARAMS block + indicator logic
│
├── backtest-engine.ts      ← IMMUTABLE (Karpathy's prepare.py)
│                              Deterministic evaluator: replays ticks,
│                              simulates Rise/Fall trades, computes score
│
├── run-backtest.ts         ← Runner script (replaces `uv run train.py`)
│                              Loads all tick datasets, runs strategy,
│                              prints structured output, optional --live
│
├── collect-ticks.ts        ← Single-market tick data collector
├── collect-all-markets.ts  ← Multi-market parallel collector (5 indices)
├── live-evaluator.ts       ← Stage 2: live WebSocket validation
├── analysis.ipynb          ← Results visualization (Karpathy's analysis.ipynb)
├── types.ts                ← Standalone type definitions
├── tsconfig.json           ← Independent TS config (no Next.js deps)
│
├── data/                   ← Recorded tick datasets (.gitignored)
│   ├── 1HZ100V_*.json
│   ├── 1HZ75V_*.json
│   ├── 1HZ50V_*.json
│   ├── 1HZ25V_*.json
│   └── 1HZ10V_*.json
│
├── results.tsv             ← Experiment log (.gitignored)
└── run.log                 ← Last run output (.gitignored)
```

### Mapping to Karpathy's Autoresearch

| Karpathy (ML Training)       | League of Traders (Trading)              |
|------------------------------|------------------------------------------|
| `program.md` (agent OS)     | `research/program.md`                    |
| `train.py` (mutable)        | `research/strategy.ts` (mutable)         |
| `prepare.py` (immutable)    | `research/backtest-engine.ts` (immutable) |
| `uv run train.py`           | `npx tsx research/run-backtest.ts --all`  |
| `val_bpb` (lower = better)  | `avg_score` (higher = better)            |
| 5-min GPU training per run  | ~100ms backtest per run (pure TypeScript) |
| ~12 experiments/hour         | ~120 experiments/hour                    |
| Single GPU (H100/CUDA)      | M2 Mac (no GPU needed)                   |
| `results.tsv` (5 columns)   | `results.tsv` (5 columns)               |
| `analysis.ipynb`             | `research/analysis.ipynb`                |

---

## How It Works

### The Three Rules

1. **Single mutable file.** The agent only edits `research/strategy.ts`. This keeps scope manageable and diffs reviewable.

2. **Fixed evaluator.** `research/backtest-engine.ts` is never modified. It replays recorded tick data, simulates Rise/Fall trades (5-tick duration, 1.954x payout on win), and computes a composite score. This is the ground truth — the agent cannot game the metric.

3. **Single scalar metric.** Everything is judged by `avg_score` — the average score across all 5 volatility markets. No ambiguity, no multi-objective confusion.

### The Experiment Loop

```
SETUP:
  1. Create branch: git checkout -b autoresearch/apr10
  2. Read strategy.ts, backtest-engine.ts, types.ts
  3. Initialize results.tsv with header row
  4. Run baseline backtest
  5. Record baseline score

LOOP FOREVER:
  1. Examine strategy.ts and results.tsv for patterns
  2. Form a hypothesis (e.g., "shorter EMA window = faster signals")
  3. Edit strategy.ts to implement the change
  4. git add research/strategy.ts && git commit -m "experiment: ..."
  5. Run: npx tsx research/run-backtest.ts --all > research/run.log 2>&1
  6. Extract: grep "^--- avg_score:" research/run.log
  7. If IMPROVED → KEEP (advance branch)
     If WORSE    → DISCARD (git reset --hard HEAD~1)
  8. Log to results.tsv
  9. NEVER STOP. Start next experiment immediately.
```

Each iteration takes ~30 seconds (edit + commit + run + log). Left running overnight, that's **~1,000 experiments by morning**.

### Multi-Market Evaluation

The strategy is evaluated against **all 5 Deriv volatility indices**:

| Symbol   | Market              | Characteristics                    |
|----------|---------------------|------------------------------------|
| 1HZ100V  | Volatility 100      | Highest movement, strongest signals |
| 1HZ75V   | Volatility 75       | High movement                      |
| 1HZ50V   | Volatility 50       | Medium movement                    |
| 1HZ25V   | Volatility 25       | Low movement                       |
| 1HZ10V   | Volatility 10       | Lowest movement, hardest to predict |

The `avg_score` across ALL markets is the optimization target. This prevents the agent from overfitting to a single market's behavior. A robust strategy must generalize across different volatility levels.

### Two-Stage Evaluation

**Stage 1 — Pre-recorded (default, fast):** Runs against all tick datasets in `research/data/`. Deterministic, ~100ms, no network dependency. Used for every iteration.

**Stage 2 — Live validation (optional):** When `--live` is passed, connects to the real Deriv WebSocket for 5 minutes and tests the strategy against live market data. Used every 5-10 improvements to detect overfitting. If the live score is significantly lower than the pre-recorded score, the strategy may be overfitting to historical patterns.

### The Score

The `score` is a composite metric computed by the immutable backtest engine:

```
score = (net_pnl / 10000) * 100     # PnL normalized by buy-in
      + sharpe_ratio * 20            # Risk-adjusted returns
      + win_rate * 10                # Consistency bonus
```

| Score Range | Interpretation                       |
|-------------|--------------------------------------|
| < -10       | Terrible — consistently losing money |
| -10 to 0    | Below break-even                     |
| 0 to 5      | Break-even to slightly profitable    |
| 5 to 15     | Good — consistent small gains        |
| 15 to 30    | Very good — strong edge              |
| > 30        | Excellent — significant alpha        |

### Rise/Fall Domain Knowledge

The game uses Rise/Fall contracts against the Deriv price oracle:

- **Mechanic:** Predict if price goes UP or DOWN after 5 ticks
- **Payout:** Win = stake x 1.954 (Rise) or 1.952 (Fall). Loss = forfeit stake
- **Break-even win rate:** ~51.3% — even small improvements above this compound massively
- **Game duration:** 300 ticks (~5 minutes), minimum 5 trades required
- **Buy-in:** $10,000 virtual balance per game

---

## How to Run

### Prerequisites

- Node.js 18+ and npm
- M2 Mac (or any machine — pure TypeScript, no GPU needed)
- Dependencies already installed (`npm install` includes `tsx` and `ws`)

### Step 1: Collect Multi-Market Data

Collect 5 minutes of live tick data from all 5 volatility indices simultaneously:

```bash
npm run research:collect-all
```

This opens 5 parallel WebSocket connections to the Deriv API, one per market. Output: 5 JSON files in `research/data/`, each containing ~300 ticks.

For a longer collection (e.g., 10 minutes):

```bash
npx tsx research/collect-all-markets.ts 600
```

For a single market:

```bash
npx tsx research/collect-ticks.ts 1HZ100V 300
```

### Step 2: Run a Backtest

Test the current strategy against all collected data:

```bash
npm run research:backtest
```

This runs `research/strategy.ts` against every dataset in `research/data/` and prints per-market results plus an aggregate:

```
--- avg_score:             12.45
--- datasets:              5
--- avg_net_pnl:           845.30
--- avg_win_rate:          57.25%
--- avg_sharpe:            0.22
--- total_trades:          85
--- peak_mem_mb:           8
--- status:                ok
```

### Step 3: Run with Live Validation

After several improvements, validate against the live market:

```bash
npm run research:live
```

This runs the pre-recorded backtest first, then connects to the live Deriv market for ~5 minutes. Compares live score vs recorded score to detect overfitting.

### Step 4: Start the Autonomous Optimizer

Open a **new Claude Code session** in this project directory and say:

```
Read research/program.md and let's kick off autoresearch. Do the setup first.
```

The agent will:
1. Create a branch (`autoresearch/apr10`)
2. Read all context files
3. Establish a baseline score
4. Begin iterating autonomously — editing `strategy.ts`, running backtests, keeping improvements, discarding regressions
5. Log every experiment to `results.tsv`
6. **Never stop** until you manually interrupt it

### Step 5: Review Results

After letting the optimizer run (an hour, overnight, etc.):

```bash
# View the results log
cat research/results.tsv

# See the best score achieved
sort -t$'\t' -k2 -n -r research/results.tsv | head -5

# Open the analysis notebook (requires Python + pandas + matplotlib)
jupyter notebook research/analysis.ipynb
```

The `analysis.ipynb` notebook provides:
- Score trajectory chart (green = kept, red = discarded)
- Best score progression (monotonic frontier)
- Summary statistics (keep rate, total experiments, improvement)
- Top improvements table

---

## The Strategy File

`research/strategy.ts` is the single mutable file. It exports one function:

```typescript
export function createStrategy(): StrategyInstance
```

All hyperparameters live in the `PARAMS` block at the top:

```typescript
const PARAMS = {
  shortWindow: 5,           // Short EMA period
  longWindow: 15,           // Long EMA period
  bbWindow: 20,             // Bollinger Band window
  bbMultiplier: 2.0,        // Band width multiplier
  momentumBias: 0.65,       // Micro-momentum follow probability
  stakePercent: 0.06,       // Fraction of balance per trade
  cooldownTicks: 6,         // Min ticks between trades
  trendWeight: 0.5,         // EMA crossover signal weight
  reversionWeight: 0.3,     // Bollinger Band signal weight
  momentumWeight: 0.2,      // Micro-momentum signal weight
  // ... + game-aware sizing params
};
```

The current baseline strategy is a **hybrid** that blends three signals:
1. **EMA Crossover** (trend following) — bullish/bearish crossover detection
2. **Bollinger Bands** (mean reversion) — overbought/oversold detection
3. **Micro-Momentum** — short-term price direction

The optimizer can change any of these: swap indicators, add new ones (RSI, MACD, ATR), change the blending logic, adjust stake sizing, implement regime detection, or simplify by removing unused components.

---

## What the Optimizer Explores

The `program.md` guides the agent through 5 phases:

**Phase 1: Hyperparameter Sweep** — Different EMA windows, Bollinger multipliers, stake sizes, cooldowns. Low-hanging fruit.

**Phase 2: Signal Logic** — New indicators (RSI, MACD, ATR), dynamic signal weighting, smoothed price inputs.

**Phase 3: Risk Management** — Kelly Criterion staking, drawdown-based sizing, consecutive loss reduction, time-based urgency.

**Phase 4: Advanced** — Regime detection (trending vs ranging), per-regime parameters, volatility clustering.

**Phase 5: Simplification** — Delete what doesn't help. Karpathy's key insight: **a simpler strategy that scores the same is always better.** Deleting code while maintaining score is a valid improvement.

---

## Output Format

All output uses Karpathy's `---` prefix convention for machine-parseability:

```
--- strategy:              AutoResearch Hybrid v1
--- score:                 22.4
--- net_pnl:               1351.45
--- final_balance:         11351.45
--- total_trades:          17
--- wins:                  10
--- losses:                7
--- win_rate:              58.82%
--- sharpe_ratio:          0.15
--- max_drawdown:          3053.2
--- max_drawdown_pct:      25.25%
--- profit_factor:         1.37
--- ticks_processed:       300
```

The optimizer agent extracts the key metric with:

```bash
grep "^--- avg_score:" research/run.log
```

### results.tsv Format

Tab-separated, 5 columns (matches Karpathy's convention):

```
commit    avg_score    datasets    status    description
a1b2c3d   8.20         5           keep      baseline
b2c3d4e   12.45        5           keep      increase shortWindow to 8
c3d4e5f   6.10         5           discard   pure momentum (worse)
```

---

## npm Scripts Reference

| Script                   | Command                                       | Purpose                          |
|--------------------------|-----------------------------------------------|----------------------------------|
| `research:collect`       | `npx tsx research/collect-ticks.ts`            | Collect from one market          |
| `research:collect-all`   | `npx tsx research/collect-all-markets.ts`      | Collect from all 5 markets       |
| `research:backtest`      | `npx tsx research/run-backtest.ts`             | Run backtest (interactive)       |
| `research:run`           | `run-backtest --all > run.log && grep score`   | Run + extract metric (for agent) |
| `research:live`          | `run-backtest --all --live > run.log && grep`  | Run + live validation            |

---

## Why This Approach Works

1. **Speed.** Backtests run in ~100ms (pure TypeScript math on tick arrays). No GPU, no network calls, no database. This means ~120 experiments per hour, ~1,000 overnight.

2. **Determinism.** Same tick data + same strategy = same result. No training noise, no stochastic evaluation. Fair comparisons between experiments.

3. **Multi-market robustness.** Evaluating across 5 volatility indices with different characteristics prevents overfitting. The strategy must generalize.

4. **Live validation.** The `--live` flag tests against real market data as a periodic overfitting check, without slowing down the main iteration loop.

5. **Simplicity constraint.** Following Karpathy's "simplicity criterion" — complexity is only justified by meaningful score improvement. This prevents the strategy from becoming an unmaintainable mess over hundreds of iterations.

6. **Git discipline.** Every experiment is a commit. Improvements advance the branch. Regressions are reset. The full history of what was tried (and what worked) is preserved in `results.tsv`.

7. **M2 Mac native.** No CUDA, no PyTorch, no MPS. Pure TypeScript runs identically on any platform. The M2's speed is more than enough for millisecond backtests.
