"use client";

import { useState, useEffect, useCallback } from "react";
import { getOrCreatePlayer, getPlayerById } from "@/lib/actions/player";
import { findOrCreateLobby, joinLobby, getLobbyPlayers, getLobby } from "@/lib/actions/lobby";
import type { Player, Lobby, LobbyPlayer } from "@/lib/types/database";
import type { DerivActiveSymbol } from "@/lib/types/deriv";
import { getOrAssignAvatar, syncAvatarCookie, getAvatarUrl } from "@/lib/avatar";
import { useActiveSymbols, getMarketLabel, getSubmarketLabel } from "@/hooks/useActiveSymbols";
import type { PayoutSummary } from "@/lib/game/payout-engine";
import Navbar from "@/components/Navbar";
import UsernameForm from "@/components/UsernameForm";
import LobbyView from "@/components/LobbyView";
import GameView from "@/components/GameView";
import PostGameView from "@/components/PostGameView";

type PlayPhase = "login" | "market-select" | "matchmaking" | "lobby" | "game" | "post-game";

const BUY_IN_OPTIONS = [100, 500, 1_000, 5_000, 10_000];

export default function PlayPage() {
  const [phase, setPhase] = useState<PlayPhase>("login");
  const [player, setPlayer] = useState<Player | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<(LobbyPlayer & { player: Player })[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null);

  // Restore session from localStorage
  useEffect(() => {
    const savedPlayerId = localStorage.getItem("lot_player_id");
    if (savedPlayerId) {
      console.log("[Play] Restoring session for player:", savedPlayerId);
      getPlayerById(savedPlayerId).then((p) => {
        if (p) {
          if (p.avatar_id) syncAvatarCookie(p.avatar_id);
          setPlayer(p);
          setPhase("market-select");
          console.log("[Play] Session restored:", p.username);
        }
      });
    }
  }, []);

  const handleLogin = async (username: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const avatarId = getOrAssignAvatar();
      const p = await getOrCreatePlayer(username, avatarId);
      // Keep cookie in sync with whatever the DB ended up with
      if (p.avatar_id) syncAvatarCookie(p.avatar_id);
      setPlayer(p);
      localStorage.setItem("lot_player_id", p.id);
      console.log(`[Play] Logged in as: ${p.username} ($${p.game_token_balance})`);
      setPhase("market-select");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create player");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFindMatch = async (buyIn: number, symbol: string) => {
    setIsLoading(true);
    setError(null);
    setPhase("matchmaking");
    try {
      const { lobby: foundLobby } = await findOrCreateLobby(buyIn, symbol, player!.id);
      console.log(`[Play] Matched to lobby: ${foundLobby.id} (${symbol})`);

      await joinLobby(foundLobby.id, player!.id);
      console.log(`[Play] Joined lobby: ${foundLobby.id}`);

      setLobby(foundLobby);
      setPhase("lobby");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join lobby");
      setPhase("market-select");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLobbyLocked = useCallback((lockedLobbyId: string) => {
    console.log(`[Play] Lobby ${lockedLobbyId} is locked — ready for game!`);
  }, []);

  const handleGameStart = useCallback(async (lobbyId: string) => {
    console.log(`[Play] Starting game for lobby: ${lobbyId}`);
    try {
      const players = await getLobbyPlayers(lobbyId);
      setAllPlayers(players);
      const lobbyData = await getLobby(lobbyId);
      if (lobbyData) setLobby(lobbyData);
      setPhase("game");
    } catch (err) {
      console.error("[Play] Failed to start game:", err);
      setError(err instanceof Error ? err.message : "Failed to start game");
    }
  }, []);

  const handleExitGame = useCallback(async () => {
    console.log("[Play] Player exited game — returning to market select");
    if (player) {
      const refreshed = await getPlayerById(player.id);
      if (refreshed) setPlayer(refreshed);
    }
    setLobby(null);
    setAllPlayers([]);
    setPayoutSummary(null);
    setPhase("market-select");
  }, [player]);

  return (
    <main className="min-h-screen bg-bg-primary">
      {phase !== "game" && phase !== "post-game" && <Navbar />}

      <div className={`${phase === "game" || phase === "post-game" ? "pt-6" : phase === "login" ? "pt-16" : "pt-24"} pb-16 px-6`}>
        {phase === "login" && (
          <div className="animate-fade-up">
            <UsernameForm
              onSubmit={handleLogin}
              isLoading={isLoading}
              error={error}
            />
          </div>
        )}

        {phase === "market-select" && player && (
          <div className="animate-fade-up">
            <MarketSelector
              player={player}
              buyInOptions={BUY_IN_OPTIONS}
              onFindMatch={handleFindMatch}
              onLogout={() => {
                localStorage.removeItem("lot_player_id");
                setPlayer(null);
                setPhase("login");
              }}
              isLoading={isLoading}
              error={error}
            />
          </div>
        )}

        {phase === "matchmaking" && (
          <div className="animate-fade-up flex flex-col items-center justify-center min-h-[60vh]">
            <div className="relative mb-8">
              <div className="w-16 h-16 border-2 border-safety-cyan/20 rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-2 border-safety-cyan border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Finding a Lobby...
            </h2>
            <p className="text-text-secondary text-sm">
              Matching you with traders on the same market
            </p>
          </div>
        )}

        {phase === "lobby" && lobby && player && (
          <div className="animate-fade-up">
            <LobbyView
              lobbyId={lobby.id}
              currentPlayer={player}
              onLobbyLocked={handleLobbyLocked}
              onGameStart={handleGameStart}
            />
          </div>
        )}

        {phase === "game" && lobby && player && (
          <div className="animate-fade-up">
            <GameView
              lobbyId={lobby.id}
              symbol={lobby.symbol}
              currentPlayer={player}
              allPlayers={allPlayers}
              buyIn={lobby.buy_in}
              onGameEnd={(summary) => {
                setPayoutSummary(summary);
                setPhase("post-game");
              }}
              onExitGame={handleExitGame}
            />
          </div>
        )}

        {phase === "post-game" && payoutSummary && lobby && player && (
          <div className="animate-fade-up">
            <PostGameView
              payoutSummary={payoutSummary}
              buyIn={lobby.buy_in}
              currentPlayerId={player.id}
              symbol={lobby.symbol}
              onPlayAgain={async () => {
                const refreshed = await getPlayerById(player.id);
                if (refreshed) setPlayer(refreshed);
                setLobby(null);
                setAllPlayers([]);
                setPayoutSummary(null);
                setPhase("market-select");
              }}
              onBackToMenu={async () => {
                const refreshed = await getPlayerById(player.id);
                if (refreshed) setPlayer(refreshed);
                setLobby(null);
                setAllPlayers([]);
                setPayoutSummary(null);
                setPhase("market-select");
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
/* ===================== MARKET SELECTOR ===================== */

function MarketSelector({
  player,
  buyInOptions,
  onFindMatch,
  onLogout,
  isLoading,
  error,
}: {
  player: Player;
  buyInOptions: number[];
  onFindMatch: (buyIn: number, symbol: string) => void;
  onLogout: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  const { grouped, isLoading: marketsLoading, error: marketsError } = useActiveSymbols();
  const [selectedSymbol, setSelectedSymbol] = useState<DerivActiveSymbol | null>(null);
  const [selectedBuyIn, setSelectedBuyIn] = useState<number | null>(null);
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);

  // Auto-expand the first market group
  useEffect(() => {
    if (grouped.length > 0 && !expandedMarket) {
      setExpandedMarket(grouped[0].market);
    }
  }, [grouped, expandedMarket]);

  const canSearch = selectedSymbol !== null && selectedBuyIn !== null && !isLoading;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Player header */}
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-safety-cyan/30 shrink-0">
              {player.avatar_id ? (
                <img
                  src={getAvatarUrl(player.avatar_id)}
                  alt={player.username}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="w-full h-full bg-safety-cyan/10 flex items-center justify-center">
                  <span className="text-safety-cyan font-bold text-sm">
                    {player.username.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div>
              <span className="text-text-primary font-semibold text-sm block">
                {player.username}
              </span>
              <span className="font-mono-numbers text-alpha-green text-xs">
                ${player.game_token_balance.toLocaleString()}
              </span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-text-muted text-xs hover:text-text-secondary transition-colors cursor-pointer"
          >
            Switch Player
          </button>
        </div>
      </div>

      {/* Step 1: Market Selection */}
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-mono-numbers text-safety-cyan text-sm font-bold">01</span>
          <h2 className="text-lg font-bold text-text-primary">Choose Your Market</h2>
        </div>
        <p className="text-text-muted text-sm mb-5 ml-8">
          Select an instrument to trade during the match.
        </p>

        {marketsLoading && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-5 h-5 border-2 border-safety-cyan border-t-transparent rounded-full animate-spin" />
            <span className="text-text-secondary text-sm">Loading markets from Deriv API...</span>
          </div>
        )}

        {marketsError && (
          <div className="bg-rekt-crimson/10 border border-rekt-crimson/30 rounded-lg px-4 py-3">
            <p className="text-rekt-crimson text-sm">{marketsError}</p>
          </div>
        )}

        {!marketsLoading && !marketsError && (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {grouped.map((group) => (
              <div key={group.market}>
                {/* Market category header */}
                <button
                  onClick={() =>
                    setExpandedMarket(
                      expandedMarket === group.market ? null : group.market
                    )
                  }
                  className="w-full flex items-center justify-between px-4 py-3 bg-bg-primary
                             border border-border-default rounded-lg hover:border-border-hover
                             transition-colors cursor-pointer"
                >
                  <span className="text-text-primary font-semibold text-sm">
                    {getMarketLabel(group.market)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted text-xs font-mono-numbers">
                      {group.submarkets.reduce((n, s) => n + s.symbols.length, 0)} instruments
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      className={`text-text-muted transition-transform ${
                        expandedMarket === group.market ? "rotate-180" : ""
                      }`}
                    >
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                  </div>
                </button>

                {/* Expanded submarkets + symbols */}
                {expandedMarket === group.market && (
                  <div className="mt-1 ml-4 space-y-2">
                    {group.submarkets.map((sub) => (
                      <div key={sub.submarket}>
                        <span className="text-text-muted text-xs uppercase tracking-wider px-2 block mb-1">
                          {getSubmarketLabel(sub.submarket)}
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {sub.symbols.map((sym) => {
                            const isSelected =
                              selectedSymbol?.underlying_symbol === sym.underlying_symbol;
                            return (
                              <button
                                key={sym.underlying_symbol}
                                onClick={() => setSelectedSymbol(sym)}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-lg
                                           text-left transition-all cursor-pointer border ${
                                  isSelected
                                    ? "bg-safety-cyan/10 border-safety-cyan/40 text-safety-cyan"
                                    : "bg-bg-surface border-border-default hover:border-border-hover"
                                }`}
                              >
                                <div className="min-w-0">
                                  <span className={`text-sm font-medium block truncate ${
                                    isSelected ? "text-safety-cyan" : "text-text-primary"
                                  }`}>
                                    {sym.underlying_symbol_name}
                                  </span>
                                  <span className="font-mono-numbers text-xs text-text-muted">
                                    {sym.underlying_symbol}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 ml-2 shrink-0">
                                  <span className="font-mono-numbers text-[10px] text-text-muted">
                                    pip {sym.pip_size}
                                  </span>
                                  <span className="w-2 h-2 rounded-full bg-alpha-green animate-live-pulse" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Buy-in Selection */}
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-mono-numbers text-safety-cyan text-sm font-bold">02</span>
          <h2 className="text-lg font-bold text-text-primary">Set Your Buy-in</h2>
        </div>
        <p className="text-text-muted text-sm mb-5 ml-8">
          Higher stakes, bigger rewards. Matched with players at the same level.
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {buyInOptions.map((amount) => {
            const canAfford = player.game_token_balance >= amount;
            const isSelected = selectedBuyIn === amount;
            return (
              <button
                key={amount}
                onClick={() => setSelectedBuyIn(amount)}
                disabled={!canAfford}
                className={`border rounded-xl py-3 px-2 text-center transition-all cursor-pointer
                  ${
                    isSelected
                      ? "bg-safety-cyan/10 border-safety-cyan/40"
                      : canAfford
                        ? "bg-bg-primary border-border-default hover:border-border-hover"
                        : "bg-bg-primary/50 border-border-default/50 opacity-40 cursor-not-allowed"
                  }`}
              >
                <span className={`font-mono-numbers text-base font-bold block ${
                  isSelected ? "text-safety-cyan" : "text-text-primary"
                }`}>
                  ${amount.toLocaleString()}
                </span>
                <span className="text-text-muted text-[10px] mt-0.5 block">
                  {amount <= 500
                    ? "Beginner"
                    : amount <= 1000
                      ? "Standard"
                      : amount <= 5000
                        ? "Pro"
                        : "High Roller"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rekt-crimson/10 border border-rekt-crimson/30 rounded-lg px-4 py-3 mb-6">
          <p className="text-rekt-crimson text-sm">{error}</p>
        </div>
      )}

      {/* Summary + Find Match */}
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6">
        {/* Selection summary */}
        {(selectedSymbol || selectedBuyIn) && (
          <div className="flex items-center gap-4 mb-5 flex-wrap">
            {selectedSymbol && (
              <div className="flex items-center gap-2 bg-bg-primary border border-border-default rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-alpha-green" />
                <span className="text-text-primary text-sm font-medium">
                  {selectedSymbol.underlying_symbol_name}
                </span>
                <span className="font-mono-numbers text-text-muted text-xs">
                  {selectedSymbol.underlying_symbol}
                </span>
              </div>
            )}
            {selectedBuyIn && (
              <div className="bg-bg-primary border border-border-default rounded-lg px-3 py-2">
                <span className="font-mono-numbers text-text-primary text-sm font-bold">
                  ${selectedBuyIn.toLocaleString()}
                </span>
                <span className="text-text-muted text-xs ml-1">buy-in</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => onFindMatch(selectedBuyIn!, selectedSymbol!.underlying_symbol)}
          disabled={!canSearch}
          className="w-full py-4 bg-safety-cyan text-bg-primary font-bold text-lg rounded-xl
                     btn-glow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                     disabled:shadow-none transition-all"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching...
            </span>
          ) : (
            "FIND MATCH"
          )}
        </button>

        {!selectedSymbol && !selectedBuyIn && (
          <p className="text-text-muted text-xs text-center mt-3">
            Select a market and buy-in to find a match.
          </p>
        )}
      </div>
    </div>
  );
}

