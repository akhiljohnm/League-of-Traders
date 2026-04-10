# autoresearch

This is an experiment to have the LLM optimize trading strategies autonomously.

## Setup

To set up a new experiment, work with the user to:

1. **Agree on a run tag**: propose a tag based on today's date (e.g. `apr10`). The branch `autoresearch/<tag>` must not already exist — this is a fresh run.
2. **Create the branch**: `git checkout -b autoresearch/<tag>` from current main.
3. **Read the in-scope files**: The research directory is small. Read these files for full context:
   - `research/strategy.ts` — the file you modify. Hyperparameters, indicator logic, decision rules.
   - `research/backtest-engine.ts` — fixed evaluator, backtest simulation, scoring. Do not modify.
   - `research/types.ts` — type definitions. Do not modify.
   - `research/run-backtest.ts` — runner script. Do not modify.
4. **Verify data exists**: Check that `research/data/` contains tick data files for multiple volatility markets (1HZ100V, 1HZ75V, 1HZ50V, 1HZ25V, 1HZ10V). If not, tell the human to run `npx tsx research/collect-all-markets.ts`.
5. **Initialize results.tsv**: Create `results.tsv` with just the header row. The baseline will be recorded after the first run.
6. **Confirm and go**: Confirm setup looks good.

Once you get confirmation, kick off the experimentation.

## Experimentation

Each experiment runs a backtest across all available market datasets. The runner evaluates the strategy against every tick dataset in `research/data/` and produces an aggregate score. You launch it simply as: `npx tsx research/run-backtest.ts --all > research/run.log 2>&1`.

**What you CAN do:**
- Modify `research/strategy.ts` — this is the only file you edit. Everything is fair game: indicator logic, hyperparameters, signal blending, stake sizing, add new indicators, remove unused ones.

**What you CANNOT do:**
- Modify `research/backtest-engine.ts`. It is read-only. It contains the fixed evaluation, trade simulation, and scoring math.
- Modify `research/types.ts`, `research/run-backtest.ts`, `research/collect-ticks.ts`, `research/collect-all-markets.ts`, or `research/live-evaluator.ts`. All read-only.
- Modify anything in `src/` (the main Next.js app).
- Install new packages or add dependencies. You can only use what's already in `package.json`.

**Monorepo note:** This research directory lives inside a larger Next.js repo. Always stage only `research/strategy.ts`. Never use blind `git add -A` or `git add .`. Always use `git add research/strategy.ts && git commit -m "experiment: <description>"`.

**The goal is simple: get the highest avg_score.** The score is computed by the immutable backtest engine as a composite of net PnL (normalized by $10,000 buy-in), Sharpe ratio (risk-adjusted returns), and win rate (consistency). Higher is better. Since backtests run in milliseconds, you can iterate very rapidly.

**The strategy is evaluated across all volatility markets** (Vol 100, 75, 50, 25, 10). The `avg_score` across ALL markets is the optimization target. This prevents overfitting to a single market's characteristics.

**Simplicity criterion**: All else being equal, simpler is better. A small improvement that adds ugly complexity is not worth it. Conversely, removing something and getting equal or better results is a great outcome — that's a simplification win. When evaluating whether to keep a change, weigh the complexity cost against the improvement magnitude. A 0.5 point avg_score improvement that adds 20 lines of hacky code? Probably not worth it. A 0.5 point improvement from deleting code? Definitely keep. An improvement of ~0 but much simpler code? Keep.

**The first run**: Your very first run should always be to establish the baseline, so you will run the backtest as is.

## Output format

Once the runner finishes it prints results for each dataset, then an aggregate summary like this:

```
--- avg_score:           12.45
--- datasets:            5
--- avg_net_pnl:         845.30
--- avg_win_rate:        57.25%
--- avg_sharpe:          0.22
--- total_trades:        85
--- peak_mem_mb:         42
--- status:              ok
```

Note that each individual dataset also prints per-market results with the `--- score:` prefix. You can extract the key metric from the log file:

```
grep "^--- avg_score:" research/run.log
```

## Logging results

When an experiment is done, log it to `research/results.tsv` (tab-separated, NOT comma-separated — commas break in descriptions).

The TSV has a header row and 5 columns:

```
commit	avg_score	datasets	status	description
```

1. git commit hash (short, 7 chars)
2. avg_score achieved (e.g. 12.45) — use 0.00 for crashes
3. datasets: number of market datasets backtested (should be 5)
4. status: `keep`, `discard`, or `crash`
5. short text description of what this experiment tried

Example:

```
commit	avg_score	datasets	status	description
a1b2c3d	8.20	5	keep	baseline
b2c3d4e	12.45	5	keep	increase shortWindow to 8, reduce cooldown to 4
c3d4e5f	6.10	5	discard	switch to pure momentum (worse than hybrid)
d4e5f6g	0.00	0	crash	syntax error in signal blending
```

## The experiment loop

The experiment runs on a dedicated branch (e.g. `autoresearch/apr10`).

LOOP FOREVER:

1. Look at the git state: the current branch/commit we're on
2. Tune `research/strategy.ts` with an experimental idea by directly hacking the code.
3. `git add research/strategy.ts && git commit -m "experiment: <description>"`
4. Run the experiment: `npx tsx research/run-backtest.ts --all > research/run.log 2>&1` (redirect everything — do NOT use tee or let output flood your context)
5. Read out the results: `grep "^--- avg_score:\|^--- avg_win_rate:\|^--- avg_sharpe:" research/run.log`
6. If the grep output is empty, the run crashed. Run `tail -n 50 research/run.log` to read the stack trace and attempt a fix. If you can't get things to work after more than a few attempts, give up.
7. Record the results in the tsv (NOTE: do not commit the results.tsv file, leave it untracked by git)
8. If avg_score improved (higher), you "advance" the branch, keeping the git commit
9. If avg_score is equal or worse, you git reset back to where you started: `git reset --hard HEAD~1`

The idea is that you are a completely autonomous researcher trying things out. If they work, keep. If they don't, discard. And you're advancing the branch so that you can iterate. If you feel like you're getting stuck in some way, you can rewind but you should probably do this very very sparingly (if ever).

**Timeout**: Each experiment should take under 10 seconds (backtests are pure math). If a run exceeds 30 seconds, kill it and treat it as a failure (discard and revert).

**Crashes**: If a run crashes (a bug, type error, etc.), use your judgment: If it's something dumb and easy to fix (e.g. a typo, a missing variable), fix it and re-run. If the idea itself is fundamentally broken, just skip it, log "crash" as the status in the tsv, and move on.

**Live validation**: Every 5-10 improvements, run a live validation session: `npx tsx research/run-backtest.ts --all --live > research/run.log 2>&1`. This connects to the live Deriv market for 5 minutes and tests the strategy against real-time data. If `--- live_score:` is significantly lower than `--- avg_score:`, the strategy may be overfitting to recorded data. Consider reverting to a more robust earlier version.

**Per-market health check**: If avg_score improves but any single market's `--- score:` drops below -10, investigate. A strategy that scores +40 on Volatility 100 but -20 on Volatility 10 is fragile.

**NEVER STOP**: Once the experiment loop has begun (after the initial setup), do NOT pause to ask the human if you should continue. Do NOT ask "should I keep going?" or "is this a good stopping point?". The human might be asleep, or gone from a computer and expects you to continue working *indefinitely* until you are manually stopped. You are autonomous. If you run out of ideas, think harder — re-read the strategy file for new angles, try combining previous near-misses, try more radical changes to the signal logic, explore different indicator combinations. The loop runs until the human interrupts you, period.

Since backtests run in milliseconds (~100ms), each experiment takes ~30 seconds total (edit + commit + run + log). You can run approx 120 experiments per hour. If left running overnight, that's **~1,000 experiments** by morning.

## Rise/Fall domain knowledge

The game uses Rise/Fall contracts: predict whether the price will be higher (UP/Rise) or lower (DOWN/Fall) after 5 ticks. Key facts for the optimizer:

- **Payout**: Win = stake × 1.954 (UP) or 1.952 (DOWN). Loss = forfeit stake.
- **Break-even win rate**: ~51.3%. Even small improvements above this have massive compound impact.
- **Game duration**: 300 ticks (~5 minutes). Must place at least 5 trades (quota).
- **Buy-in**: $10,000 virtual balance.
- **Optimal trade frequency**: Too few trades = insufficient samples, too many = balance churn. Sweet spot is 10-30 trades per game.
- **Markets vary**: Volatility 100 has the most movement (easier signals), Volatility 10 the least (harder to predict). A robust strategy should handle all.

## Strategy ideas to explore

Start with the easy wins, then get creative:

**Phase 1: Hyperparameter sweep** — Different EMA windows (3/8, 5/20, 8/21, 10/30), Bollinger Band multipliers (1.5–3.0), stake percentages (0.03–0.15), cooldown ticks (3–15).

**Phase 2: Signal logic** — RSI, MACD, ATR for volatility-adaptive sizing, Heikin-Ashi smoothed prices, dynamic signal weights based on recent performance.

**Phase 3: Risk management** — Kelly Criterion staking, drawdown-based sizing, consecutive loss reduction, time-based urgency.

**Phase 4: Advanced** — Regime detection (trending vs. ranging), per-regime parameters, volatility clustering, momentum scoring with decay.

**Phase 5: Simplification** — Delete unused indicators. Reduce parameters. A simpler strategy that scores the same is ALWAYS better.

## Quick reference commands

```bash
# Collect tick data from all 5 markets (5 min each)
npx tsx research/collect-all-markets.ts

# Collect from single market (10 min)
npx tsx research/collect-ticks.ts 1HZ100V 600

# Run backtest against all datasets
npx tsx research/run-backtest.ts --all > research/run.log 2>&1

# Extract the optimization metric
grep "^--- avg_score:" research/run.log

# Extract all key metrics
grep "^--- avg_score:\|^--- avg_win_rate:\|^--- avg_sharpe:" research/run.log

# Run with live validation (adds ~5 min)
npx tsx research/run-backtest.ts --all --live > research/run.log 2>&1

# Discard failed experiment
git reset --hard HEAD~1
```
