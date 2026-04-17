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
import { updatePlayerFinalBalance } from "@/lib/actions/lobby";
import type { Player, LobbyPlayer, TradeDirection } from "@/lib/types/database";
import { getAvatarUrl } from "@/lib/avatar";
import TradingChart from "@/components/TradingChart";

// ============================================================
// GameView — Cyber-Terminal Trading Cockpit
// ============================================================

interface GameViewProps {
  lobbyId: string;
  symbol: string;
  currentPlayer: Player;
  allPlayers: (LobbyPlayer & { player: Player })[];
  buyIn: number;
  isMuted: boolean;
  onMuteToggle: () => void;
  onGameEnd: (summary: PayoutSummary) => void;
  onExitGame: () => void;
}

export default function GameView({
  lobbyId,
  symbol,
  currentPlayer,
  allPlayers,
  buyIn,
  isMuted,
  onMuteToggle,
  onGameEnd,
  onExitGame,
}: GameViewProps) {
  const engine = useGameEngine({
    lobbyId,
    symbol,
    currentPlayer,
    allPlayers,
    buyIn,
  });

  const [selectedTicks, setSelectedTicks] = useState(5);
  const [stakeInput, setStakeInput] = useState(() => {
    const val = Math.floor(buyIn * 0.1 * 100) / 100;
    return val > 0 ? val.toString() : "";
  });
  const [showExitModal, setShowExitModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

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
  };

  const setStakePercent = (pct: number) => {
    const val = Math.floor(engine.humanBalance * pct * 100) / 100;
    setStakeInput(val > 0 ? val.toString() : "");
  };

  const handleConfirmExit = async () => {
    setIsExiting(true);
    try {
      await updatePlayerFinalBalance(lobbyId, currentPlayer.id, 0);
      console.log(`[GameView] Player ${currentPlayer.username} exited — buy-in forfeited`);
      onExitGame();
    } catch (err) {
      console.error("[GameView] Failed to exit game:", err);
      setIsExiting(false);
      setShowExitModal(false);
    }
  };

  // Timer formatting
  const minutes = Math.floor(engine.timeRemainingMs / 60000);
  const seconds = Math.floor((engine.timeRemainingMs % 60000) / 1000);
  const timerState =
    engine.timeRemainingMs <= 0
      ? "finished"
      : engine.timeRemainingMs < 15000
        ? "critical"
        : engine.timeRemainingMs < 60000
          ? "warn"
          : "safe";

  const pnl = Math.round((engine.humanBalance - buyIn) * 100) / 100;
  const pnlColor = pnl >= 0 ? "text-alpha-green" : "text-rekt-crimson";
  const pnlSign = pnl >= 0 ? "+" : "";

  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* ══════════ TOP HEADER BAR ══════════ */}
      <div className="cockpit-header w-full px-4 py-2.5 flex items-center justify-between shrink-0">
        {/* Left: Logo + Timer */}
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="font-display font-bold text-sm tracking-widest text-safety-cyan hover:text-alpha-green transition-colors"
          >
            LOT
          </a>

          <div className="h-5 w-px bg-border-default" />

          {/* Timer */}
          <div className="flex items-center gap-2">
            <div
              className={`timer-display text-2xl font-bold ${
                timerState === "safe"
                  ? "timer-safe"
                  : timerState === "warn"
                    ? "timer-warn"
                    : timerState === "critical"
                      ? "timer-critical"
                      : "text-text-muted"
              }`}
            >
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
            {engine.gamePhase === "starting" && (
              <span className="text-text-muted text-[10px] animate-pulse uppercase tracking-wider">
                Connecting...
              </span>
            )}
            {engine.gamePhase === "ending" && (
              <span className="text-rekt-crimson text-[10px] uppercase tracking-wider">
                Resolving...
              </span>
            )}
            {engine.gamePhase === "finished" && (
              <span className="text-alpha-green text-[10px] font-bold uppercase tracking-wider">
                Complete
              </span>
            )}
          </div>
        </div>

        {/* Center: Market + Connection */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                engine.isConnected ? "bg-alpha-green conn-live" : "bg-rekt-crimson"
              }`}
            />
            <span className="text-[9px] text-text-muted uppercase tracking-widest">
              {engine.isConnected ? "LIVE" : "OFF"}
            </span>
          </div>
          <span className="font-mono-numbers text-text-primary text-sm font-bold">
            {symbol}
          </span>
          <span className="font-mono-numbers text-text-muted text-[10px]">
            T{engine.tickCount}
          </span>
        </div>

        {/* Right: Player Info + Exit */}
        <div className="flex items-center gap-3">
          {/* Balance + PnL */}
          <div className="text-right">
            <div className="font-mono-numbers text-text-primary text-sm font-bold leading-none">
              ${engine.humanBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={`font-mono-numbers text-[10px] leading-none mt-0.5 ${pnlColor}`}>
              {pnlSign}${Math.abs(pnl).toFixed(2)}
            </div>
          </div>

          <div className="h-5 w-px bg-border-default" />

          {/* Avatar + Name */}
          <div className="flex items-center gap-2">
            <img
              src={getAvatarUrl(currentPlayer.avatar_id ?? 1)}
              alt={currentPlayer.username}
              className="w-7 h-7 rounded-full object-cover object-top border border-safety-cyan/30"
            />
            <span className="text-text-secondary text-xs font-medium hidden sm:inline">
              {currentPlayer.username}
            </span>
          </div>

          {/* Trades counter */}
          <div className="flex items-center gap-1 bg-bg-surface px-2 py-1 rounded">
            <span className="text-[9px] text-text-muted uppercase tracking-wider">TRD</span>
            <span className="font-mono-numbers text-text-primary text-xs font-bold">
              {engine.humanTradeCount}
            </span>
          </div>

          {/* Active trades */}
          {engine.pendingTrades.length > 0 && (
            <div className="flex items-center gap-1 bg-safety-cyan/5 border border-safety-cyan/20 px-2 py-1 rounded">
              <span className="text-[9px] text-safety-cyan uppercase tracking-wider">ACT</span>
              <span className="font-mono-numbers text-safety-cyan text-xs font-bold">
                {engine.pendingTrades.length}
              </span>
            </div>
          )}

          {/* Music Toggle */}
          <button
            onClick={onMuteToggle}
            title={isMuted ? "Unmute music" : "Mute music"}
            className="p-1.5 rounded border border-border-default hover:border-border-hover
                       hover:bg-bg-elevated transition-colors cursor-pointer"
          >
            {isMuted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-safety-cyan">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>

          {/* Exit */}
          {engine.gamePhase === "active" && (
            <>
              <div className="h-5 w-px bg-border-default" />
              <button
                onClick={() => setShowExitModal(true)}
                className="px-2.5 py-1 bg-rekt-crimson/10 border border-rekt-crimson/30 rounded
                           text-rekt-crimson text-[10px] font-bold uppercase tracking-widest
                           hover:bg-rekt-crimson/20 hover:border-rekt-crimson/50 transition-colors cursor-pointer"
              >
                EXIT
              </button>
            </>
          )}
        </div>
      </div>

      {/* Disconnect Warning — slim banner */}
      {!engine.isConnected && engine.gamePhase === "active" && (
        <div className="bg-rekt-crimson/8 border-b border-rekt-crimson/20 px-4 py-1.5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-rekt-crimson animate-live-pulse" />
          <span className="text-rekt-crimson text-[11px] font-medium">
            Reconnecting to Deriv Oracle...
          </span>
        </div>
      )}

      {/* ══════════ MAIN COCKPIT ══════════ */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* LEFT: Chart + Trading Controls */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chart — fills available space */}
          <div className="flex-1 min-h-0">
            <TradingChart
              symbol={symbol}
              currentTick={engine.currentTick}
              isConnected={engine.isConnected}
              playerBalances={engine.playerBalances}
              lobbyId={lobbyId}
            />
          </div>

          {/* ── Trading Controls Panel ── */}
          <div className="cockpit-panel px-3 py-2.5 shrink-0">
            {/* Row 1: Tick Duration + Stake Input + Quick % */}
            <div className="flex items-center gap-3">
              {/* Tick pills */}
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-text-muted uppercase tracking-wider mr-1">TICKS</span>
                {TICK_DURATION_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTicks(t)}
                    className={`tick-pill rounded ${
                      selectedTicks === t ? "tick-active" : ""
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-border-default" />

              {/* Stake input */}
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <span className="text-[9px] text-text-muted uppercase tracking-wider">STAKE</span>
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono-numbers text-text-muted text-xs">
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
                    className="w-full bg-bg-primary border border-border-default rounded pl-5 pr-2 py-1.5
                               font-mono-numbers text-text-primary text-sm focus:border-safety-cyan
                               focus:outline-none transition-colors"
                  />
                </div>
                {/* Quick % buttons */}
                <div className="flex gap-1">
                  {[0.1, 0.25, 0.5, 1].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setStakePercent(pct)}
                      className="px-2 py-1.5 bg-bg-primary border border-border-default rounded
                                 text-text-muted text-[10px] font-mono-numbers hover:border-border-hover
                                 hover:text-text-secondary transition-colors cursor-pointer"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-6 w-px bg-border-default" />

              {/* Potential payout preview */}
              {stake > 0 && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-text-muted text-[9px] uppercase tracking-wider">WIN</span>
                  <span className="font-mono-numbers text-alpha-green font-bold">
                    +${potentialWinRise.toLocaleString()}
                  </span>
                  <span className="text-text-muted">/</span>
                  <span className="font-mono-numbers text-rekt-crimson font-bold">
                    +${potentialWinFall.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Row 2: RISE / FALL Buttons */}
            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <button
                onClick={() => handleTrade("UP")}
                disabled={!engine.canTrade || stake <= 0 || stake > engine.humanBalance}
                className="trade-btn-rise py-3 rounded font-bold text-base cursor-pointer flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L14 10H2L8 2Z" fill="currentColor" />
                </svg>
                RISE
              </button>
              <button
                onClick={() => handleTrade("DOWN")}
                disabled={!engine.canTrade || stake <= 0 || stake > engine.humanBalance}
                className="trade-btn-fall py-3 rounded font-bold text-base cursor-pointer flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 14L2 6H14L8 14Z" fill="currentColor" />
                </svg>
                FALL
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: Leaderboard + Pending + History */}
        <div className="w-72 shrink-0 border-l border-border-default bg-bg-surface flex flex-col overflow-hidden">
          {/* Leaderboard */}
          <div className="px-3 pt-3 pb-2 border-b border-border-default">
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-safety-cyan">
                <path d="M12 2L15 8.5L22 9.3L17 14L18.2 21L12 17.5L5.8 21L7 14L2 9.3L9 8.5Z" />
              </svg>
              <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">
                Leaderboard
              </span>
            </div>
            <CompactLeaderboard
              players={engine.playerBalances}
              buyIn={buyIn}
              currentPlayerId={currentPlayer.id}
              pausedBots={engine.pausedBots}
              toggleBotPause={engine.toggleBotPause}
            />
          </div>

          {/* Pending Trades */}
          {engine.pendingTrades.length > 0 && (
            <div className="px-3 pt-2 pb-2 border-b border-border-default">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">
                  Active Trades
                </span>
                <span className="font-mono-numbers text-safety-cyan text-[10px] font-bold">
                  {engine.pendingTrades.length}
                </span>
              </div>
              <div className="space-y-1">
                {engine.pendingTrades.map((trade) => {
                  const ticksElapsed = engine.tickCount - trade.entryTickIndex;
                  const ticksRemaining = Math.max(0, trade.tickDuration - ticksElapsed);
                  const progress = Math.min(1, ticksElapsed / trade.tickDuration);
                  return (
                    <div key={trade.tradeId} className="pending-trade-row rounded">
                      <span
                        className={`font-bold text-[10px] w-8 ${
                          trade.direction === "UP" ? "text-alpha-green" : "text-rekt-crimson"
                        }`}
                      >
                        {trade.direction === "UP" ? "\u25B2 UP" : "\u25BC DN"}
                      </span>
                      <span className="font-mono-numbers text-text-primary text-[11px]">
                        ${trade.stake.toFixed(2)}
                      </span>
                      <div className="flex-1">
                        <div className="trade-progress">
                          <div
                            className="trade-progress-fill"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-mono-numbers text-safety-cyan text-[10px] font-bold w-4 text-right">
                        {ticksRemaining}t
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trade History */}
          <div className="flex-1 overflow-hidden flex flex-col px-3 pt-2 pb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">
                History
              </span>
              <span className="font-mono-numbers text-text-muted text-[10px]">
                {engine.tradeHistory.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-0.5">
              {engine.tradeHistory.length === 0 ? (
                <div className="text-text-muted text-[10px] text-center py-4 opacity-50">
                  No trades yet
                </div>
              ) : (
                engine.tradeHistory.map((trade) => (
                  <div
                    key={trade.tradeId}
                    className={`history-row rounded ${
                      trade.status === "won" ? "animate-win-flash" : "animate-loss-flash"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold ${
                        trade.direction === "UP" ? "text-alpha-green" : "text-rekt-crimson"
                      }`}
                    >
                      {trade.direction === "UP" ? "\u25B2" : "\u25BC"}
                    </span>
                    <span className="font-mono-numbers text-text-secondary text-[10px]">
                      ${trade.stake.toFixed(2)}
                    </span>
                    <span className="font-mono-numbers text-text-muted text-[9px]">
                      {trade.entryPrice.toFixed(2)}&rarr;{trade.exitPrice.toFixed(2)}
                    </span>
                    <span className="ml-auto">
                      <span
                        className={`text-[9px] font-mono-numbers font-bold px-1.5 py-0.5 rounded ${
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ EXIT CONFIRMATION MODAL ══════════ */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="cockpit-panel rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-rekt-crimson/10 border border-rekt-crimson/20 flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rekt-crimson">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="text-text-primary font-bold text-base mb-1.5">
                Exit Game?
              </h3>
              <p className="text-rekt-crimson font-semibold text-xs mb-1.5">
                Forfeit buy-in:{" "}
                <span className="font-mono-numbers">${buyIn.toLocaleString()}</span>
              </p>
              <p className="text-text-muted text-xs leading-relaxed">
                Balance will not be refunded. Open trades abandoned.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExitModal(false)}
                disabled={isExiting}
                className="flex-1 py-2.5 bg-safety-cyan/10 border border-safety-cyan/30 text-safety-cyan
                           font-bold text-sm rounded cursor-pointer hover:bg-safety-cyan/20 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
              <button
                onClick={handleConfirmExit}
                disabled={isExiting}
                className="flex-1 py-2.5 bg-rekt-crimson text-white font-bold text-sm rounded cursor-pointer
                           hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isExiting ? "Exiting..." : "Yes, Exit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game ending overlay */}
      {engine.gamePhase === "ending" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-safety-cyan/20 rounded-full mx-auto mb-3 relative">
              <div className="absolute inset-0 w-10 h-10 border-2 border-safety-cyan border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-text-primary text-sm font-bold mb-0.5">Resolving Trades...</div>
            <div className="text-text-muted text-xs">Calculating 80/20 payouts</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CompactLeaderboard — Tighter sidebar leaderboard
// ============================================================

const LB_ROW_HEIGHT = 40;
const LB_ROW_GAP = 4;

function CompactLeaderboard({
  players,
  buyIn,
  currentPlayerId,
  pausedBots,
  toggleBotPause,
}: {
  players: PlayerBalance[];
  buyIn: number;
  currentPlayerId: string;
  pausedBots: Set<string>;
  toggleBotPause: (botId: string) => void;
}) {
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [rankChanges, setRankChanges] = useState<Map<string, "up" | "down">>(new Map());
  const animationTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const prevRanks = prevRanksRef.current;
    const newChanges = new Map<string, "up" | "down">();

    players.forEach((p, i) => {
      const prevRank = prevRanks.get(p.playerId);
      if (prevRank !== undefined && prevRank !== i) {
        const direction = i < prevRank ? "up" : "down";
        newChanges.set(p.playerId, direction);

        const existingTimer = animationTimersRef.current.get(p.playerId);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(() => {
          setRankChanges((prev) => {
            const next = new Map(prev);
            next.delete(p.playerId);
            return next;
          });
          animationTimersRef.current.delete(p.playerId);
        }, 2000);
        animationTimersRef.current.set(p.playerId, timer);
      }
    });

    if (newChanges.size > 0) {
      setRankChanges((prev) => {
        const merged = new Map(prev);
        newChanges.forEach((v, k) => merged.set(k, v));
        return merged;
      });
    }

    const nextRanks = new Map<string, number>();
    players.forEach((p, i) => nextRanks.set(p.playerId, i));
    prevRanksRef.current = nextRanks;
  }, [players]);

  useEffect(() => {
    return () => {
      animationTimersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const containerHeight = players.length * (LB_ROW_HEIGHT + LB_ROW_GAP) - LB_ROW_GAP;

  return (
    <div className="relative" style={{ height: containerHeight }}>
      {players.map((p, i) => {
        const pnlColor = p.pnl >= 0 ? "text-alpha-green" : "text-rekt-crimson";
        const pnlSign = p.pnl >= 0 ? "+" : "";
        const isLeader = i === 0;
        const isMyBot = p.isBot && p.hiredBy === currentPlayerId;
        const isPaused = pausedBots.has(p.playerId);
        const change = rankChanges.get(p.playerId);
        const flashClass = change === "up"
          ? "animate-rank-up"
          : change === "down"
            ? "animate-rank-down"
            : "";

        return (
          <div
            key={p.playerId}
            className={`lb-row absolute left-0 right-0 rounded ${flashClass} ${
              isLeader
                ? "lb-row-leader"
                : p.isCurrentPlayer
                  ? "lb-row-you"
                  : "lb-row-default"
            }`}
            style={{
              top: i * (LB_ROW_HEIGHT + LB_ROW_GAP),
              height: LB_ROW_HEIGHT,
            }}
          >
            {/* Rank */}
            <div className="w-4 text-center shrink-0">
              {isLeader ? (
                <span className="text-[10px] font-bold text-yellow-400">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="inline">
                    <path
                      d="M2 17L5 7L9 12L12 4L15 12L19 7L22 17H2Z"
                      fill="rgba(255, 215, 0, 0.3)"
                      stroke="rgba(255, 215, 0, 0.9)"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : (
                <span className="font-mono-numbers text-[10px] font-bold text-text-muted">
                  {i + 1}
                </span>
              )}
            </div>

            {/* Avatar */}
            <div className={`w-6 h-6 rounded-full overflow-hidden shrink-0 border ${
              p.isBot
                ? "border-border-hover"
                : isLeader
                  ? "border-yellow-400/40"
                  : "border-safety-cyan/20"
            }`}>
              {p.isBot ? (
                <div className="w-full h-full bg-bg-elevated flex items-center justify-center text-safety-cyan">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="3" />
                    <line x1="12" y1="8" x2="12" y2="11" />
                  </svg>
                </div>
              ) : p.avatarId ? (
                <img
                  src={getAvatarUrl(p.avatarId)}
                  alt={p.username}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center text-[8px] font-bold ${
                  isLeader ? "bg-yellow-400/10 text-yellow-400" : "bg-safety-cyan/10 text-safety-cyan"
                }`}>
                  {p.username.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name + trade count */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-semibold truncate ${
                  isLeader ? "text-yellow-400" : "text-text-primary"
                }`}>
                  {p.username}
                </span>
                {p.isCurrentPlayer && (
                  <span className="text-[7px] text-safety-cyan bg-safety-cyan/10 px-0.5 rounded leading-none">
                    YOU
                  </span>
                )}
                {change && (
                  <span
                    className={`animate-rank-indicator text-[8px] font-bold ${
                      change === "up" ? "text-alpha-green" : "text-rekt-crimson"
                    }`}
                  >
                    {change === "up" ? "\u25B2" : "\u25BC"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-text-muted text-[8px] font-mono-numbers">
                  {p.tradeCount}t
                </span>
                {isPaused && (
                  <span className="text-[7px] font-mono-numbers font-bold text-alpha-green bg-alpha-green/10 px-0.5 rounded animate-live-pulse leading-none">
                    HOLD
                  </span>
                )}
              </div>
            </div>

            {/* Balance + Pause control */}
            <div className="text-right shrink-0 flex flex-col items-end">
              <span className={`font-mono-numbers text-[10px] font-bold ${
                isLeader ? "text-yellow-400" : "text-text-primary"
              }`}>
                ${p.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {isMyBot ? (
                <button
                  onClick={() => toggleBotPause(p.playerId)}
                  title={isPaused ? "Resume bot" : "Pause bot"}
                  className={`text-[8px] font-bold font-mono-numbers px-1.5 py-0 rounded
                              transition-all cursor-pointer border leading-relaxed ${
                    isPaused
                      ? "bg-alpha-green/10 border-alpha-green/40 text-alpha-green hover:bg-alpha-green/20"
                      : "bg-rekt-crimson/10 border-rekt-crimson/30 text-rekt-crimson hover:bg-rekt-crimson/20"
                  }`}
                >
                  {isPaused ? "\u25B6 GO" : "\u23F8 HOLD"}
                </button>
              ) : (
                <span className={`font-mono-numbers text-[8px] ${pnlColor}`}>
                  {pnlSign}${Math.abs(p.pnl).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
