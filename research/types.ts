// ============================================================
// Auto-Research Types — Standalone, no Next.js dependencies
// ============================================================

/** Minimal tick representation for backtest replay */
export interface Tick {
  quote: number;
  epoch: number;
  symbol: string;
}

/** Recorded tick dataset metadata */
export interface TickDataset {
  symbol: string;
  collected_at: string;
  tick_count: number;
  duration_seconds: number;
  ticks: Tick[];
}

/** A trade decision produced by the strategy */
export interface TradeDecision {
  direction: "UP" | "DOWN";
  stake: number;
}

/** The strategy interface the optimizer works with */
export interface StrategyInstance {
  readonly name: string;
  onTick(tick: Tick, balance: number, buyIn: number): TradeDecision | null;
  reset(): void;
}

/** A single simulated trade during backtest */
export interface SimulatedTrade {
  entryPrice: number;
  exitPrice: number;
  direction: "UP" | "DOWN";
  stake: number;
  won: boolean;
  grossPayout: number;
  netPnl: number;
  entryTick: number;
  exitTick: number;
}

/** Structured output from a backtest run */
export interface BacktestResult {
  // Primary metric (the one the optimizer maximizes)
  score: number;

  // Breakdown
  net_pnl: number;
  final_balance: number;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  sharpe_ratio: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  profit_factor: number;

  // Meta
  strategy_name: string;
  ticks_processed: number;
  trades: SimulatedTrade[];
}
