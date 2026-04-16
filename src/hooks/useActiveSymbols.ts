"use client";

import { useState, useEffect, useRef } from "react";
import type { DerivActiveSymbol } from "@/lib/types/deriv";

const WS_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL!;

export interface MarketGroup {
  market: string;
  submarkets: {
    submarket: string;
    symbols: DerivActiveSymbol[];
  }[];
}

// Human-friendly labels for market/submarket keys
const MARKET_LABELS: Record<string, string> = {
  synthetic_index: "Synthetic Indices",
  forex: "Forex",
  indices: "Stock Indices",
  commodities: "Commodities",
  cryptocurrency: "Cryptocurrencies",
};

const SUBMARKET_LABELS: Record<string, string> = {
  random_index: "Volatility Indices",
  random_daily: "Daily Reset Indices",
  random_walk: "Random Walk",
  crash_boom: "Crash/Boom",
  step_index: "Step Index",
  major_pairs: "Major Pairs",
  minor_pairs: "Minor Pairs",
  smart_fx: "Smart FX",
  americas: "Americas",
  europe_africa: "Europe & Africa",
  asia_oceania: "Asia & Oceania",
  metals: "Metals",
  energy: "Energy",
};

export function getMarketLabel(key: string): string {
  return MARKET_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getSubmarketLabel(key: string): string {
  return SUBMARKET_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface UseActiveSymbolsReturn {
  symbols: DerivActiveSymbol[];
  grouped: MarketGroup[];
  isLoading: boolean;
  error: string | null;
}

export function useActiveSymbols(): UseActiveSymbolsReturn {
  const [symbols, setSymbols] = useState<DerivActiveSymbol[]>([]);
  const [grouped, setGrouped] = useState<MarketGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;

    console.log("[ActiveSymbols] Fetching from Deriv API...");
    ws = new WebSocket(WS_URL);

    const timeout = setTimeout(() => {
      if (!cancelled && ws) {
        ws.close();
        setError("Timed out fetching markets");
        setIsLoading(false);
      }
    }, 15_000);

    ws.onopen = () => {
      if (cancelled) { ws?.close(); return; }
      ws!.send(JSON.stringify({ active_symbols: "brief", req_id: 1 }));
    };

    ws.onmessage = (event: MessageEvent) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(event.data);

        if (data.error) {
          console.error("[ActiveSymbols] API error:", data.error);
          setError(data.error.message);
          setIsLoading(false);
          ws?.close();
          clearTimeout(timeout);
          return;
        }

        if (data.msg_type === "active_symbols") {
          const all: DerivActiveSymbol[] = data.active_symbols;

          // Filter: only open, non-suspended markets
          const active = all.filter(
            (s) => s.exchange_is_open === 1 && s.is_trading_suspended === 0
          );

          console.log(
            `[ActiveSymbols] Received ${all.length} symbols, ${active.length} active`
          );

          setSymbols(active);
          setGrouped(groupByMarket(active));
          setIsLoading(false);
          clearTimeout(timeout);
          ws?.close();
        }
      } catch (e) {
        console.error("[ActiveSymbols] Parse error:", e);
      }
    };

    ws.onerror = (event) => {
      if (cancelled) return;
      console.error("[ActiveSymbols] WebSocket error:", event);
      setError("Failed to connect to Deriv API");
      setIsLoading(false);
      clearTimeout(timeout);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
    };

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, []);

  return { symbols, grouped, isLoading, error };
}

// Markets and submarkets excluded from Rise/Fall game mode
const BLOCKED_MARKETS = new Set(["cryptocurrency"]);
const BLOCKED_SUBMARKETS = new Set(["crash_boom"]);
// Symbol names containing these keywords are also excluded
const BLOCKED_NAME_KEYWORDS = [/crash/i, /boom/i];

function groupByMarket(symbols: DerivActiveSymbol[]): MarketGroup[] {
  const marketMap = new Map<string, Map<string, DerivActiveSymbol[]>>();

  for (const sym of symbols) {
    if (BLOCKED_MARKETS.has(sym.market)) continue;
    if (BLOCKED_SUBMARKETS.has(sym.submarket)) continue;
    if (BLOCKED_NAME_KEYWORDS.some((re) => re.test(sym.underlying_symbol_name))) continue;

    if (!marketMap.has(sym.market)) {
      marketMap.set(sym.market, new Map());
    }
    const subMap = marketMap.get(sym.market)!;
    if (!subMap.has(sym.submarket)) {
      subMap.set(sym.submarket, []);
    }
    subMap.get(sym.submarket)!.push(sym);
  }

  // Sort: synthetic_index first, then alphabetically
  const marketOrder = ["synthetic_index", "forex", "commodities", "indices"];

  return Array.from(marketMap.entries())
    .sort(([a], [b]) => {
      const ai = marketOrder.indexOf(a);
      const bi = marketOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    })
    .map(([market, subMap]) => ({
      market,
      submarkets: Array.from(subMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([submarket, syms]) => ({
          submarket,
          symbols: syms.sort((a, b) =>
            a.underlying_symbol_name.localeCompare(b.underlying_symbol_name)
          ),
        })),
    }));
}
