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
4. **Collect fresh tick data**: ALWAYS collect fresh data at the start of a new session — do not reuse data from a previous session. Run `npx tsx research/collect-all-markets.ts`. Wait for all 5 markets to complete. Fresh data prevents the optimizer from memorizing old tick sequences.
5. **Reset strategy.ts to a clean baseline**: If the current strategy.ts contains a complex, heavily-tuned strategy from a previous session (check for time-gating, mid-game freezes, multi-tier stake logic, or PARAMS with many commented-out values), simplify it back to a clean starting point before running the baseline. A good clean baseline is: EMA crossover (short 5 / long 15) + Bollinger Bands (window 20, multiplier 2.0) + micro-momentum, flat 5% stake, cooldown 5 ticks, no time-gating. The goal is to discover a genuinely robust strategy, not to resume polishing an overfit one.
6. **Initialize results.tsv**: Create `results.tsv` with just the header row. The baseline will be recorded after the first run.
7. **Confirm and go**: Confirm setup looks good.

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

**The goal is a high avg_score that also survives live market conditions.** The score is computed by the immutable backtest engine as a composite of net PnL (normalized by $10,000 buy-in), Sharpe ratio (risk-adjusted returns), and win rate (consistency). Higher is better. But a backtest score means nothing if the strategy fails on live data — the bots run in the real game, not against pre-recorded ticks. Treat pre-recorded avg_score as a development signal only. Live score is the true north.

**The strategy is evaluated across all volatility markets** (Vol 100, 75, 50, 25, 10). The `avg_score` across ALL markets is the optimization target. This prevents overfitting to a single market's characteristics. A strategy that wins big on one market while busting all others is NOT a good strategy — it is an overfit artifact.

**Simplicity criterion**: All else being equal, simpler is better. A small improvement that adds ugly complexity is not worth it. Conversely, removing something and getting equal or better results is a great outcome — that's a simplification win. When evaluating whether to keep a change, weigh the complexity cost against the improvement magnitude. A 0.5 point avg_score improvement that adds 20 lines of hacky code? Probably not worth it. A 0.5 point improvement from deleting code? Definitely keep. An improvement of ~0 but much simpler code? Keep.

**Robustness gate (HARD RULE — must check before every keep)**: Before logging any experiment as `keep`, verify:
1. **No more than 2 markets below -10.** Count how many individual `--- score:` values are below -10. If 3 or more are below -10, this is a REJECT — do not keep it, even if avg_score improved. Revert with `git reset --hard HEAD~1`.
2. **No market below -50.** If any single market scores below -50, it is busted. REJECT immediately regardless of avg_score.
3. **avg_score must not be dominated by a single outlier.** If one market accounts for more than 80% of the total avg_score sum, the result is fragile. Treat with extreme caution.
4. **Minimum trade count.** `total_trades / datasets` must be ≥ 10. A strategy placing fewer than 10 trades per game on average produces results too small to be statistically reliable.

These gates exist because the bots play in live markets — a strategy that relies on one lucky tick sequence in a pre-recorded dataset will fail in the real game.

**Hypersensitivity = overfitting signal**: If changing a parameter by ±1 step from its "optimal" value causes catastrophic results on any market (e.g., shortWindow 8 is fine but 7 or 9 busts a market), **stop testing that axis** — you have found the edge of what the pre-recorded data memorized. Mark that parameter as locked in your mental model. Do NOT treat hyper-sensitivity as confirmation of optimality. Instead, treat it as a warning: run live validation before accepting any improvements in the surrounding config. Genuine strategies tolerate small parameter perturbations.

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
5. short text description — **always include the worst per-market score in parentheses**, e.g. `(worst: -8.2)`. This makes overfitting trends visible in the log without adding columns.

Example:

```
commit	avg_score	datasets	status	description
a1b2c3d	8.20	5	keep	baseline (worst: 2.1)
b2c3d4e	12.45	5	keep	shortWindow 8 reduce cooldown to 4 (worst: 4.3)
c3d4e5f	6.10	5	discard	pure momentum worse than hybrid (worst: -18.4)
d4e5f6g	0.00	0	crash	syntax error in signal blending
```

If you see the worst-market score trending more negative across consecutive `keep` entries, that is an overfitting signal even if avg_score is rising.

## The experiment loop

The experiment runs on a dedicated branch (e.g. `autoresearch/apr10`).

LOOP FOREVER:

1. Look at the git state: the current branch/commit we're on.
2. **Before writing any code, check for duplicates**: grep results.tsv for keywords related to your idea: `grep -i "cooldown" research/results.tsv`. If the same experiment (or a very similar one) appears in the last 50 entries, skip it — you already know the answer. If it appears only in very early entries with a different surrounding config, it may be worth a retest with a clear rationale.
3. Tune `research/strategy.ts` with the idea.
4. `git add research/strategy.ts && git commit -m "experiment: <description>"`
5. Run the experiment: `npx tsx research/run-backtest.ts --all > research/run.log 2>&1` (redirect everything — do NOT use tee or let output flood your context)
6. Read out the results: `grep "^--- avg_score:\|^--- avg_win_rate:\|^--- avg_sharpe:\|^--- total_trades:" research/run.log`
7. If the grep output is empty, the run crashed. Run `tail -n 50 research/run.log` to read the stack trace and attempt a fix. If you can't get things to work after more than a few attempts, give up.
8. **Run the robustness gate**: Count how many per-market `--- score:` values are below -10. If 3 or more markets are below -10, or any single market is below -50, REJECT immediately — `git reset --hard HEAD~1`. Do this before checking avg_score.
9. **Check total_trades**: If `total_trades / datasets < 10`, REJECT. A strategy with 6 trades that wins 4 is statistically meaningless — it cannot generalize.
10. **Suspicious improvement check**: If avg_score improved by more than 5× compared to the previous best (e.g., 900 → 5000), do NOT keep it until you first run live validation. Score explosions are almost always caused by one dataset amplifying compounding all-in bets — not a genuine edge. Run live immediately: `npx tsx research/run-backtest.ts --all --live > research/run.log 2>&1`.
11. Record the results in the tsv (NOTE: do not commit the results.tsv file, leave it untracked by git)
12. If avg_score improved AND passed all gates, you "advance" the branch, keeping the git commit
13. If avg_score is equal or worse, you git reset back to where you started: `git reset --hard HEAD~1`

The idea is that you are a completely autonomous researcher trying things out. If they work, keep. If they don't, discard. And you're advancing the branch so that you can iterate. If you feel like you're getting stuck in some way, you can rewind but you should probably do this very very sparingly (if ever).

**Timeout**: Each experiment should take under 10 seconds (backtests are pure math). If a run exceeds 30 seconds, kill it and treat it as a failure (discard and revert).

**Crashes**: If a run crashes (a bug, type error, etc.), use your judgment: If it's something dumb and easy to fix (e.g. a typo, a missing variable), fix it and re-run. If the idea itself is fundamentally broken, just skip it, log "crash" as the status in the tsv, and move on.

**Live validation (MANDATORY — the real scorecard)**: Every 3-5 improvements, run a live validation session: `npx tsx research/run-backtest.ts --all --live > research/run.log 2>&1`. This connects to the live Deriv API and tests the strategy against **all 5 markets simultaneously** (1HZ100V, 1HZ75V, 1HZ50V, 1HZ25V, 1HZ10V) in parallel — same pattern as data collection. Takes ~5 minutes total. Produces an `avg_live_score` across all markets that is directly comparable to the pre-recorded `avg_score`. Live score is the true performance metric — the bots run against live prices, not pre-recorded ticks.

Extract the live result with:
```
grep "^--- avg_live_score:" research/run.log
```

**Live validation hard rules:**
- If `--- avg_live_score:` is negative, STOP the experiment loop. Revert to the last commit that had a positive live score. Do not continue optimizing the pre-recorded score.
- If `--- avg_live_score:` is more than 50% lower than `--- avg_score:`, the strategy is overfitting. Consider reverting to an earlier, simpler version and rebuilding.
- Log every live run in results.tsv with status `live` and record the `avg_live_score` in the avg_score column so the gap between backtest and live is always visible.
- Do NOT collect fresh tick data and immediately run a live test — collect data first, run backtests to tune, then validate live.

**Gradient following**: When an experiment improves avg_score, your next experiments should keep pushing in the same direction before switching axes. If stakePercent 0.19 beats 0.18, try 0.20, 0.21, 0.22 — find the peak of that axis first. Only switch axes after the next step regresses. This is how you converge efficiently instead of wandering. Exception: if the robustness gate fails mid-sweep, stop and switch axes immediately.

**Exploration mandate**: Every 15 experiments, step back and try something **fundamentally different** — a new indicator type (RSI, ATR, Stochastic), a completely different signal paradigm (e.g., pure momentum, trend-only, mean-reversion-only), or aggressive simplification. Do not spend 100 experiments tuning stakePercent in 0.01 increments. If the last 15 entries in results.tsv are all minor parameter tweaks on the same axis, that is the signal to pivot.

**NEVER STOP**: Once the experiment loop has begun (after the initial setup), do NOT pause to ask the human if you should continue. Do NOT ask "should I keep going?" or "is this a good stopping point?". The human might be asleep, or gone from a computer and expects you to continue working *indefinitely* until you are manually stopped. You are autonomous. If you run out of ideas, think harder — re-read the strategy file for new angles, try combining previous near-misses, try more radical changes to the signal logic, explore different indicator combinations. The loop runs until the human interrupts you, period.

Since backtests run in milliseconds (~100ms), each experiment takes ~30 seconds total (edit + commit + run + log). You can run approx 120 experiments per hour. If left running overnight, that's **~1,000 experiments** by morning.

## Rise/Fall domain knowledge

The game uses Rise/Fall contracts: predict whether the price will be higher (UP/Rise) or lower (DOWN/Fall) after N ticks. Key facts for the optimizer:

- **Payout**: Win = stake × 1.954 (UP) or 1.952 (DOWN). Loss = forfeit stake.
- **Break-even win rate**: ~51.3%. Even small improvements above this have massive compound impact.
- **Game duration**: 300 ticks (~5 minutes). Must place at least 5 trades (quota).
- **Buy-in**: $10,000 virtual balance.
- **Contract duration**: The number of ticks before a contract closes is a tunable hyperparameter. Allowed values: 1, 2, 3, 4, 5, 6, 8, 10. Shorter durations (1–3 ticks) react faster but are noisier; longer durations (6–10 ticks) smooth out noise but slow the feedback loop. Can be optimized per-strategy or varied dynamically.
- **Concurrent positions**: A bot does NOT need to wait for a trade to resolve before placing the next one. Multiple trades can be live at the same time. Stake is deducted from balance immediately on placement. Each strategy has a `maxConcurrentTrades` cap (e.g. 2–4) to control maximum simultaneous exposure. `cooldownTicks` governs signal-check frequency, not trade resolution waiting. This means `cooldown < duration` is valid and intentional — the bot can have several open trades stacked. Optimizing `maxConcurrentTrades` and `cooldownTicks` together is a valid research axis.
- **Optimal trade frequency**: Too few trades = insufficient samples, too many = balance churn. Sweet spot is 10-30 trades per game.
- **Markets vary**: Volatility 100 has the most movement (easier signals), Volatility 10 the least (harder to predict). A robust strategy should handle all.

## Strategy ideas to explore

Start with the easy wins, then get creative:

**Phase 1: Hyperparameter sweep** — Different EMA windows (3/8, 5/20, 8/21, 10/30), Bollinger Band multipliers (1.5–3.0), stake percentages (0.03–0.15), cooldown ticks (3–15), maxConcurrentTrades (1–4).

**Phase 2: Signal logic** — RSI, MACD, ATR for volatility-adaptive sizing, Heikin-Ashi smoothed prices, dynamic signal weights based on recent performance.

**Phase 3: Risk management** — Kelly Criterion staking, drawdown-based sizing, consecutive loss reduction, time-based urgency.

**Phase 3b: Confidence-based position stacking** — The bot does not need to wait for an open contract to close before entering a new one. Use signal strength to decide how many positions to stack simultaneously. A strong signal (e.g., EMA + BB + momentum all aligned) can justify `maxConcurrentTrades = 3–4`; a weak or ambiguous signal should reduce concurrent exposure or skip entirely. Research axes: (a) flat `maxConcurrentTrades` sweep (1, 2, 3, 4); (b) dynamic concurrent cap scaled by a composite signal score; (c) pairing `cooldownTicks < duration` so the bot can enter follow-on positions while the first is still live, amplifying wins on trending sequences. Robustness gate applies per-trade not per-tick — watch total_trades count carefully, as stacking can inflate trade counts without adding information.

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

# Extract all key metrics (including trade count for gate check)
grep "^--- avg_score:\|^--- avg_win_rate:\|^--- avg_sharpe:\|^--- total_trades:" research/run.log

# Check for duplicate experiments before trying something
grep -i "keyword" research/results.tsv

# Run with live validation (all 5 markets in parallel, adds ~5 min)
npx tsx research/run-backtest.ts --all --live > research/run.log 2>&1

# Extract live result
grep "^--- avg_live_score:\|^--- live_vs_recorded:\|^--- live_warning:\|^--- overfitting_warning:" research/run.log

# Discard failed experiment
git reset --hard HEAD~1
```
