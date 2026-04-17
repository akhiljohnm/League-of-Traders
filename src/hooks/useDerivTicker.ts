"use client";

// All consumers share one WebSocket connection via DerivTickerProvider.
// Call `setSymbol()` to switch the provider to a different market.

import { useDerivTickerContext } from "@/providers/DerivTickerProvider";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useDerivTicker(_options?: { symbol?: string; autoConnect?: boolean }) {
  return useDerivTickerContext();
}
