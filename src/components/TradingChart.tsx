"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import { useTickHistory } from "@/hooks/useTickHistory";
import { supabase } from "@/lib/supabase";
import type { DerivTick } from "@/lib/types/deriv";
import type { PlayerBalance } from "@/hooks/useGameEngine";
import type { Trade } from "@/lib/types/database";

// ============================================================
// TradingChart — Real-time price chart with player trade markers
// ============================================================

interface TradingChartProps {
  symbol: string;
  currentTick: DerivTick | null;
  playerBalances: PlayerBalance[];
  lobbyId: string;
}

// Player color palette (distinct, vibrant colors for markers)
const PLAYER_COLORS = [
  "#00FFA3", // Alpha Green
  "#00E5FF", // Safety Cyan
  "#FF3366", // Rekt Crimson
  "#FFD700", // Gold
  "#FF00FF", // Magenta
  "#00FF00", // Lime
  "#FF8C00", // Dark Orange
  "#9370DB", // Medium Purple
];

export default function TradingChart({
  symbol,
  currentTick,
  playerBalances,
  lobbyId,
}: TradingChartProps) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Track if component is mounted (client-side only)
  const [isMounted, setIsMounted] = useState(false);

  // Fetch historical ticks
  const { prices, times, isLoading, error: historyError } = useTickHistory({
    symbol,
    count: 100,
    autoFetch: true,
  });

  // Track chart data
  const [chartData, setChartData] = useState<LineData[]>([]);

  // Ensure we're on the client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Callback ref - called when the container div is mounted
  const chartContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !isMounted || chartRef.current) return;

    const containerWidth = node.clientWidth;
    const containerHeight = node.clientHeight;

    if (containerWidth === 0 || containerHeight === 0) {
      console.error(`[TradingChart] Container has zero dimensions!`);
      return;
    }

    const chart = createChart(node, {
      width: containerWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: "#09090B" },
        textColor: "#71717A",
      },
      grid: {
        vertLines: { color: "#18181B" },
        horzLines: { color: "#18181B" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#00E5FF",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#00E5FF",
        },
        horzLine: {
          color: "#00E5FF",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#00E5FF",
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "#27272A",
      },
      rightPriceScale: {
        borderColor: "#27272A",
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const areaSeries = chart.addAreaSeries({
      topColor: "rgba(0, 255, 163, 0.4)", // Alpha Green with transparency
      bottomColor: "rgba(0, 255, 163, 0.0)", // Fade to transparent
      lineColor: "#00FFA3", // Bright green line
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 6,
      crosshairMarkerBorderColor: "#00FFA3",
      crosshairMarkerBackgroundColor: "#09090B",
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    chart.priceScale("right").applyOptions({
      autoScale: true,
      scaleMargins: {
        top: 0.1,
        bottom: 0.1,
      },
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    // Setup resize observer
    resizeObserverRef.current = new ResizeObserver((entries) => {
      if (chartRef.current && entries[0]) {
        const { width } = entries[0].contentRect;
        chartRef.current.applyOptions({ width });
      }
    });
    resizeObserverRef.current.observe(node);
  }, [isMounted]);

  // All trades in this lobby (for markers)
  const [allTrades, setAllTrades] = useState<Trade[]>([]);

  // Player color mapping
  const playerColorMap = useRef<Map<string, string>>(new Map());

  // ---- Assign colors to players (only when count changes) ----
  useEffect(() => {
    playerBalances.forEach((p, i) => {
      if (!playerColorMap.current.has(p.playerId)) {
        playerColorMap.current.set(
          p.playerId,
          PLAYER_COLORS[i % PLAYER_COLORS.length]
        );
      }
    });
  }, [playerBalances.length]); // Dependency: only re-run when player count changes

  // ---- Load all trades for this lobby ----
  useEffect(() => {
    async function loadTrades() {
      const { data } = await supabase
        .from("trades")
        .select("*")
        .eq("lobby_id", lobbyId)
        .order("created_at", { ascending: true });

      if (data) {
        setAllTrades(data as Trade[]);
      }
    }

    loadTrades();
  }, [lobbyId]);

  // ---- Subscribe to real-time trade updates ----
  useEffect(() => {
    const channel = supabase
      .channel(`chart-trades-${lobbyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trades",
          filter: `lobby_id=eq.${lobbyId}`,
        },
        (payload) => {
          const newTrade = payload.new as Trade;
          setAllTrades((prev) => [...prev, newTrade]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trades",
          filter: `lobby_id=eq.${lobbyId}`,
        },
        (payload) => {
          const updatedTrade = payload.new as Trade;
          setAllTrades((prev) =>
            prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  // ---- Load historical data into chart ----
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) {
      return;
    }

    if (prices.length === 0 || times.length === 0) {
      return;
    }

    if (prices.length !== times.length) {
      console.error(`[TradingChart] Data mismatch! prices: ${prices.length}, times: ${times.length}`);
      return;
    }

    try {
      const data: LineData[] = prices.map((price, i) => ({
        time: times[i] as Time,
        value: price,
      }));

      // Set the data
      seriesRef.current.setData(data);
      setChartData(data);

      // Auto-fit the chart viewport to show all data
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (error) {
      console.error(`[TradingChart] Error loading data:`, error);
    }
  }, [prices, times]);

  // ---- Update chart with live tick ----
  useEffect(() => {
    if (!seriesRef.current || !currentTick) return;

    const newPoint: LineData = {
      time: currentTick.epoch as Time,
      value: currentTick.quote,
    };

    seriesRef.current.update(newPoint);
    setChartData((prev) => [...prev, newPoint]);
  }, [currentTick]);

  // ---- Render trade markers ----
  useEffect(() => {
    if (!seriesRef.current || chartData.length === 0 || allTrades.length === 0) return;

    const markers: any[] = [];

    allTrades.forEach((trade) => {
      const color = playerColorMap.current.get(trade.player_id) || "#00FFA3";

      // Convert ISO timestamp to Unix epoch (seconds)
      const entryTime = Math.floor(new Date(trade.created_at).getTime() / 1000) as Time;

      // Entry marker (always render)
      markers.push({
        time: entryTime,
        position: "belowBar",
        color,
        shape: trade.direction === "UP" ? "arrowUp" : "arrowDown",
        text: `${trade.direction} $${trade.stake.toFixed(0)}`,
      });

      // Exit marker (only for resolved trades)
      if (trade.status !== "open" && trade.resolved_at && trade.exit_price !== null) {
        const exitTime = Math.floor(new Date(trade.resolved_at).getTime() / 1000) as Time;
        const exitColor = trade.status === "won" ? "#00FFA3" : "#FF3366";

        // Calculate display payout
        const displayPayout = trade.payout !== null
          ? (trade.status === "won" ? trade.payout : -trade.stake)
          : 0;

        markers.push({
          time: exitTime,
          position: "aboveBar",
          color: exitColor,
          shape: "circle",
          text: trade.status === "won"
            ? `+$${displayPayout.toFixed(0)}`
            : `-$${trade.stake.toFixed(0)}`,
        });
      }
    });

    seriesRef.current.setMarkers(markers);
  }, [allTrades, chartData]);

  if (isLoading) {
    return (
      <div className="bg-bg-surface border border-border-default rounded-xl p-8 text-center">
        <div className="w-12 h-12 border-2 border-safety-cyan/20 rounded-full mx-auto mb-4 relative">
          <div className="absolute inset-0 w-12 h-12 border-2 border-safety-cyan border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="text-text-secondary text-sm">Loading chart data...</div>
      </div>
    );
  }

  if (historyError) {
    return (
      <div className="bg-rekt-crimson/10 border border-rekt-crimson/30 rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-rekt-crimson shrink-0" />
        <span className="text-rekt-crimson text-sm font-medium">
          Chart error: {historyError}
        </span>
      </div>
    );
  }

  // Don't render chart container until client-side
  if (!isMounted) {
    return (
      <div className="bg-bg-surface border border-border-default rounded-xl p-8 text-center">
        <div className="w-12 h-12 border-2 border-safety-cyan/20 rounded-full mx-auto mb-4 relative">
          <div className="absolute inset-0 w-12 h-12 border-2 border-safety-cyan border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="text-text-secondary text-sm">Initializing chart...</div>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-primary font-bold text-sm flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          LIVE CHART
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-alpha-green animate-live-pulse" />
          <span className="text-[10px] text-text-muted uppercase tracking-wider">
            {chartData.length} TICKS
          </span>
        </div>
      </div>
      <div
        ref={chartContainerRef}
        className="relative w-full overflow-hidden"
        style={{
          height: "400px",
          minHeight: "400px",
          background: "#09090B"
        }}
      />
    </div>
  );
}
