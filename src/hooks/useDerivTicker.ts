"use client";

// All consumers share one WebSocket connection via DerivTickerProvider.
// The `options` argument is accepted for API compatibility but ignored —
// the provider is locked to DERIV_SYMBOL_VOL_100.

import { useDerivTickerContext } from "@/providers/DerivTickerProvider";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useDerivTicker(_options?: { symbol?: string; autoConnect?: boolean }) {
  return useDerivTickerContext();
}
