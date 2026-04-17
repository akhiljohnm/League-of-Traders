"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getOrCreatePlayer, getPlayerById } from "@/lib/actions/player";
import { findOrCreateLobby, joinLobby, getLobbyPlayers, getLobby } from "@/lib/actions/lobby";
import type { Player, Lobby, LobbyPlayer } from "@/lib/types/database";
import type { DerivActiveSymbol } from "@/lib/types/deriv";
import { getOrAssignAvatar, syncAvatarCookie, getAvatarUrl, AVATAR_IDS } from "@/lib/avatar";
import { useActiveSymbols, getMarketLabel, getSubmarketLabel } from "@/hooks/useActiveSymbols";
import { useDerivTicker } from "@/hooks/useDerivTicker";
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
  const [isMuted, setIsMuted] = useState(false);

  // Background music — lives here so it persists through post-game screen
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio("/assests/League%20of%20Traders%20Soundtrack.mp3");
    audio.loop = true;
    audio.volume = 0.4;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    if ((phase === "game" || phase === "post-game") && !isMuted) {
      audioRef.current.play().catch(() => {
        console.log("[Play] Audio autoplay blocked — user must interact first");
      });
    }
  }, [phase, isMuted]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.pause();
    } else if (phase === "game" || phase === "post-game") {
      audioRef.current.play().catch(() => {});
    }
  }, [isMuted, phase]);

  const stopMusic = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Shared tick provider — start streaming the lobby's symbol early
  const { setSymbol } = useDerivTicker();

  useEffect(() => {
    if ((phase === "lobby" || phase === "game") && lobby?.symbol) {
      setSymbol(lobby.symbol);
    }
  }, [phase, lobby?.symbol, setSymbol]);

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
    // Stop background music on exit
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsMuted(false);
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
      {phase === "login" && <Navbar />}

      <div className={`${phase === "market-select" || phase === "lobby" || phase === "game" || phase === "post-game" ? "" : phase === "matchmaking" ? "pt-6 pb-16 px-6" : "pt-16 pb-16 px-6"}`}>
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
              onBack={handleExitGame}
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
              isMuted={isMuted}
              onMuteToggle={() => setIsMuted((m) => !m)}
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
                stopMusic();
                const refreshed = await getPlayerById(player.id);
                if (refreshed) setPlayer(refreshed);
                setLobby(null);
                setAllPlayers([]);
                setPayoutSummary(null);
                setPhase("market-select");
              }}
              onBackToMenu={async () => {
                stopMusic();
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

const TIER_CONFIG: Record<string, { label: string; risk: string; color: string }> = {
  "100": { label: "CADET", risk: "LOW", color: "text-text-secondary" },
  "500": { label: "SCOUT", risk: "LOW", color: "text-text-secondary" },
  "1000": { label: "STANDARD", risk: "MED", color: "text-safety-cyan" },
  "5000": { label: "VETERAN", risk: "HIGH", color: "text-alpha-green" },
  "10000": { label: "APEX", risk: "MAX", color: "text-rekt-crimson" },
};

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
  const [selectedBuyIn, setSelectedBuyIn] = useState<number | null>(1_000);
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Auto-expand the first market group only once on initial load
  useEffect(() => {
    if (grouped.length > 0 && !hasAutoExpanded) {
      setExpandedMarket(grouped[0].market);
      setHasAutoExpanded(true);
    }
  }, [grouped, hasAutoExpanded]);

  // Auto-select default symbol (1HZ10V) once markets load
  useEffect(() => {
    if (grouped.length > 0 && !hasAutoSelected) {
      for (const group of grouped) {
        for (const sub of group.submarkets) {
          const match = sub.symbols.find((s) => s.underlying_symbol === "1HZ10V");
          if (match) {
            setSelectedSymbol(match);
            setExpandedMarket(group.market);
            setHasAutoSelected(true);
            return;
          }
        }
      }
    }
  }, [grouped, hasAutoSelected]);

  const canSearch = selectedSymbol !== null && selectedBuyIn !== null && !isLoading;
  const totalInstruments = grouped.reduce(
    (acc, g) => acc + g.submarkets.reduce((n, s) => n + s.symbols.length, 0),
    0
  );

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col" style={{
      background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,229,255,0.06) 0%, #09090B 60%)",
    }}>

      {/* ——— TOP BAR (full-width, matches lobby style) ——— */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-default/50">
        <div className="flex items-center gap-6">
          <a href="/" className="text-safety-cyan font-bold text-lg tracking-widest uppercase font-mono-numbers hover:brightness-125 transition-all">
            LEAGUE OF TRADERS
          </a>
        </div>

        <div className="flex items-center gap-5">
          {/* Player info inline */}
          <div className="flex items-center gap-2">
            <img
              src={getAvatarUrl(player.avatar_id ?? AVATAR_IDS[Math.abs(player.id.charCodeAt(0)) % AVATAR_IDS.length])}
              alt={player.username}
              className="w-7 h-7 rounded-full object-cover object-top border border-safety-cyan/30 shrink-0"
            />
            <span className="text-text-primary font-semibold text-sm hidden sm:block">
              {player.username}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Balance:</span>
            <span className="font-mono-numbers text-alpha-green font-bold">
              ${player.game_token_balance.toLocaleString()}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="text-text-muted text-xs hover:text-rekt-crimson transition-colors
                       cursor-pointer font-mono-numbers tracking-wider"
          >
            [LOGOUT]
          </button>
        </div>
      </div>

      {/* ——— CONTENT AREA ——— */}
      <div className="flex-1 px-6 py-6">
        <div className="w-full max-w-3xl mx-auto">

      {/* ——— SECTION: MARKET SELECTION ——— */}
      <div className="terminal-panel bg-bg-surface border border-border-default rounded-lg mb-5
                       overflow-hidden relative panel-scanline">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-default
                        bg-bg-primary/50">
          <div className="flex items-center gap-3">
            <span className="font-mono-numbers text-safety-cyan text-xs font-bold
                             bg-safety-cyan/10 px-2 py-0.5 rounded">01</span>
            <h2 className="font-display text-base font-bold text-text-primary uppercase tracking-wider">
              Select Market
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {!marketsLoading && !marketsError && (
              <>
                <span className="font-mono-numbers text-text-muted text-[10px]">
                  {totalInstruments} INSTRUMENTS
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-alpha-green animate-live-pulse" />
                <span className="font-mono-numbers text-alpha-green text-[10px]">LIVE</span>
              </>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="px-5 py-4">
          {marketsLoading && (
            <div className="flex items-center justify-center py-12 gap-3">
              <div className="relative">
                <div className="w-8 h-8 border border-safety-cyan/20 rounded-full" />
                <div className="absolute inset-0 w-8 h-8 border border-safety-cyan
                                border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <span className="text-text-secondary text-sm block">Connecting to Deriv Oracle...</span>
                <span className="font-mono-numbers text-text-muted text-[10px]">
                  FETCHING ACTIVE_SYMBOLS
                </span>
              </div>
            </div>
          )}

          {marketsError && (
            <div className="bg-rekt-crimson/5 border border-rekt-crimson/20 rounded-lg px-4 py-3
                            flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-rekt-crimson shrink-0" />
              <p className="text-rekt-crimson text-sm font-mono-numbers">{marketsError}</p>
            </div>
          )}

          {!marketsLoading && !marketsError && (
            <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
              {grouped.map((group) => {
                const isExpanded = expandedMarket === group.market;
                const symbolCount = group.submarkets.reduce(
                  (n, s) => n + s.symbols.length,
                  0
                );

                return (
                  <div key={group.market}>
                    {/* Market group accordion */}
                    <button
                      onClick={() =>
                        setExpandedMarket(isExpanded ? null : group.market)
                      }
                      className={`w-full flex items-center justify-between px-4 py-3
                                  border rounded-lg transition-all cursor-pointer group ${
                        isExpanded
                          ? "bg-bg-primary border-safety-cyan/20 shadow-[0_0_12px_rgba(0,229,255,0.06)]"
                          : "bg-bg-primary/60 border-border-default hover:border-border-hover"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Accent bar */}
                        <span className={`w-1 h-5 rounded-full transition-colors ${
                          isExpanded ? "bg-safety-cyan" : "bg-border-hover group-hover:bg-safety-cyan/40"
                        }`} />
                        <span className={`font-display text-sm font-bold uppercase tracking-wider ${
                          isExpanded ? "text-safety-cyan" : "text-text-primary"
                        }`}>
                          {getMarketLabel(group.market)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono-numbers text-text-muted text-[10px]
                                         bg-bg-surface px-2 py-0.5 rounded border border-border-default">
                          {symbolCount}
                        </span>
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          className={`accordion-chevron ${isExpanded ? "accordion-open" : ""}
                                      ${isExpanded ? "text-safety-cyan" : "text-text-muted"}`}
                        >
                          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor"
                                strokeWidth="1.5" fill="none" strokeLinecap="round" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded instruments */}
                    {isExpanded && (
                      <div className="mt-2 ml-3 space-y-3 pl-3 border-l border-border-default/50">
                        {group.submarkets.map((sub) => (
                          <div key={sub.submarket}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-4 h-[1px] bg-border-hover" />
                              <span className="font-mono-numbers text-text-muted text-[10px]
                                               uppercase tracking-[0.2em]">
                                {getSubmarketLabel(sub.submarket)}
                              </span>
                              <span className="flex-1 h-[1px] bg-border-default/30" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {sub.symbols.map((sym, idx) => {
                                const isSelected =
                                  selectedSymbol?.underlying_symbol === sym.underlying_symbol;
                                return (
                                  <button
                                    key={sym.underlying_symbol}
                                    onClick={() => setSelectedSymbol(sym)}
                                    style={{ animationDelay: `${idx * 30}ms` }}
                                    className={`instrument-card instrument-stagger
                                               flex items-center justify-between pl-4 pr-3 py-2.5
                                               rounded text-left cursor-pointer border
                                               ${isSelected
                                                 ? "instrument-selected bg-safety-cyan/8 border-safety-cyan/30"
                                                 : "bg-bg-primary/40 border-border-default/60 hover:border-border-hover hover:bg-bg-primary/80"
                                               }`}
                                  >
                                    <div className="min-w-0">
                                      <span className={`text-sm font-medium block truncate ${
                                        isSelected ? "text-safety-cyan" : "text-text-primary"
                                      }`}>
                                        {sym.underlying_symbol_name}
                                      </span>
                                      <span className={`font-mono-numbers text-[11px] ${
                                        isSelected ? "text-safety-cyan/60" : "text-text-muted"
                                      }`}>
                                        {sym.underlying_symbol}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 ml-2 shrink-0">
                                      <span className="font-mono-numbers text-[9px] text-text-muted/60
                                                       bg-bg-surface px-1.5 py-0.5 rounded border border-border-default/40">
                                        PIP {sym.pip_size}
                                      </span>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        isSelected ? "bg-safety-cyan" : "bg-alpha-green"
                                      } animate-live-pulse`} />
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ——— SECTION: BUY-IN SELECTION ——— */}
      <div className="terminal-panel bg-bg-surface border border-border-default rounded-lg mb-5 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-default
                        bg-bg-primary/50">
          <div className="flex items-center gap-3">
            <span className="font-mono-numbers text-safety-cyan text-xs font-bold
                             bg-safety-cyan/10 px-2 py-0.5 rounded">02</span>
            <h2 className="font-display text-base font-bold text-text-primary uppercase tracking-wider">
              Set Buy-In
            </h2>
          </div>
          <span className="font-mono-numbers text-text-muted text-[10px]">
            BALANCE: <span className="text-alpha-green">${player.game_token_balance.toLocaleString()}</span>
          </span>
        </div>

        <div className="px-5 py-4">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {buyInOptions.map((amount) => {
              const canAfford = player.game_token_balance >= amount;
              const isSelected = selectedBuyIn === amount;
              const tier = TIER_CONFIG[String(amount)] || TIER_CONFIG["100"];

              return (
                <button
                  key={amount}
                  onClick={() => setSelectedBuyIn(amount)}
                  disabled={!canAfford}
                  className={`tier-card rounded-lg py-3.5 px-2 text-center cursor-pointer border
                    ${isSelected
                      ? "tier-selected bg-safety-cyan/8 border-safety-cyan/30 shadow-[0_0_20px_rgba(0,229,255,0.1)]"
                      : canAfford
                        ? "bg-bg-primary border-border-default hover:border-border-hover hover:bg-bg-primary/80"
                        : "bg-bg-primary/30 border-border-default/30 opacity-30 cursor-not-allowed"
                    }`}
                >
                  <span className={`font-mono-numbers text-base font-bold block ${
                    isSelected ? "text-safety-cyan glow-cyan" : "text-text-primary"
                  }`}>
                    ${amount.toLocaleString()}
                  </span>
                  <span className={`font-mono-numbers text-[9px] mt-1 block tracking-[0.15em] ${
                    isSelected ? "text-safety-cyan/70" : tier.color
                  }`}>
                    {tier.label}
                  </span>
                  <span className={`font-mono-numbers text-[8px] mt-0.5 block ${
                    isSelected ? "text-safety-cyan/40" : "text-text-muted/50"
                  }`}>
                    RISK: {tier.risk}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ——— ERROR ——— */}
      {error && (
        <div className="bg-rekt-crimson/5 border border-rekt-crimson/20 rounded-lg px-4 py-3 mb-5
                        flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-rekt-crimson shrink-0 animate-live-pulse" />
          <p className="text-rekt-crimson text-sm font-mono-numbers">{error}</p>
        </div>
      )}

      {/* ——— LAUNCH PANEL ——— */}
      <div className="terminal-panel-green terminal-panel bg-bg-surface border border-border-default
                       rounded-lg overflow-hidden">
        {/* Selection readout */}
        <div className="px-5 py-4">
          {(selectedSymbol || selectedBuyIn) ? (
            <div className="mb-4">
              <span className="font-mono-numbers text-text-muted text-[10px] uppercase tracking-[0.2em] block mb-2">
                Match Configuration
              </span>
              <div className="flex items-center gap-3 flex-wrap">
                {selectedSymbol && (
                  <div className="flex items-center gap-2 bg-bg-primary border border-border-default
                                  rounded px-3 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-alpha-green animate-live-pulse" />
                    <span className="text-text-primary text-sm font-medium">
                      {selectedSymbol.underlying_symbol_name}
                    </span>
                    <span className="font-mono-numbers text-text-muted text-[10px] bg-bg-surface
                                     px-1.5 py-0.5 rounded">
                      {selectedSymbol.underlying_symbol}
                    </span>
                  </div>
                )}
                {selectedBuyIn && (
                  <div className="flex items-center gap-2 bg-bg-primary border border-border-default
                                  rounded px-3 py-2">
                    <span className="font-mono-numbers text-safety-cyan text-sm font-bold">
                      ${selectedBuyIn.toLocaleString()}
                    </span>
                    <span className="text-text-muted text-[10px]">BUY-IN</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40" />
              <span className="font-mono-numbers text-text-muted text-xs">
                SELECT A MARKET AND BUY-IN TO QUEUE
              </span>
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={() => onFindMatch(selectedBuyIn!, selectedSymbol!.underlying_symbol)}
            disabled={!canSearch}
            className={`w-full py-4 font-display font-bold text-lg tracking-[0.1em] uppercase
                       rounded-lg cursor-pointer transition-all clip-corner-sm
                       disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none
                       ${canSearch
                         ? "btn-find-match text-safety-cyan"
                         : "bg-bg-primary border border-border-default text-text-muted"
                       }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                <div className="relative">
                  <div className="w-5 h-5 border border-safety-cyan/30 rounded-full" />
                  <div className="absolute inset-0 w-5 h-5 border border-safety-cyan
                                  border-t-transparent rounded-full animate-spin" />
                </div>
                <span className="font-mono-numbers text-sm tracking-[0.2em]">SEARCHING...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="opacity-70">
                  <path d="M9 2L16 9L9 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M2 9H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                FIND MATCH
              </span>
            )}
          </button>
        </div>
      </div>

        </div>{/* end max-w-3xl */}
      </div>{/* end content area */}
    </div>
  );
}

