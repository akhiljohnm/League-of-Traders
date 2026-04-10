"use client";

import { useState, useEffect, useRef } from "react";
import {
  useGameEngine,
  type PlayerBalance,
  type PendingHumanTrade,
  type ResolvedTrade,
  type GamePhase,
} from "@/hooks/useGameEngine";
import type { PayoutSummary } from "@/lib/game/payout-engine";
import { TICK_DURATION_OPTIONS, RISE_PAYOUT, FALL_PAYOUT } from "@/lib/game/rise-fall";
import type { Player, LobbyPlayer, TradeDirection } from "@/lib/types/database";
import type { DerivTick } from "@/lib/types/deriv";

// ============================================================
// GameView — The full trading cockpit UI
// ============================================================

interface GameViewProps {
  lobbyId: string;
  symbol: string;
  currentPlayer: Player;
  allPlayers: (LobbyPlayer & { player: Player })[];
  buyIn: number;
  onGameEnd: (summary: PayoutSummary) => void;
}

export default function GameView({
  lobbyId,
  symbol,
  currentPlayer,
  allPlayers,
  buyIn,
  onGameEnd,
}: GameViewProps) {
  const engine = useGameEngine({
    lobbyId,
    symbol,
    currentPlayer,
    allPlayers,
    buyIn,
  });

  const [selectedTicks, setSelectedTicks] = useState(5);
  const [stakeInput, setStakeInput] = useState("");

  // Transition to post-game once payout is calculated
  const postGameCalledRef = useRef(false);
  useEffect(() => {
    if (
      engine.gamePhase === "finished" &&
      engine.payoutSummary &&
      !postGameCalledRef.current
    ) {
      postGameCalledRef.current = true;
      onGameEnd(engine.payoutSummary);
    }
  }, [engine.gamePhase, engine.payoutSummary, onGameEnd]);

  const stake = parseFloat(stakeInput) || 0;
  const potentialWinRise = Math.round(stake * RISE_PAYOUT * 100) / 100;
  const potentialWinFall = Math.round(stake * FALL_PAYOUT * 100) / 100;

  const handleTrade = async (direction: TradeDirection) => {
    if (stake <= 0 || stake > engine.humanBalance || !engine.canTrade) return;
    await engine.placeHumanTrade(direction, stake, selectedTicks);
    setStakeInput("");
  };

  const setStakePercent = (pct: number) => {
    const val = Math.floor(engine.humanBalance * pct * 100) / 100;
    setStakeInput(val > 0 ? val.toString() : "");
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Game Header */}
      <GameHeader
        timeRemainingMs={engine.timeRemainingMs}
        symbol={symbol}
        isConnected={engine.isConnected}
        gamePhase={engine.gamePhase}
        tickCount={engine.tickCount}
      />

      {/* Disconnect Warning */}
      {!engine.isConnected && engine.gamePhase === "active" && (
        <div className="bg-rekt-crimson/10 border border-rekt-crimson/30 rounded-xl px-4 py-3 mt-4 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-rekt-crimson animate-live-pulse shrink-0" />
          <span className="text-rekt-crimson text-sm font-medium">
            Connection lost — reconnecting to Deriv Oracle...
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {/* Left: Price + Trading Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Price Display */}
          <PriceDisplay
            currentTick={engine.currentTick}
            previousTick={engine.previousTick}
          />

          {/* Player Stats Bar */}
          <PlayerStatsBar
            balance={engine.humanBalance}
            initialBalance={buyIn}
            tradeCount={engine.humanTradeCount}
            pendingCount={engine.pendingTrades.length}
          />

          {/* Tick Selector */}
          <div className="bg-bg-surface border border-border-default rounded-xl p-4">
            <label className="text-text-muted text-xs uppercase tracking-wider mb-2 block">
              Tick Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {TICK_DURATION_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTicks(t)}
                  className={`px-3 py-2 rounded-lg font-mono-numbers text-sm font-bold transition-all cursor-pointer border ${
                    selectedTicks === t
                      ? "bg-safety-cyan/10 border-safety-cyan/40 text-safety-cyan"
                      : "bg-bg-primary border-border-default text-text-secondary hover:border-border-hover"
                  }`}
                >
                  {t}
                  <span className="text-[10px] font-normal ml-0.5 opacity-70">t</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stake Controls */}
          <div className="bg-bg-surface border border-border-default rounded-xl p-4">
            <label className="text-text-muted text-xs uppercase tracking-wider mb-2 block">
              Stake Amount
            </label>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono-numbers text-text-muted text-sm">
                  $
                </span>
                <input
                  type="number"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  max={engine.humanBalance}
                  step="0.01"
                  className="w-full bg-bg-primary border border-border-default rounded-lg pl-7 pr-3 py-3
                             font-mono-numbers text-text-primary text-lg focus:border-safety-cyan
                             focus:outline-none transition-colors"
                />
              </div>
              {stake > 0 && (
                <div className="text-right shrink-0">
                  <span className="text-text-muted text-xs block">Potential win</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-numbers text-alpha-green font-bold text-sm">
                      <span className="text-[10px] opacity-70">&#9650;</span>${potentialWinRise.toLocaleString()}
                    </span>
                    <span className="font-mono-numbers text-rekt-crimson font-bold text-sm">
                      <span className="text-[10px] opacity-70">&#9660;</span>${potentialWinFall.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {[0.1, 0.25, 0.5, 1].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setStakePercent(pct)}
                  className="flex-1 py-2 bg-bg-primary border border-border-default rounded-lg
                             text-text-secondary text-xs font-mono-numbers hover:border-border-hover
                             transition-colors cursor-pointer"
                >
                  {pct * 100}%
                </button>
              ))}
            </div>
          </div>

          {/* Trade Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleTrade("UP")}
              disabled={!engine.canTrade || stake <= 0 || stake > engine.humanBalance}
              className="py-5 bg-alpha-green text-bg-primary font-bold text-xl rounded-xl
                         btn-glow-green cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed
                         disabled:shadow-none active:scale-[0.97] transition-all"
            >
              <span className="text-2xl mr-2">&#9650;</span>
              RISE
            </button>
            <button
              onClick={() => handleTrade("DOWN")}
              disabled={!engine.canTrade || stake <= 0 || stake > engine.humanBalance}
              className="py-5 bg-rekt-crimson text-white font-bold text-xl rounded-xl
                         btn-glow-red cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed
                         disabled:shadow-none active:scale-[0.97] transition-all"
            >
              <span className="text-2xl mr-2">&#9660;</span>
              FALL
            </button>
          </div>

          {/* Pending Trades */}
          {engine.pendingTrades.length > 0 && (
            <PendingTradesPanel
              trades={engine.pendingTrades}
              currentTickIndex={engine.tickCount}
            />
          )}

          {/* Trade History */}
          {engine.tradeHistory.length > 0 && (
            <TradeHistoryPanel trades={engine.tradeHistory} />
          )}
        </div>

        {/* Right: Team Leaderboard */}
        <div>
          <TeamLeaderboard
            players={engine.playerBalances}
            buyIn={buyIn}
          />
        </div>
      </div>

      {/* Game ending state */}
      {engine.gamePhase === "ending" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-safety-cyan/20 rounded-full mx-auto mb-4 relative">
              <div className="absolute inset-0 w-12 h-12 border-2 border-safety-cyan border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-text-primary text-lg font-bold mb-1">Resolving Trades...</div>
            <div className="text-text-muted text-sm">Calculating 80/20 payouts</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-Components
// ============================================================

function GameHeader({
  timeRemainingMs,
  symbol,
  isConnected,
  gamePhase,
  tickCount,
}: {
  timeRemainingMs: number;
  symbol: string;
  isConnected: boolean;
  gamePhase: GamePhase;
  tickCount: number;
}) {
  const minutes = Math.floor(timeRemainingMs / 60000);
  const seconds = Math.floor((timeRemainingMs % 60000) / 1000);
  const isUrgent = timeRemainingMs < 30000 && timeRemainingMs > 0;

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Timer */}
        <div className="flex items-center gap-3">
          <div
            className={`font-mono-numbers text-3xl font-bold ${
              isUrgent
                ? "animate-timer-urgent"
                : timeRemainingMs <= 0
                  ? "text-text-muted"
                  : "text-safety-cyan glow-cyan"
            }`}
          >
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          {gamePhase === "starting" && (
            <span className="text-text-muted text-xs animate-pulse">Connecting...</span>
          )}
          {gamePhase === "ending" && (
            <span className="text-rekt-crimson text-xs">Resolving trades...</span>
          )}
          {gamePhase === "finished" && (
            <span className="text-alpha-green text-xs font-bold">GAME OVER</span>
          )}
        </div>

        {/* Market + connection */}
        <div className="flex items-center gap-4">
          <span className="font-mono-numbers text-text-secondary text-sm">
            {symbol}
          </span>
          <span className="font-mono-numbers text-text-muted text-xs">
            TICKS {tickCount}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-alpha-green animate-live-pulse" : "bg-rekt-crimson"
              }`}
            />
            <span className="text-[10px] text-text-muted uppercase tracking-wider">
              {isConnected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceDisplay({
  currentTick,
  previousTick,
}: {
  currentTick: DerivTick | null;
  previousTick: DerivTick | null;
}) {
  const direction =
    currentTick && previousTick
      ? currentTick.quote > previousTick.quote
        ? "up"
        : currentTick.quote < previousTick.quote
          ? "down"
          : "flat"
      : "flat";

  const colorClass =
    direction === "up"
      ? "text-alpha-green"
      : direction === "down"
        ? "text-rekt-crimson"
        : "text-text-primary";

  const glowClass =
    direction === "up"
      ? "glow-green"
      : direction === "down"
        ? "glow-red"
        : "";

  const arrow =
    direction === "up" ? "\u25B2" : direction === "down" ? "\u25BC" : "";

  if (!currentTick) {
    return (
      <div className="bg-bg-surface border border-border-default rounded-xl p-8 text-center">
        <div className="font-mono-numbers text-3xl text-text-muted animate-pulse">
          Waiting for price...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-6 text-center">
      <div
        className={`font-mono-numbers text-5xl font-bold ${colorClass} ${glowClass} transition-colors duration-150`}
      >
        {arrow && <span className="text-3xl mr-2">{arrow}</span>}
        {currentTick.quote.toFixed(currentTick.pip_size)}
      </div>
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-text-muted font-mono-numbers">
        <span>ASK {currentTick.ask.toFixed(currentTick.pip_size)}</span>
        <span>BID {currentTick.bid.toFixed(currentTick.pip_size)}</span>
      </div>
    </div>
  );
}

function PlayerStatsBar({
  balance,
  initialBalance,
  tradeCount,
  pendingCount,
}: {
  balance: number;
  initialBalance: number;
  tradeCount: number;
  pendingCount: number;
}) {
  const pnl = Math.round((balance - initialBalance) * 100) / 100;
  const pnlColor = pnl >= 0 ? "text-alpha-green" : "text-rekt-crimson";
  const pnlSign = pnl >= 0 ? "+" : "";

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-text-muted text-xs uppercase tracking-wider block">
            Your Balance
          </span>
          <span className="font-mono-numbers text-2xl font-bold text-text-primary">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`font-mono-numbers text-sm ml-2 ${pnlColor}`}>
            {pnlSign}${pnl.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <span className="text-text-muted text-xs block">Trades</span>
            <span className="font-mono-numbers font-bold text-text-primary">
              {tradeCount}
            </span>
          </div>
          <div className="text-center">
            <span className="text-text-muted text-xs block">Active</span>
            <span className="font-mono-numbers font-bold text-safety-cyan">
              {pendingCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamLeaderboard({
  players,
  buyIn,
}: {
  players: PlayerBalance[];
  buyIn: number;
}) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4 sticky top-20">
      <h3 className="text-text-primary font-bold text-sm mb-3 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L15 8.5L22 9.3L17 14L18.2 21L12 17.5L5.8 21L7 14L2 9.3L9 8.5Z" />
        </svg>
        TEAM LEADERBOARD
      </h3>
      <div className="space-y-2">
        {players.map((p, i) => {
          const pnlColor = p.pnl >= 0 ? "text-alpha-green" : "text-rekt-crimson";
          const pnlSign = p.pnl >= 0 ? "+" : "";

          return (
            <div
              key={p.playerId}
              className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                p.isCurrentPlayer
                  ? "bg-safety-cyan/5 border border-safety-cyan/20"
                  : "bg-bg-primary border border-transparent"
              }`}
            >
              {/* Rank */}
              <span
                className={`font-mono-numbers text-sm font-bold w-5 text-center ${
                  i === 0 ? "text-safety-cyan" : "text-text-muted"
                }`}
              >
                {i + 1}
              </span>

              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  p.isBot
                    ? "bg-bg-elevated border border-border-hover text-safety-cyan"
                    : "bg-safety-cyan/10 border border-safety-cyan/20 text-safety-cyan"
                }`}
              >
                {p.isBot ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="3" />
                    <line x1="12" y1="8" x2="12" y2="11" />
                  </svg>
                ) : (
                  p.username.slice(0, 2).toUpperCase()
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-text-primary text-xs font-semibold truncate">
                    {p.username}
                  </span>
                  {p.isCurrentPlayer && (
                    <span className="text-[8px] text-safety-cyan bg-safety-cyan/10 px-1 rounded">
                      YOU
                    </span>
                  )}
                </div>
                <span className="text-text-muted text-[10px] font-mono-numbers">
                  {p.tradeCount} trades
                </span>
              </div>

              {/* Balance + PnL */}
              <div className="text-right shrink-0">
                <span className="font-mono-numbers text-xs font-bold text-text-primary block">
                  ${p.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`font-mono-numbers text-[10px] ${pnlColor}`}>
                  {pnlSign}${Math.abs(p.pnl).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PendingTradesPanel({
  trades,
  currentTickIndex,
}: {
  trades: PendingHumanTrade[];
  currentTickIndex: number;
}) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4">
      <h3 className="text-text-muted text-xs uppercase tracking-wider mb-3">
        Active Trades ({trades.length})
      </h3>
      <div className="space-y-2">
        {trades.map((trade) => {
          const ticksElapsed = currentTickIndex - trade.entryTickIndex;
          const ticksRemaining = Math.max(0, trade.tickDuration - ticksElapsed);
          const progress = Math.min(1, ticksElapsed / trade.tickDuration);

          return (
            <div
              key={trade.tradeId}
              className="flex items-center gap-3 bg-bg-primary border border-border-default rounded-lg p-3"
            >
              {/* Direction */}
              <span
                className={`font-bold text-sm ${
                  trade.direction === "UP" ? "text-alpha-green" : "text-rekt-crimson"
                }`}
              >
                {trade.direction === "UP" ? "\u25B2" : "\u25BC"} {trade.direction}
              </span>

              {/* Stake */}
              <span className="font-mono-numbers text-text-primary text-sm">
                ${trade.stake.toFixed(2)}
              </span>

              {/* Entry price */}
              <span className="font-mono-numbers text-text-muted text-xs">
                @ {trade.entryPrice.toFixed(2)}
              </span>

              {/* Progress bar + ticks remaining */}
              <div className="flex-1">
                <div className="w-full bg-bg-elevated rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-safety-cyan rounded-full transition-all duration-300"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>

              <span className="font-mono-numbers text-safety-cyan text-xs font-bold">
                {ticksRemaining}t
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TradeHistoryPanel({ trades }: { trades: ResolvedTrade[] }) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4">
      <h3 className="text-text-muted text-xs uppercase tracking-wider mb-3">
        Trade History ({trades.length})
      </h3>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {trades.map((trade) => (
          <div
            key={trade.tradeId}
            className={`flex items-center gap-3 rounded-lg p-2.5 text-sm ${
              trade.status === "won" ? "animate-win-flash" : "animate-loss-flash"
            }`}
          >
            {/* Direction */}
            <span
              className={`font-bold text-xs ${
                trade.direction === "UP" ? "text-alpha-green" : "text-rekt-crimson"
              }`}
            >
              {trade.direction === "UP" ? "\u25B2" : "\u25BC"}
            </span>

            {/* Stake */}
            <span className="font-mono-numbers text-text-secondary text-xs">
              ${trade.stake.toFixed(2)}
            </span>

            {/* Entry → Exit */}
            <span className="font-mono-numbers text-text-muted text-[10px]">
              {trade.entryPrice.toFixed(2)} → {trade.exitPrice.toFixed(2)}
            </span>

            {/* Result badge */}
            <span className="ml-auto">
              <span
                className={`text-[10px] font-mono-numbers font-bold px-2 py-0.5 rounded-full ${
                  trade.status === "won"
                    ? "bg-alpha-green/10 text-alpha-green"
                    : "bg-rekt-crimson/10 text-rekt-crimson"
                }`}
              >
                {trade.status === "won"
                  ? `+$${trade.grossPayout.toFixed(2)}`
                  : `-$${trade.stake.toFixed(2)}`}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

