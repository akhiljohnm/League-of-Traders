"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type {
  DerivTick,
  DerivConnectionState,
  DerivTickMessage,
  DerivErrorMessage,
} from "@/lib/types/deriv";
import { DERIV_SYMBOL_VOL_100 } from "@/lib/types/deriv";

const WS_URL = process.env.NEXT_PUBLIC_DERIV_WS_URL!;
const PING_INTERVAL_MS = 25_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

export interface DerivTickerContextValue {
  currentTick: DerivTick | null;
  previousTick: DerivTick | null;
  isConnected: boolean;
  connectionState: DerivConnectionState;
  error: string | null;
  tickCount: number;
  symbol: string;
  setSymbol: (symbol: string) => void;
}

export const DerivTickerContext = createContext<DerivTickerContextValue>({
  currentTick: null,
  previousTick: null,
  isConnected: false,
  connectionState: "disconnected",
  error: null,
  tickCount: 0,
  symbol: DERIV_SYMBOL_VOL_100,
  setSymbol: () => {},
});

export function DerivTickerProvider({ children }: { children: ReactNode }) {
  const [currentTick, setCurrentTick] = useState<DerivTick | null>(null);
  const [previousTick, setPreviousTick] = useState<DerivTick | null>(null);
  const [connectionState, setConnectionState] =
    useState<DerivConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [tickCount, setTickCount] = useState(0);
  const [symbol, setSymbolState] = useState(DERIV_SYMBOL_VOL_100);

  // Use a ref so the connect() callback always reads the latest symbol
  const symbolRef = useRef(symbol);

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
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

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const targetSymbol = symbolRef.current;

    setConnectionState(
      reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting"
    );
    setError(null);

    console.log(
      `[Deriv Oracle] Connecting to ${WS_URL} for ${targetSymbol} (attempt ${reconnectAttemptRef.current + 1})`
    );

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      console.log(`[Deriv Oracle] WebSocket connected — subscribing to ${targetSymbol}`);
      setConnectionState("connected");
      reconnectAttemptRef.current = 0;

      ws.send(
        JSON.stringify({ ticks: targetSymbol, subscribe: 1, req_id: 1 })
      );

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

        if (data.error) {
          const errMsg = data as DerivErrorMessage;
          console.error(
            `[Deriv Oracle] Error: ${errMsg.error.code} — ${errMsg.error.message}`
          );
          setError(`${errMsg.error.code}: ${errMsg.error.message}`);
          return;
        }

        if (data.msg_type === "tick") {
          const tickMsg = data as DerivTickMessage;
          setCurrentTick((prev) => {
            setPreviousTick(prev);
            return tickMsg.tick;
          });
          setTickCount((c) => c + 1);
        }
      } catch (e) {
        console.error("[Deriv Oracle] Failed to parse message:", e);
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setError("WebSocket connection error");
      setConnectionState("error");
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;
      console.log(
        `[Deriv Oracle] WebSocket closed (code: ${event.code})`
      );
      cleanup();

      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptRef.current),
        MAX_RECONNECT_DELAY_MS
      );
      reconnectAttemptRef.current += 1;
      setConnectionState("reconnecting");
      console.log(`[Deriv Oracle] Reconnecting in ${delay}ms…`);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };
  }, [cleanup]);

  // Exposed setter: update both state and ref, then reconnect
  const setSymbol = useCallback(
    (newSymbol: string) => {
      if (newSymbol === symbolRef.current) return;
      console.log(`[Deriv Oracle] Switching symbol: ${symbolRef.current} → ${newSymbol}`);
      symbolRef.current = newSymbol;
      setSymbolState(newSymbol);
      // Reset tick state for the new symbol
      setCurrentTick(null);
      setPreviousTick(null);
      setTickCount(0);
      reconnectAttemptRef.current = 0;
      connect();
    },
    [connect]
  );

  // Initial connection on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ forget_all: ["ticks"], req_id: 99 })
        );
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, [connect, cleanup]);

  return (
    <DerivTickerContext.Provider
      value={{
        currentTick,
        previousTick,
        isConnected: connectionState === "connected",
        connectionState,
        error,
        tickCount,
        symbol,
        setSymbol,
      }}
    >
      {children}
    </DerivTickerContext.Provider>
  );
}

export function useDerivTickerContext(): DerivTickerContextValue {
  return useContext(DerivTickerContext);
}
