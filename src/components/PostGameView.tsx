"use client";

import type { PayoutSummary, PayoutResult, PayoutRole } from "@/lib/game/payout-engine";

// ============================================================
// PostGameView — Full-screen post-game results & leaderboard
// ============================================================

interface PostGameViewProps {
  payoutSummary: PayoutSummary;
  buyIn: number;
  currentPlayerId: string;
  symbol: string;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

export default function PostGameView({
  payoutSummary,
  buyIn,
  currentPlayerId,
  symbol,
  onPlayAgain,
  onBackToMenu,
}: PostGameViewProps) {
  const { players, safetyNetTotal, bailoutDistributed, spilloverDistributed } =
    payoutSummary;

  const sorted = [...players].sort((a, b) => b.finalBalance - a.finalBalance);
  const mvp = sorted[0];
  const bots = sorted.filter((p) => p.isBot);
  const currentPlayer = sorted.find((p) => p.playerId === currentPlayerId);

  return (
    <div className="w-full max-w-3xl mx-auto pb-16">
      {/* ============ Header ============ */}
      <div className="text-center mb-8 animate-fade-up">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-text-primary mb-2">
          GAME <span className="text-gradient-cyan">OVER</span>
        </h1>
        <p className="text-text-secondary text-sm mb-4">
          80/20 Payout Redistribution Complete
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="bg-bg-surface border border-border-default rounded-full px-3 py-1 text-xs text-text-muted font-mono-numbers">
            {symbol}
          </span>
          <span className="bg-bg-surface border border-border-default rounded-full px-3 py-1 text-xs text-text-muted font-mono-numbers">
            ${buyIn.toLocaleString()} buy-in
          </span>
        </div>
      </div>

      {/* ============ MVP Crown ============ */}
      <div className="mb-6 animate-fade-up stagger-1">
        <MvpCard
          player={mvp}
          buyIn={buyIn}
          isCurrentPlayer={mvp.playerId === currentPlayerId}
        />
      </div>

      {/* ============ Bot Narratives ============ */}
      {bots.length > 0 && (
        <div className="mb-6 space-y-2 animate-fade-up stagger-2">
          <h3 className="text-text-muted text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="3" />
              <line x1="12" y1="8" x2="12" y2="11" />
            </svg>
            MERCENARY BOT REPORT
          </h3>
          {bots.map((bot, i) => (
            <BotNarrativeCard
              key={bot.playerId}
              bot={bot}
              buyIn={buyIn}
              index={i}
            />
          ))}
        </div>
      )}

      {/* ============ Payout Flow Summary ============ */}
      <div className="mb-6 animate-fade-up stagger-3">
        <h3 className="text-text-muted text-xs uppercase tracking-wider mb-3">
          PAYOUT FLOW
        </h3>
        <PayoutFlowSummary
          safetyNetTotal={safetyNetTotal}
          bailoutDistributed={bailoutDistributed}
          spilloverDistributed={spilloverDistributed}
        />
      </div>

      {/* ============ Full Leaderboard ============ */}
      <div className="mb-6 animate-fade-up stagger-4">
        <h3 className="text-text-muted text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L15 8.5L22 9.3L17 14L18.2 21L12 17.5L5.8 21L7 14L2 9.3L9 8.5Z" />
          </svg>
          FINAL STANDINGS
        </h3>
        <div className="space-y-2">
          {sorted.map((p, i) => (
            <PlayerResultCard
              key={p.playerId}
              player={p}
              rank={i + 1}
              buyIn={buyIn}
              isCurrentPlayer={p.playerId === currentPlayerId}
              isMvp={i === 0}
            />
          ))}
        </div>
      </div>

      {/* ============ Your Results Highlight ============ */}
      {currentPlayer && (
        <div className="mb-8 animate-fade-up stagger-5">
          <YourResultCard player={currentPlayer} buyIn={buyIn} />
        </div>
      )}

      {/* ============ Action Buttons ============ */}
      <div className="grid grid-cols-2 gap-3 animate-fade-up stagger-6">
        <button
          onClick={onPlayAgain}
          className="py-4 bg-safety-cyan text-bg-primary font-bold text-lg rounded-xl
                     btn-glow cursor-pointer active:scale-[0.97] transition-all"
        >
          PLAY AGAIN
        </button>
        <button
          onClick={onBackToMenu}
          className="py-4 bg-bg-elevated border border-border-hover text-text-primary font-bold
                     text-lg rounded-xl cursor-pointer hover:border-safety-cyan hover:text-safety-cyan
                     active:scale-[0.97] transition-all"
        >
          BACK TO MENU
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Sub-Components
// ============================================================

function MvpCard({
  player,
  buyIn,
  isCurrentPlayer,
}: {
  player: PayoutResult;
  buyIn: number;
  isCurrentPlayer: boolean;
}) {
  const pnl = Math.round((player.finalBalance - buyIn) * 100) / 100;
  const pnlColor = pnl >= 0 ? "text-alpha-green" : "text-rekt-crimson";
  const pnlSign = pnl >= 0 ? "+" : "";

  return (
    <div className="relative bg-bg-surface border border-yellow-500/30 rounded-2xl p-6 glow-gold overflow-hidden">
      {/* Crown icon */}
      <div className="absolute top-3 right-4 animate-crown-bounce">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path
            d="M2 17L5 7L9 12L12 4L15 12L19 7L22 17H2Z"
            fill="rgba(255, 215, 0, 0.2)"
            stroke="rgba(255, 215, 0, 0.8)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <line x1="2" y1="20" x2="22" y2="20" stroke="rgba(255, 215, 0, 0.4)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
          MVP
        </span>
        {isCurrentPlayer && (
          <span className="text-[10px] text-safety-cyan bg-safety-cyan/10 px-2 py-0.5 rounded-full font-bold">
            YOU
          </span>
        )}
        {player.isBot && (
          <span className="text-[10px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full">
            BOT
          </span>
        )}
      </div>

      <div className="flex items-end justify-between mt-2">
        <div>
          <span className="text-text-primary text-2xl font-bold block">
            {player.username}
          </span>
          <span className="text-text-muted text-xs font-mono-numbers">
            {player.tradeCount} trades &middot; {roleLabel(player.role)}
          </span>
        </div>
        <div className="text-right">
          <span className="font-mono-numbers text-3xl font-bold text-text-primary block">
            ${fmt(player.finalBalance)}
          </span>
          <span className={`font-mono-numbers text-sm ${pnlColor}`}>
            {pnlSign}${fmt(Math.abs(pnl))}
          </span>
        </div>
      </div>
    </div>
  );
}

function BotNarrativeCard({
  bot,
  buyIn,
  index,
}: {
  bot: PayoutResult;
  buyIn: number;
  index: number;
}) {
  const pnl = Math.round((bot.finalBalance - buyIn) * 100) / 100;

  let narrative: string;
  let accentColor: string;
  let bgClass: string;

  switch (bot.role) {
    case "alpha":
      narrative = `CARRIED the team with +$${fmt(Math.abs(pnl))} profit!`;
      accentColor = "text-alpha-green";
      bgClass = "bg-alpha-green/5 border-alpha-green/20";
      break;
    case "rescue":
      narrative = `Needed rescuing (-$${fmt(Math.abs(pnl))} deficit)`;
      accentColor = "text-rekt-crimson";
      bgClass = "bg-rekt-crimson/5 border-rekt-crimson/20";
      break;
    case "forfeited":
      narrative = `Exited mid-game — $${fmt(Math.abs(pnl + buyIn))} sent to Safety Net`;
      accentColor = "text-rekt-crimson";
      bgClass = "bg-rekt-crimson/5 border-rekt-crimson/20";
      break;
    case "inactive":
      narrative = "Went AFK — fewer than 5 trades, ineligible for payouts";
      accentColor = "text-text-muted";
      bgClass = "bg-bg-elevated/50 border-border-default";
      break;
    default:
      narrative = "Broke even -- steady as she goes";
      accentColor = "text-safety-cyan";
      bgClass = "bg-safety-cyan/5 border-safety-cyan/20";
  }

  return (
    <div
      className={`flex items-center gap-3 border rounded-xl p-3 animate-scale-in ${bgClass}`}
      style={{ animationDelay: `${0.3 + index * 0.1}s` }}
    >
      <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border-hover flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-safety-cyan">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="3" />
          <line x1="12" y1="8" x2="12" y2="11" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-text-primary text-sm font-semibold">{bot.username}</span>
        <span className={`text-xs block ${accentColor}`}>{narrative}</span>
      </div>
      <span className="font-mono-numbers text-xs text-text-muted shrink-0">
        ${fmt(bot.finalBalance)}
      </span>
    </div>
  );
}

function PayoutFlowSummary({
  safetyNetTotal,
  bailoutDistributed,
  spilloverDistributed,
}: {
  safetyNetTotal: number;
  bailoutDistributed: number;
  spilloverDistributed: number;
}) {
  const maxVal = Math.max(safetyNetTotal, bailoutDistributed, spilloverDistributed, 1);

  const flows = [
    {
      label: "Safety Net Collected",
      value: safetyNetTotal,
      color: "bg-safety-cyan",
      textColor: "text-safety-cyan",
      icon: "\u25B2", // ▲
      description: "20% tax from Alpha winners + early-exit forfeitures",
    },
    {
      label: "Bailout Distributed",
      value: bailoutDistributed,
      color: "bg-rekt-crimson",
      textColor: "text-rekt-crimson",
      icon: "\u25BC", // ▼
      description: "Split evenly among Rescue players (capped at buy-in)",
    },
    {
      label: "Spillover Returned",
      value: spilloverDistributed,
      color: "bg-alpha-green",
      textColor: "text-alpha-green",
      icon: "\u21BB", // ↻
      description: "Unused Safety Net returned to Alphas proportionally",
    },
  ];

  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-4 space-y-4">
      {flows.map((flow, i) => (
        <div key={flow.label}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${flow.textColor}`}>{flow.icon}</span>
              <span className="text-text-primary text-xs font-semibold">{flow.label}</span>
            </div>
            <span className={`font-mono-numbers text-sm font-bold ${flow.textColor}`}>
              ${fmt(flow.value)}
            </span>
          </div>
          <div className="w-full bg-bg-primary rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${flow.color} rounded-full animate-flow-bar`}
              style={{
                width: `${Math.max(2, (flow.value / maxVal) * 100)}%`,
                animationDelay: `${0.3 + i * 0.2}s`,
              }}
            />
          </div>
          <span className="text-text-muted text-[10px] mt-1 block">{flow.description}</span>
        </div>
      ))}
    </div>
  );
}

function PlayerResultCard({
  player,
  rank,
  buyIn,
  isCurrentPlayer,
  isMvp,
}: {
  player: PayoutResult;
  rank: number;
  buyIn: number;
  isCurrentPlayer: boolean;
  isMvp: boolean;
}) {
  const pnl = Math.round((player.finalBalance - buyIn) * 100) / 100;
  const pnlColor = pnl >= 0 ? "text-alpha-green" : "text-rekt-crimson";
  const pnlSign = pnl >= 0 ? "+" : "";

  return (
    <div
      className={`rounded-xl p-4 border transition-colors ${
        isCurrentPlayer ? "ring-1 ring-safety-cyan/40 " : ""
      }${roleBg(player.role)}`}
    >
      <div className="flex items-center gap-3">
        {/* Rank */}
        <span
          className={`font-mono-numbers text-lg font-bold w-7 text-center shrink-0 ${
            isMvp ? "text-yellow-400" : "text-text-muted"
          }`}
        >
          #{rank}
        </span>

        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            player.isBot
              ? "bg-bg-elevated border border-border-hover text-safety-cyan"
              : "bg-safety-cyan/10 border border-safety-cyan/20 text-safety-cyan"
          }`}
        >
          {player.isBot ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="3" />
              <line x1="12" y1="8" x2="12" y2="11" />
            </svg>
          ) : (
            player.username.slice(0, 2).toUpperCase()
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-text-primary font-semibold text-sm truncate">
              {player.username}
            </span>
            {isCurrentPlayer && (
              <span className="text-[10px] text-safety-cyan bg-safety-cyan/10 px-1.5 py-0.5 rounded">
                YOU
              </span>
            )}
            {player.isBot && (
              <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">
                BOT
              </span>
            )}
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${roleColor(player.role)} bg-bg-primary/50`}
            >
              {roleLabel(player.role)}
            </span>
          </div>
          <span className="text-text-muted text-[10px] font-mono-numbers">
            {player.tradeCount} trades
          </span>
        </div>

        {/* Balance + PnL */}
        <div className="text-right shrink-0">
          <span className="font-mono-numbers text-sm font-bold text-text-primary block">
            ${fmt(player.finalBalance)}
          </span>
          <span className={`font-mono-numbers text-[10px] ${pnlColor}`}>
            {pnlSign}${fmt(Math.abs(pnl))}
          </span>
        </div>
      </div>

      {/* Payout flow details — only for players who went through redistribution */}
      {player.role !== "even" && player.role !== "inactive" && player.role !== "forfeited" && (
        <div className="mt-2 pt-2 border-t border-border-default/50 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono-numbers text-text-muted">
          <span>Raw: ${fmt(player.rawBalance)}</span>
          {player.alphaTax > 0 && (
            <span className="text-rekt-crimson">Tax: -${fmt(player.alphaTax)}</span>
          )}
          {player.bailoutReceived > 0 && (
            <span className="text-safety-cyan">Bailout: +${fmt(player.bailoutReceived)}</span>
          )}
          {player.spilloverReceived > 0 && (
            <span className="text-alpha-green">Spillover: +${fmt(player.spilloverReceived)}</span>
          )}
          {player.botProfitRouted !== 0 && (
            <span className={player.botProfitRouted > 0 ? "text-alpha-green" : "text-rekt-crimson"}>
              Bot {player.botProfitRouted > 0 ? "Received" : "Routed"}:{" "}
              {player.botProfitRouted > 0 ? "+" : ""}${fmt(player.botProfitRouted)}
            </span>
          )}
        </div>
      )}

      {player.role === "forfeited" && (
        <div className="mt-2 pt-2 border-t border-border-default/50 text-[10px] text-rekt-crimson/80">
          Exited mid-game — ${fmt(player.rawBalance)} forfeited to Safety Net
        </div>
      )}

      {player.role === "inactive" && (
        <div className="mt-2 pt-2 border-t border-border-default/50 text-[10px] text-text-muted">
          Fewer than 5 trades — balance retained, ineligible for bailout or spillover
        </div>
      )}
    </div>
  );
}

function YourResultCard({
  player,
  buyIn,
}: {
  player: PayoutResult;
  buyIn: number;
}) {
  const pnl = Math.round((player.finalBalance - buyIn) * 100) / 100;
  const pnlColor = pnl >= 0 ? "text-alpha-green" : "text-rekt-crimson";
  const pnlSign = pnl >= 0 ? "+" : "";
  const isWinner = pnl >= 0;

  return (
    <div className="bg-bg-surface border border-safety-cyan/30 rounded-2xl p-6 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          background: isWinner
            ? "linear-gradient(135deg, #00FFA3, transparent)"
            : "linear-gradient(135deg, #FF3366, transparent)",
        }}
      />

      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-safety-cyan text-xs font-bold uppercase tracking-wider">
            Your Results
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${roleColor(player.role)} bg-bg-primary/50`}
          >
            {roleLabel(player.role)}
          </span>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <span className="text-text-muted text-xs block mb-1">Final Balance</span>
            <span className="font-mono-numbers text-4xl font-bold text-text-primary">
              ${fmt(player.finalBalance)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-text-muted text-xs block mb-1">Net P&L</span>
            <span className={`font-mono-numbers text-2xl font-bold ${pnlColor}`}>
              {pnlSign}${fmt(Math.abs(pnl))}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border-default/50">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-alpha-green">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-text-secondary text-xs">
              Balance credited to your account
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function roleColor(role: PayoutRole): string {
  switch (role) {
    case "alpha":     return "text-alpha-green";
    case "rescue":    return "text-rekt-crimson";
    case "inactive":  return "text-text-muted";
    case "even":      return "text-safety-cyan";
    case "forfeited": return "text-rekt-crimson";
  }
}

function roleBg(role: PayoutRole): string {
  switch (role) {
    case "alpha":     return "bg-alpha-green/10 border-alpha-green/20";
    case "rescue":    return "bg-rekt-crimson/10 border-rekt-crimson/20";
    case "inactive":  return "bg-bg-elevated border-border-default opacity-50";
    case "even":      return "bg-safety-cyan/5 border-safety-cyan/20";
    case "forfeited": return "bg-rekt-crimson/5 border-rekt-crimson/30 opacity-60";
  }
}

function roleLabel(role: PayoutRole): string {
  switch (role) {
    case "alpha":     return "ALPHA";
    case "rescue":    return "RESCUE";
    case "inactive":  return "INACTIVE";
    case "even":      return "EVEN";
    case "forfeited": return "FORFEITED";
  }
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
