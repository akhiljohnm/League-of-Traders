"use client";

import { useState, useEffect, useRef } from "react";
import type {
  DerivTicksHistoryRequest,
  DerivTicksHistoryResponse,
  DerivErrorMessage,
} from "@/lib/types/deriv";

const WS_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL!;

interface UseTickHistoryOptions {
  symbol: string;
  count?: number;
  autoFetch?: boolean;
}

interface UseTickHistoryReturn {
  prices: number[];
  times: number[];
  isLoading: boolean;
  error: string | null;
  pipSize: number;
}

/**
 * Hook to fetch historical tick data from Deriv API
 * Fetches once on mount, returns the price/time arrays
 */
export function useTickHistory(
  options: UseTickHistoryOptions
): UseTickHistoryReturn {
  const { symbol, count = 100, autoFetch = true } = options;

  const [prices, setPrices] = useState<number[]>([]);
  const [times, setTimes] = useState<number[]>([]);
  const [pipSize, setPipSize] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    if (!autoFetch || fetchedRef.current) {
      return;
    }

    fetchedRef.current = true;
    setIsLoading(true);
    setError(null);

    console.log(
      `[useTickHistory] Fetching ${count} ticks for ${symbol}`
    );

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      if (!mountedRef.current) return;

      const request: DerivTicksHistoryRequest = {
        ticks_history: symbol,
        adjust_start_time: 1,
        count,
        end: "latest",
        start: 1,
        style: "ticks",
        req_id: 100,
      };

      ws.send(JSON.stringify(request));
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data);

        // Handle errors
        if (data.error) {
          const errMsg = data as DerivErrorMessage;
          console.error(
            `[useTickHistory] Error: ${errMsg.error.code} — ${errMsg.error.message}`
          );
          setError(`${errMsg.error.code}: ${errMsg.error.message}`);
          setIsLoading(false);
          ws.close();
          return;
        }

        // Handle history response
        if (data.msg_type === "history") {
          const historyMsg = data as DerivTicksHistoryResponse;

          setPrices(historyMsg.history.prices);
          setTimes(historyMsg.history.times);
          setPipSize(historyMsg.pip_size);
          setIsLoading(false);

          console.log(
            `[useTickHistory] Loaded ${historyMsg.history.prices.length} ticks for ${symbol}`
          );

          // Close connection after receiving data
          ws.close();
        }
      } catch (e) {
        console.error("[useTickHistory] Failed to parse message:", e);
        setError("Failed to parse history response");
        setIsLoading(false);
        ws.close();
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      console.error("[useTickHistory] WebSocket error");
      setError("WebSocket connection error");
      setIsLoading(false);
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      console.log("[useTickHistory] WebSocket closed");
    };

    return () => {
      mountedRef.current = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [symbol, count, autoFetch]);

  return {
    prices,
    times,
    isLoading,
    error,
    pipSize,
  };
}
