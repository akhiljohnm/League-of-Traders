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

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const PER_ATTEMPT_TIMEOUT_MS = 10_000;

/**
 * Hook to fetch historical tick data from Deriv API
 * Fetches once on mount with retry logic, returns the price/time arrays
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

    let ws: WebSocket | null = null;
    let attemptTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function attempt(retryCount: number) {
      if (!mountedRef.current) return;

      console.log(
        `[useTickHistory] Fetching ${count} ticks for ${symbol} (attempt ${retryCount + 1}/${MAX_RETRIES})`
      );

      ws = new WebSocket(WS_URL);

      attemptTimeout = setTimeout(() => {
        if (mountedRef.current && ws) {
          console.warn("[useTickHistory] Attempt timed out, closing...");
          ws.close();
        }
      }, PER_ATTEMPT_TIMEOUT_MS);

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

        ws!.send(JSON.stringify(request));
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;

        try {
          const data = JSON.parse(event.data);

          if (data.error) {
            const errMsg = data as DerivErrorMessage;
            console.error(
              `[useTickHistory] Error: ${errMsg.error.code} — ${errMsg.error.message}`
            );
            setError(`${errMsg.error.code}: ${errMsg.error.message}`);
            setIsLoading(false);
            if (attemptTimeout) clearTimeout(attemptTimeout);
            ws?.close();
            return;
          }

          if (data.msg_type === "history") {
            const historyMsg = data as DerivTicksHistoryResponse;

            setPrices(historyMsg.history.prices);
            setTimes(historyMsg.history.times);
            setPipSize(historyMsg.pip_size);
            setIsLoading(false);
            setError(null);

            console.log(
              `[useTickHistory] Loaded ${historyMsg.history.prices.length} ticks for ${symbol}`
            );

            if (attemptTimeout) clearTimeout(attemptTimeout);
            ws?.close();
          }
        } catch (e) {
          console.error("[useTickHistory] Failed to parse message:", e);
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        if (attemptTimeout) clearTimeout(attemptTimeout);

        if (retryCount + 1 < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
          console.warn(
            `[useTickHistory] Connection failed — retrying in ${delay}ms...`
          );
          setError(`Loading chart history (retry ${retryCount + 1}/${MAX_RETRIES})...`);
          retryTimeout = setTimeout(() => attempt(retryCount + 1), delay);
        } else {
          console.error("[useTickHistory] All retries exhausted");
          setError("Failed to load chart history after multiple attempts");
          setIsLoading(false);
        }
      };

      ws.onclose = () => {
        if (attemptTimeout) clearTimeout(attemptTimeout);
      };
    }

    attempt(0);

    return () => {
      mountedRef.current = false;
      if (attemptTimeout) clearTimeout(attemptTimeout);
      if (retryTimeout) clearTimeout(retryTimeout);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
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
