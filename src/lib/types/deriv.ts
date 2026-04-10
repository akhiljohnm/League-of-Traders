// ============================================================
// Deriv API V2 Types — Matches llms.md spec exactly
// ============================================================

// ---- Tick Stream ----

export interface DerivTick {
  ask: number;
  bid: number;
  epoch: number;
  id: string;
  pip_size: number;
  quote: number;
  symbol: string;
}

export interface DerivTickMessage {
  tick: DerivTick;
  msg_type: "tick";
  subscription?: { id: string };
}

// ---- Active Symbols ----

export interface DerivActiveSymbol {
  underlying_symbol: string;
  underlying_symbol_name: string;
  underlying_symbol_type: string;
  market: string;
  submarket: string;
  subgroup: string;
  pip_size: number;
  exchange_is_open: number;
  is_trading_suspended: number;
  trade_count: number;
}

export interface DerivActiveSymbolsMessage {
  active_symbols: DerivActiveSymbol[];
  msg_type: "active_symbols";
  req_id?: number;
}

// ---- Error ----

export interface DerivErrorMessage {
  error: {
    code: string;
    message: string;
  };
  msg_type: string;
  req_id?: number;
}

// ---- System ----

export interface DerivPingMessage {
  ping: "pong";
  msg_type: "ping";
}

export interface DerivTimeMessage {
  time: number;
  msg_type: "time";
}

// ---- Subscription Management ----

export interface DerivForgetMessage {
  forget: 1;
  msg_type: "forget";
}

export interface DerivForgetAllMessage {
  forget_all: string[];
  msg_type: "forget_all";
}

// ---- Union type for all inbound messages ----

export type DerivMessage =
  | DerivTickMessage
  | DerivActiveSymbolsMessage
  | DerivErrorMessage
  | DerivPingMessage
  | DerivTimeMessage
  | DerivForgetMessage
  | DerivForgetAllMessage;

// ---- Connection State ----

export type DerivConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

// ---- Default Symbol ----

export const DERIV_SYMBOL_VOL_100 = "1HZ100V";
export const DERIV_SYMBOL_NAME: Record<string, string> = {
  "1HZ100V": "Volatility 100 Index",
  "1HZ75V": "Volatility 75 Index",
  "1HZ50V": "Volatility 50 Index",
  "1HZ25V": "Volatility 25 Index",
  "1HZ10V": "Volatility 10 Index",
};
