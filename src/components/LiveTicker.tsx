"use client";

import { useDerivTicker } from "@/hooks/useDerivTicker";
import { DERIV_SYMBOL_NAME, DERIV_SYMBOL_VOL_100 } from "@/lib/types/deriv";

export default function LiveTicker() {
  const { currentTick, previousTick, isConnected, connectionState, tickCount } =
    useDerivTicker({ symbol: DERIV_SYMBOL_VOL_100 });

  const priceDirection =
    currentTick && previousTick
      ? currentTick.quote > previousTick.quote
        ? "up"
        : currentTick.quote < previousTick.quote
          ? "down"
          : "flat"
      : "flat";

  const priceColor =
    priceDirection === "up"
      ? "text-alpha-green"
      : priceDirection === "down"
        ? "text-rekt-crimson"
        : "text-text-primary";

  const glowClass =
    priceDirection === "up"
      ? "glow-green"
      : priceDirection === "down"
        ? "glow-red"
        : "";

  const arrow =
    priceDirection === "up" ? "\u25B2" : priceDirection === "down" ? "\u25BC" : "";

  return (
    <div className="inline-flex flex-col items-center gap-1 bg-bg-surface border border-border-default rounded-xl px-6 py-4">
      {/* Connection status */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-alpha-green animate-live-pulse" : "bg-rekt-crimson"
          }`}
        />
        <span className="text-[10px] text-text-muted uppercase tracking-widest font-mono-numbers">
          {isConnected
            ? DERIV_SYMBOL_NAME[DERIV_SYMBOL_VOL_100] || DERIV_SYMBOL_VOL_100
            : connectionState}
        </span>
      </div>

      {/* Price */}
      {currentTick ? (
        <>
          <div className={`font-mono-numbers text-3xl font-bold ${priceColor} ${glowClass} transition-colors duration-150`}>
            {arrow && <span className="text-lg mr-1">{arrow}</span>}
            {currentTick.quote.toFixed(currentTick.pip_size)}
          </div>
          <div className="flex items-center gap-4 text-[10px] text-text-muted font-mono-numbers">
            <span>ASK {currentTick.ask.toFixed(currentTick.pip_size)}</span>
            <span>BID {currentTick.bid.toFixed(currentTick.pip_size)}</span>
            <span>TICKS {tickCount}</span>
          </div>
        </>
      ) : (
        <div className="font-mono-numbers text-2xl text-text-muted animate-pulse">
          {isConnected ? "Waiting for tick..." : "Connecting..."}
        </div>
      )}
    </div>
  );
}
