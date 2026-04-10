"use client";

import { useState, useMemo } from "react";
import {
  useGameEngine,
  type PlayerBalance,
  type PendingHumanTrade,
  type ResolvedTrade,
  type GamePhase,
} from "@/hooks/useGameEngine";
import type { PayoutSummary, PayoutResult } from "@/lib/game/payout-engine";
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
  onGameEnd: () => void;
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

      {/* Game Over Overlay */}
      {engine.gamePhase === "finished" && (
        <PayoutBreakdownOverlay
          payoutSummary={engine.payoutSummary}
          buyIn={buyIn}
          currentPlayerId={currentPlayer.id}
          onContinue={onGameEnd}
        />
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

function PayoutBreakdownOverlay({
  payoutSummary,
  buyIn,
  currentPlayerId,
  onContinue,
}: {
  payoutSummary: PayoutSummary | null;
  buyIn: number;
  currentPlayerId: string;
  onContinue: () => void;
}) {
  if (!payoutSummary) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/90 backdrop-blur-sm">
        <div className="text-text-muted animate-pulse text-lg">Calculating payouts...</div>
      </div>
    );
  }

  const { players, safetyNetTotal, bailoutDistributed, spilloverDistributed, inactiveForfeited } =
    payoutSummary;

  // Sort by final balance descending
  const sorted = [...players].sort((a, b) => b.finalBalance - a.finalBalance);

  const roleColor = (role: PayoutResult["role"]) => {
    switch (role) {
      case "alpha": return "text-alpha-green";
      case "rescue": return "text-rekt-crimson";
      case "inactive": return "text-text-muted";
      case "even": return "text-safety-cyan";
    }
  };

  const roleBg = (role: PayoutResult["role"]) => {
    switch (role) {
      case "alpha": return "bg-alpha-green/10 border-alpha-green/20";
      case "rescue": return "bg-rekt-crimson/10 border-rekt-crimson/20";
      case "inactive": return "bg-bg-elevated border-border-default opacity-50";
      case "even": return "bg-safety-cyan/5 border-safety-cyan/20";
    }
  };

  const roleLabel = (role: PayoutResult["role"]) => {
    switch (role) {
      case "alpha": return "ALPHA";
      case "rescue": return "RESCUE";
      case "inactive": return "INACTIVE";
      case "even": return "EVEN";
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/90 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6 sm:p-8 max-w-2xl w-full mx-4 animate-fade-up">
        <h2 className="text-3xl font-bold text-center text-text-primary mb-1">
          GAME OVER
        </h2>
        <p className="text-text-muted text-center text-sm mb-6">
          80/20 Payout Redistribution
        </p>

        {/* Safety Net Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-bg-primary border border-border-default rounded-lg p-3 text-center">
            <span className="text-text-muted text-[10px] uppercase tracking-wider block mb-1">
              Safety Net
            </span>
            <span className="font-mono-numbers text-safety-cyan font-bold text-sm">
              ${fmt(safetyNetTotal)}
            </span>
          </div>
          <div className="bg-bg-primary border border-border-default rounded-lg p-3 text-center">
            <span className="text-text-muted text-[10px] uppercase tracking-wider block mb-1">
              Bailout Paid
            </span>
            <span className="font-mono-numbers text-rekt-crimson font-bold text-sm">
              ${fmt(bailoutDistributed)}
            </span>
          </div>
          <div className="bg-bg-primary border border-border-default rounded-lg p-3 text-center">
            <span className="text-text-muted text-[10px] uppercase tracking-wider block mb-1">
              Spillover
            </span>
            <span className="font-mono-numbers text-alpha-green font-bold text-sm">
              ${fmt(spilloverDistributed)}
            </span>
          </div>
        </div>

        {/* Player Breakdown */}
        <div className="space-y-2 mb-6">
          {sorted.map((p, i) => {
            const isMe = p.playerId === currentPlayerId;
            const finalPnl = Math.round((p.finalBalance - buyIn) * 100) / 100;
            const pnlColor = finalPnl >= 0 ? "text-alpha-green" : "text-rekt-crimson";
            const pnlSign = finalPnl >= 0 ? "+" : "";

            return (
              <div
                key={p.playerId}
                className={`rounded-xl p-4 border ${
                  isMe ? "ring-1 ring-safety-cyan/40 " : ""
                }${roleBg(p.role)}`}
              >
                {/* Top row: rank, name, role badge, final balance */}
                <div className="flex items-center gap-3">
                  <span
                    className={`font-mono-numbers text-lg font-bold w-7 text-center shrink-0 ${
                      i === 0 ? "text-safety-cyan" : "text-text-muted"
                    }`}
                  >
                    #{i + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary font-semibold text-sm truncate">
                        {p.username}
                      </span>
                      {isMe && (
                        <span className="text-[10px] text-safety-cyan bg-safety-cyan/10 px-1.5 py-0.5 rounded">
                          YOU
                        </span>
                      )}
                      {p.isBot && (
                        <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">
                          BOT
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${roleColor(p.role)} bg-bg-primary/50`}>
                        {roleLabel(p.role)}
                      </span>
                    </div>
                    <span className="text-text-muted text-[10px] font-mono-numbers">
                      {p.tradeCount} trades
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono-numbers text-sm font-bold text-text-primary block">
                      ${fmt(p.finalBalance)}
                    </span>
                    <span className={`font-mono-numbers text-[10px] ${pnlColor}`}>
                      {pnlSign}${fmt(Math.abs(finalPnl))}
                    </span>
                  </div>
                </div>

                {/* Flow details for non-even, non-inactive players */}
                {p.role !== "even" && p.role !== "inactive" && (
                  <div className="mt-2 pt-2 border-t border-border-default/50 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono-numbers text-text-muted">
                    <span>Raw: ${fmt(p.rawBalance)}</span>
                    {p.alphaTax > 0 && (
                      <span className="text-rekt-crimson">Tax: -${fmt(p.alphaTax)}</span>
                    )}
                    {p.bailoutReceived > 0 && (
                      <span className="text-safety-cyan">Bailout: +${fmt(p.bailoutReceived)}</span>
                    )}
                    {p.spilloverReceived > 0 && (
                      <span className="text-alpha-green">Spillover: +${fmt(p.spilloverReceived)}</span>
                    )}
                    {p.botProfitRouted !== 0 && (
                      <span className={p.botProfitRouted > 0 ? "text-alpha-green" : "text-rekt-crimson"}>
                        Bot {p.botProfitRouted > 0 ? "Received" : "Routed"}: {p.botProfitRouted > 0 ? "+" : ""}${fmt(p.botProfitRouted)}
                      </span>
                    )}
                  </div>
                )}

                {/* Inactive explanation */}
                {p.role === "inactive" && (
                  <div className="mt-2 pt-2 border-t border-border-default/50 text-[10px] text-text-muted">
                    Forfeited — fewer than 5 trades (${fmt(p.rawBalance)} sent to Safety Net)
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onContinue}
          className="w-full py-4 bg-safety-cyan text-bg-primary font-bold text-lg rounded-xl
                     btn-glow cursor-pointer active:scale-[0.97] transition-all"
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
}
