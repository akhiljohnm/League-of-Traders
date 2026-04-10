"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  DerivTick,
  DerivConnectionState,
  DerivTickMessage,
  DerivErrorMessage,
} from "@/lib/types/deriv";
import { DERIV_SYMBOL_VOL_100 } from "@/lib/types/deriv";

const WS_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL!;
const PING_INTERVAL_MS = 25_000; // 25s per best practices (< 30s)
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

interface UseDerivTickerOptions {
  symbol?: string;
  autoConnect?: boolean;
}

interface UseDerivTickerReturn {
  currentTick: DerivTick | null;
  previousTick: DerivTick | null;
  isConnected: boolean;
  connectionState: DerivConnectionState;
  error: string | null;
  tickCount: number;
}

export function useDerivTicker(
  options: UseDerivTickerOptions = {}
): UseDerivTickerReturn {
  const { symbol = DERIV_SYMBOL_VOL_100, autoConnect = true } = options;

  const [currentTick, setCurrentTick] = useState<DerivTick | null>(null);
  const [previousTick, setPreviousTick] = useState<DerivTick | null>(null);
  const [connectionState, setConnectionState] =
    useState<DerivConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [tickCount, setTickCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const subscriptionIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    cleanup();

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect loop
      wsRef.current.close();
    }

    setConnectionState(
      reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting"
    );
    setError(null);

    console.log(
      `[Deriv Oracle] Connecting to ${WS_URL} (attempt ${reconnectAttemptRef.current + 1})`
    );

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;

      console.log("[Deriv Oracle] WebSocket connected");
      setConnectionState("connected");
      reconnectAttemptRef.current = 0;

      // Subscribe to tick stream
      const subscribeMsg = {
        ticks: symbol,
        subscribe: 1,
        req_id: 1,
      };
      ws.send(JSON.stringify(subscribeMsg));
      console.log(`[Deriv Oracle] Subscribed to ${symbol} ticks`);

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: 1 }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data);

        // Handle errors
        if (data.error) {
          const errMsg = data as DerivErrorMessage;
          console.error(
            `[Deriv Oracle] Error: ${errMsg.error.code} — ${errMsg.error.message}`
          );
          setError(`${errMsg.error.code}: ${errMsg.error.message}`);
          return;
        }

        // Handle tick data
        if (data.msg_type === "tick") {
          const tickMsg = data as DerivTickMessage;

          // Store subscription ID for cleanup
          if (tickMsg.subscription?.id) {
            subscriptionIdRef.current = tickMsg.subscription.id;
          }

          setCurrentTick((prev) => {
            setPreviousTick(prev);
            return tickMsg.tick;
          });
          setTickCount((c) => c + 1);
        }

        // Handle ping response (silent)
        if (data.msg_type === "ping") {
          // Connection alive — no action needed
        }
      } catch (e) {
        console.error("[Deriv Oracle] Failed to parse message:", e);
      }
    };

    ws.onerror = (event) => {
      if (!mountedRef.current) return;
      console.error("[Deriv Oracle] WebSocket error:", event);
      setError("WebSocket connection error");
      setConnectionState("error");
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;

      console.log(
        `[Deriv Oracle] WebSocket closed (code: ${event.code}, reason: ${event.reason})`
      );
      cleanup();
      subscriptionIdRef.current = null;

      // Reconnect with exponential backoff
      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY_MS
      );
      reconnectAttemptRef.current += 1;
      setConnectionState("reconnecting");

      console.log(`[Deriv Oracle] Reconnecting in ${delay}ms...`);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };
  }, [symbol, cleanup]);

  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      cleanup();

      // Clean unsubscribe before closing
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log("[Deriv Oracle] Cleaning up subscriptions...");
        wsRef.current.send(
          JSON.stringify({ forget_all: ["ticks"], req_id: 99 })
        );
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, [autoConnect, connect]);

  return {
    currentTick,
    previousTick,
    isConnected: connectionState === "connected",
    connectionState,
    error,
    tickCount,
  };
}
