"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  getLobbyPlayers,
  hireMercenaryBot,
  startLobby,
  getLobby,
} from "@/lib/actions/lobby";
import type {
  Player,
  LobbyPlayer,
  BotStrategy,
  Lobby,
} from "@/lib/types/database";
import { getAvatarUrl } from "@/lib/avatar";
import { BOT_CATALOG } from "./BotSubscribeDialog";

interface LobbyViewProps {
  lobbyId: string;
  currentPlayer: Player;
  onLobbyLocked: (lobbyId: string) => void;
  onGameStart: (lobbyId: string) => void;
}

interface LobbySlot {
  lobbyPlayer: LobbyPlayer;
  player: Player;
}

const STRATEGY_META: Record<
  BotStrategy,
  { label: string; tag: string; tagColor: string; icon: string }
> = {
  trend_follower: {
    label: "Trend Follower",
    tag: "LOW RISK",
    tagColor: "bg-alpha-green/10 text-alpha-green border-alpha-green/20",
    icon: "📈",
  },
  mean_reverter: {
    label: "Mean Reverter",
    tag: "MED RISK",
    tagColor: "bg-safety-cyan/10 text-safety-cyan border-safety-cyan/20",
    icon: "🔄",
  },
  high_freq_gambler: {
    label: "HF Gambler",
    tag: "HIGH RISK",
    tagColor: "bg-rekt-crimson/10 text-rekt-crimson border-rekt-crimson/20",
    icon: "⚡",
  },
};

const MAX_LOBBY_SIZE = 5;
const MIN_LOBBY_SIZE = 2;

// Generate a deterministic color from a string
function colorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#00FFA3", "#00E5FF", "#FF3366", "#A855F7", "#F59E0B",
    "#3B82F6", "#EC4899", "#10B981", "#F97316", "#6366F1",
  ];
  return colors[Math.abs(hash) % colors.length];
}

export default function LobbyView({
  lobbyId,
  currentPlayer,
  onLobbyLocked,
  onGameStart,
}: LobbyViewProps) {
  const [slots, setSlots] = useState<LobbySlot[]>([]);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [isHiring, setIsHiring] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showBotMenu, setShowBotMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerBalance, setPlayerBalance] = useState(
    currentPlayer.game_token_balance
  );

  const loadPlayers = useCallback(async () => {
    try {
      const players = await getLobbyPlayers(lobbyId);
      setSlots(
        players.map((lp) => ({
          lobbyPlayer: lp,
          player: lp.player,
        }))
      );
    } catch (err) {
      console.error("[LobbyView] Failed to load players:", err);
    }
  }, [lobbyId]);

  const loadLobby = useCallback(async () => {
    const data = await getLobby(lobbyId);
    if (data) {
      setLobby(data);
      if (data.status === "locked") {
        onLobbyLocked(lobbyId);
      }
      if (data.status === "in_progress") {
        console.log("[LobbyView] Lobby already in_progress on load — navigating to game");
        onGameStart(lobbyId);
      }
    }
  }, [lobbyId, onLobbyLocked, onGameStart]);

  useEffect(() => {
    loadPlayers();
    loadLobby();
  }, [loadPlayers, loadLobby]);

  useEffect(() => {
    console.log(`[LobbyView] Subscribing to Realtime for lobby: ${lobbyId}`);

    const channel = supabase
      .channel(`lobby-${lobbyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lobby_players",
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => {
          console.log("[LobbyView] Realtime: New player joined — reloading");
          loadPlayers();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lobbies",
          filter: `id=eq.${lobbyId}`,
        },
        (payload) => {
          console.log("[LobbyView] Realtime: Lobby updated:", payload.new);
          const updated = payload.new as Lobby;
          setLobby(updated);
          if (updated.status === "locked") {
            onLobbyLocked(lobbyId);
          }
          if (updated.status === "in_progress") {
            console.log("[LobbyView] Realtime: Game started — redirecting to game screen");
            onGameStart(lobbyId);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[LobbyView] Realtime status: ${status}`);
      });

    return () => {
      console.log("[LobbyView] Unsubscribing from Realtime");
      supabase.removeChannel(channel);
    };
  }, [lobbyId, loadPlayers, onLobbyLocked, onGameStart]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const freshLobby = await getLobby(lobbyId);
        if (freshLobby) {
          setLobby((prev) => {
            if (prev?.status !== freshLobby.status) {
              console.log(`[LobbyView] Poll: Lobby status changed to ${freshLobby.status}`);
              if (freshLobby.status === "locked") {
                onLobbyLocked(lobbyId);
              }
              if (freshLobby.status === "in_progress") {
                console.log("[LobbyView] Poll: Game started — redirecting to game screen");
                onGameStart(lobbyId);
              }
            }
            return freshLobby;
          });
        }

        const freshPlayers = await getLobbyPlayers(lobbyId);
        setSlots((prev) => {
          if (prev.length !== freshPlayers.length) {
            console.log(`[LobbyView] Poll: Player count changed ${prev.length} → ${freshPlayers.length}`);
          }
          return freshPlayers.map((lp) => ({
            lobbyPlayer: lp,
            player: lp.player,
          }));
        });
      } catch (err) {
        console.error("[LobbyView] Poll error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [lobbyId, onLobbyLocked, onGameStart]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("players")
        .select("game_token_balance")
        .eq("id", currentPlayer.id)
        .single();
      if (data) setPlayerBalance(data.game_token_balance);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentPlayer.id]);

  const handleHireBot = async (strategy: BotStrategy) => {
    setIsHiring(true);
    setError(null);
    setShowBotMenu(false);
    try {
      const { bot } = await hireMercenaryBot(lobbyId, currentPlayer.id, strategy);
      console.log(`[LobbyView] Hired ${strategy} bot: ${bot.username}`);
      await loadPlayers();
      await loadLobby();
      const { data } = await supabase
        .from("players")
        .select("game_token_balance")
        .eq("id", currentPlayer.id)
        .single();
      if (data) setPlayerBalance(data.game_token_balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hire bot");
    } finally {
      setIsHiring(false);
    }
  };

  const handleStartGame = async () => {
    setIsStarting(true);
    setError(null);
    try {
      await startLobby(lobbyId, currentPlayer.id);
      console.log(`[LobbyView] Lobby started with ${slots.length} players`);
      onGameStart(lobbyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start lobby");
      setIsStarting(false);
    }
  };

  const emptySlots = MAX_LOBBY_SIZE - slots.length;
  const isLocked = lobby?.status === "locked";
  const isOwner = lobby?.owner_id === currentPlayer.id;
  const canStart = slots.length >= MIN_LOBBY_SIZE && !isLocked && isOwner;
  const buyIn = lobby?.buy_in ?? 100;

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col" style={{
      background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,229,255,0.06) 0%, #09090B 60%)",
    }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border-default/50">
        <div className="flex items-center gap-6">
          <span className="text-safety-cyan font-bold text-lg tracking-widest uppercase font-mono-numbers">
            LEAGUE OF TRADERS
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono-numbers font-bold px-2 py-1 rounded border bg-safety-cyan/10 text-safety-cyan border-safety-cyan/30 tracking-widest">
              CO-OP PvE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Balance:</span>
            <span className="font-mono-numbers text-alpha-green font-bold">
              ${playerBalance.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Market:</span>
            <span className="font-mono-numbers text-safety-cyan font-bold">
              {lobby?.symbol ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isLocked ? "bg-alpha-green" : "bg-safety-cyan animate-live-pulse"}`} />
            <span className={`text-xs font-mono-numbers font-bold tracking-widest ${isLocked ? "text-alpha-green" : "text-safety-cyan"}`}>
              {isLocked ? "LOCKED" : "WAITING"}
            </span>
          </div>
        </div>
      </div>

      {/* Main arena */}
      <div className="flex-1 flex flex-col items-center justify-start px-8 pt-10 pb-8">
        {/* VS divider label */}
        <div className="mb-8 text-center">
          <h2 className="text-text-muted text-sm font-bold tracking-[0.3em] uppercase mb-1">
            PRE-GAME LOBBY
          </h2>
          <div className="flex items-center gap-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-border-default" />
            <span className="font-mono-numbers text-text-muted/50 text-xs">
              {lobbyId.slice(0, 8).toUpperCase()}
            </span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-border-default" />
          </div>
        </div>

        {/* Portrait slots row — current player always centered */}
        {(() => {
          // Reorder so current player occupies the middle position (index 2 of 5)
          const display: (typeof slots[0] | null)[] = Array(MAX_LOBBY_SIZE).fill(null);
          const currentSlot = slots.find((s) => s.player.id === currentPlayer.id);
          const otherSlots   = slots.filter((s) => s.player.id !== currentPlayer.id);
          if (currentSlot) display[2] = currentSlot;
          const fillOrder = [1, 3, 0, 4];
          otherSlots.forEach((s, i) => { if (i < fillOrder.length) display[fillOrder[i]] = s; });

          return (
            <div className="flex items-end justify-center gap-2 sm:gap-3 w-full mb-10">
              {display.map((slot, i) => {
                if (slot) {
                  return (
                    <PortraitSlot
                      key={slot.lobbyPlayer.id}
                      index={i + 1}
                      player={slot.player}
                      isCurrentPlayer={slot.player.id === currentPlayer.id}
                      isOwner={slot.player.id === lobby?.owner_id}
                      hiredBy={slot.lobbyPlayer.hired_by}
                      buyIn={buyIn}
                      displayPosition={i}
                    />
                  );
                }
                return (
                  <EmptyPortraitSlot key={`empty-${i}`} index={i + 1} displayPosition={i} />
                );
              })}
            </div>
          );
        })()}

        {/* Error */}
        {error && (
          <div className="bg-rekt-crimson/10 border border-rekt-crimson/30 rounded-lg px-4 py-3 mb-6 max-w-md w-full text-center">
            <p className="text-rekt-crimson text-sm">{error}</p>
          </div>
        )}

        {/* Bottom action zone */}
        <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
          {/* Hire Bot + Start Game row */}
          <div className="flex items-center gap-4 w-full">
            {/* Hire bot button */}
            {!isLocked && emptySlots > 0 && (
              <div className="relative flex-1">
                <button
                  onClick={() => setShowBotMenu(!showBotMenu)}
                  disabled={isHiring}
                  className="w-full py-3 px-4 bg-bg-surface border border-border-hover rounded-xl
                             text-text-secondary text-sm font-bold tracking-widest uppercase
                             hover:border-safety-cyan/50 hover:text-safety-cyan transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={showBotMenu ? { borderColor: "rgba(0,229,255,0.4)", color: "#00E5FF" } : {}}
                >
                  {isHiring ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border-2 border-safety-cyan/40 border-t-safety-cyan rounded-full animate-spin" />
                      Hiring...
                    </span>
                  ) : (
                    "+ Hire Mercenary"
                  )}
                </button>

                {/* Bot strategy dropdown */}
                {showBotMenu && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 z-20 bg-bg-surface border border-safety-cyan/20 rounded-xl p-3 shadow-2xl"
                    style={{ boxShadow: "0 0 30px rgba(0,229,255,0.1)" }}
                  >
                    <p className="text-text-muted text-xs mb-3 text-center tracking-wider">
                      SELECT MERCENARY PROFILE — costs{" "}
                      <span className="font-mono-numbers text-text-secondary">${buyIn.toLocaleString()}</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(STRATEGY_META) as [BotStrategy, typeof STRATEGY_META[BotStrategy]][]).map(
                        ([strategy, meta]) => (
                          <button
                            key={strategy}
                            onClick={() => handleHireBot(strategy)}
                            disabled={isHiring}
                            className="flex flex-col items-center gap-1.5 bg-bg-elevated border border-alpha-green/30
                                       rounded-lg p-3 hover:border-alpha-green/60 transition-colors cursor-pointer
                                       disabled:opacity-40"
                          >
                            <span className="text-2xl">{meta.icon}</span>
                            <span className="text-text-primary text-xs font-semibold text-center leading-tight">
                              {meta.label}
                            </span>
                            <span className={`text-[9px] font-mono-numbers font-bold px-1.5 py-0.5 rounded border ${meta.tagColor}`}>
                              {meta.tag}
                            </span>
                            <span className="text-[9px] text-alpha-green font-mono-numbers bg-alpha-green/10 px-1 py-0.5 rounded">
                              DEPLOY
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Start Game / waiting */}
            {canStart && (
              <button
                onClick={handleStartGame}
                disabled={isStarting}
                className="flex-1 py-3 px-6 bg-alpha-green text-bg-primary font-bold text-sm
                           tracking-widest uppercase rounded-xl cursor-pointer
                           disabled:opacity-40 disabled:cursor-not-allowed transition-all
                           hover:brightness-110 active:scale-[0.98]"
                style={{ boxShadow: "0 0 25px rgba(0, 255, 163, 0.35), 0 0 60px rgba(0, 255, 163, 0.1)" }}
              >
                {isStarting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-bg-primary/40 border-t-bg-primary rounded-full animate-spin" />
                    Starting...
                  </span>
                ) : (
                  `Start Game — ${slots.length} Player${slots.length !== 1 ? "s" : ""}`
                )}
              </button>
            )}

            {isLocked && isOwner && (
              <button
                onClick={handleStartGame}
                disabled={isStarting}
                className="flex-1 py-3 px-6 bg-alpha-green text-bg-primary font-bold text-sm
                           tracking-widest uppercase rounded-xl cursor-pointer
                           disabled:opacity-40 transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ boxShadow: "0 0 25px rgba(0, 255, 163, 0.35)" }}
              >
                {isStarting ? "Starting..." : "START GAME"}
              </button>
            )}
          </div>

          {/* Status line */}
          <div className="flex items-center justify-center gap-3 text-xs text-text-muted">
            {!isOwner && !isLocked && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-safety-cyan animate-live-pulse" />
                Waiting for lobby owner to start...
              </span>
            )}
            {isLocked && !isOwner && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-alpha-green animate-live-pulse" />
                Lobby locked — game starting soon
              </span>
            )}
            {canStart && (
              <span className="text-text-muted/60">
                Minimum {MIN_LOBBY_SIZE} players met. Fill remaining slots or start now.
              </span>
            )}
            {!canStart && !isLocked && isOwner && slots.length < MIN_LOBBY_SIZE && (
              <span className="text-rekt-crimson/70">
                Need at least {MIN_LOBBY_SIZE} players to start
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

/* ===================== SUB-COMPONENTS ===================== */

// ── Banner SVG constants (shared between PortraitSlot and EmptyPortraitSlot) ──
const BW = 160;         // SVG viewBox width
const BH = 300;         // SVG viewBox height
const BCUT = 20;        // corner cut size (45° chamfer)
const BBODY_TOP = 0;    // banner cloth body starts at top of SVG
const BRING_CY = 62;    // profile ring centre Y — well inside the banner body
const BRING_R = 36;     // avatar clip radius (inner)
const BRING_OUTER = 44; // outer gold ring border radius (ring top at y=18, fully inside)

// Per-position depth scale & opacity (index 0=left-outer … 4=right-outer, 2=center)
const BANNER_SCALES  = [0.82, 0.92, 1.0, 0.92, 0.82];
const BANNER_OPACITY = [0.65, 0.82, 1.0, 0.82, 0.65];

/** Build the octagonal banner body path, optionally inset by `px` on all sides. */
function makeBannerPath(inset = 0): string {
  const c = BCUT + inset;
  const bt = BBODY_TOP + inset;
  const r = inset;
  return [
    `M ${c},${bt}`,
    `L ${BW - c},${bt}`,
    `L ${BW - r},${bt + BCUT}`,
    `L ${BW - r},${BH - c}`,
    `L ${BW - c},${BH - r}`,
    `L ${c},${BH - r}`,
    `L ${r},${BH - c}`,
    `L ${r},${bt + BCUT}`,
    `Z`,
  ].join(" ");
}

function PortraitSlot({
  index,
  player,
  isCurrentPlayer,
  isOwner,
  displayPosition,
}: {
  index: number;
  player: Player;
  isCurrentPlayer: boolean;
  isOwner: boolean;
  hiredBy: string | null;
  buyIn: number;
  displayPosition: number;
}) {
  const factionColor = isCurrentPlayer
    ? "#00E5FF"
    : player.is_bot
    ? "#A855F7"
    : isOwner
    ? "#00FFA3"
    : colorFromString(player.id);

  const uid = `p${player.id.replace(/-/g, "").slice(0, 10)}`;
  const body = makeBannerPath(0);
  const innerBody = makeBannerPath(5);
  const NP_TOP = BH - 46;
  // Badge row starts just below the ring
  const BADGE_Y = BRING_CY + BRING_OUTER + 10;

  const titleLabel = isOwner ? "COMMANDER" : isCurrentPlayer ? "ACTIVE" : "TRADER";
  const subtitleText =
    player.is_bot && player.bot_strategy
      ? STRATEGY_META[player.bot_strategy].label.toUpperCase()
      : titleLabel;
  const displayName =
    player.username.length > 12 ? player.username.slice(0, 12) + "…" : player.username;

  const scale   = BANNER_SCALES[displayPosition]  ?? 1.0;
  const opacity = BANNER_OPACITY[displayPosition] ?? 1.0;

  return (
    <div className="flex flex-col items-center flex-1"
      style={{ transform: `scale(${scale})`, opacity, transformOrigin: "50% 100%", transition: "transform 0.3s ease, opacity 0.3s ease" }}>
      <div
        className="relative w-full"
        style={{ aspectRatio: `${BW}/${BH}` }}
      >
        <svg
          viewBox={`0 0 ${BW} ${BH}`}
          className="absolute inset-0 w-full h-full"
          style={{ overflow: "visible" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id={`clip-${uid}`}>
              <path d={body} />
            </clipPath>
            <clipPath id={`ring-clip-${uid}`}>
              <circle cx={BW / 2} cy={BRING_CY} r={BRING_R} />
            </clipPath>
            {/* Cloth body gradient */}
            <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={factionColor} stopOpacity="0.22" />
              <stop offset="25%"  stopColor="#111118"      stopOpacity="1" />
              <stop offset="100%" stopColor="#09090b"      stopOpacity="1" />
            </linearGradient>
            {/* Subtle vertical cloth sheen (light reflection across fabric) */}
            <linearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="rgba(255,255,255,0)"    />
              <stop offset="40%"  stopColor="rgba(255,255,255,0.03)" />
              <stop offset="55%"  stopColor="rgba(255,255,255,0.07)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
            </linearGradient>
            {/* Gold gradient for all borders/accents */}
            <linearGradient id={`gold-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ead270" />
              <stop offset="45%"  stopColor="#f8e28a" />
              <stop offset="100%" stopColor="#9a6c08" />
            </linearGradient>
            {/* Bottom vignette */}
            <linearGradient id={`vig-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="55%"  stopColor="#09090b" stopOpacity="0"    />
              <stop offset="100%" stopColor="#09090b" stopOpacity="0.97" />
            </linearGradient>
          </defs>

          {/* ── 1. Banner body fill ── */}
          <path d={body} fill={`url(#bg-${uid})`} />

          {/* ── 2. Cloth horizontal weave texture ── */}
          {Array.from({ length: 28 }, (_, i) => {
            const y = 6 + i * 8;
            if (y >= NP_TOP) return null;
            return (
              <line key={i}
                x1={0} y1={y} x2={BW} y2={y}
                stroke="rgba(255,255,255,0.025)" strokeWidth="1"
                clipPath={`url(#clip-${uid})`}
              />
            );
          })}

          {/* ── 3. Vertical light sheen (fabric reflection) ── */}
          <path d={body} fill={`url(#sheen-${uid})`} />

          {/* ── 4. Bottom vignette ── */}
          <path d={body} fill={`url(#vig-${uid})`} />

          {/* ── 5. Nameplate background ── */}
          <rect
            x={0} y={NP_TOP} width={BW} height={BH - NP_TOP}
            fill="rgba(0,0,0,0.9)"
            clipPath={`url(#clip-${uid})`}
          />
          <line
            x1={BCUT} y1={NP_TOP} x2={BW - BCUT} y2={NP_TOP}
            stroke={factionColor} strokeWidth="1" strokeOpacity="0.45"
          />

          {/* ── 6. Nameplate text ── */}
          <text
            x={BW / 2} y={NP_TOP + 17}
            textAnchor="middle" fill={factionColor}
            fontSize="9.5" fontWeight="bold" letterSpacing="1.5"
            fontFamily="'JetBrains Mono', 'Roboto Mono', monospace"
          >
            {displayName.toUpperCase()}
          </text>
          <text
            x={BW / 2} y={NP_TOP + 32}
            textAnchor="middle" fill={factionColor} fillOpacity="0.4"
            fontSize="7" letterSpacing="2"
            fontFamily="'JetBrains Mono', 'Roboto Mono', monospace"
          >
            {subtitleText}
          </text>

          {/* ── 7. Gold outer border ── */}
          <path d={body} fill="none" stroke={`url(#gold-${uid})`} strokeWidth="2.5" />

          {/* ── 8. Gold inner border (double-line effect) ── */}
          <path d={innerBody} fill="none" stroke={`url(#gold-${uid})`} strokeWidth="0.9" strokeOpacity="0.4" />

          {/* ── 9. Faction stripe near banner top ── */}
          <line
            x1={BCUT} y1={BCUT} x2={BW - BCUT} y2={BCUT}
            stroke={factionColor} strokeWidth="2.5" strokeOpacity="0.7"
          />

          {/* ── 10. Corner bracket accents (LoL L-shapes) ── */}
          <polyline points={`${BCUT+10},${BCUT+2} ${BCUT+2},${BCUT+2} ${BCUT+2},${BCUT+13}`}
            fill="none" stroke={`url(#gold-${uid})`} strokeWidth="1.5" strokeOpacity="0.9" />
          <polyline points={`${BW-BCUT-10},${BCUT+2} ${BW-BCUT-2},${BCUT+2} ${BW-BCUT-2},${BCUT+13}`}
            fill="none" stroke={`url(#gold-${uid})`} strokeWidth="1.5" strokeOpacity="0.9" />
          <polyline points={`${BCUT+10},${BH-2} ${BCUT+2},${BH-2} ${BCUT+2},${BH-13}`}
            fill="none" stroke={`url(#gold-${uid})`} strokeWidth="1.5" strokeOpacity="0.9" />
          <polyline points={`${BW-BCUT-10},${BH-2} ${BW-BCUT-2},${BH-2} ${BW-BCUT-2},${BH-13}`}
            fill="none" stroke={`url(#gold-${uid})`} strokeWidth="1.5" strokeOpacity="0.9" />

          {/* ── 11. Bottom fan decoration ── */}
          {[-24, -12, 0, 12, 24].map((x, fi) => (
            <line key={fi}
              x1={BW / 2} y1={BH - 4}
              x2={BW / 2 + x} y2={BH - 20}
              stroke={`url(#gold-${uid})`} strokeWidth="1" strokeOpacity="0.55"
            />
          ))}
          <path
            d={`M ${BW/2 - 28},${BH - 18} A 28,9 0 0,1 ${BW/2 + 28},${BH - 18}`}
            fill="none" stroke={`url(#gold-${uid})`} strokeWidth="1.1" strokeOpacity="0.55"
          />

          {/* ── 12. Status badges (below the ring overlap zone) ── */}
          {isOwner && (
            <g>
              <rect x={6} y={BADGE_Y} rx="2" width={32} height={13} fill="#00FFA3" />
              <text x={22} y={BADGE_Y + 10} textAnchor="middle"
                fontSize="7.5" fontWeight="bold" fontFamily="monospace" fill="#09090b" letterSpacing="0.5">
                HOST
              </text>
            </g>
          )}
          {isCurrentPlayer && !isOwner && (
            <g>
              <rect x={6} y={BADGE_Y} rx="2" width={26} height={13} fill="#00E5FF" />
              <text x={19} y={BADGE_Y + 10} textAnchor="middle"
                fontSize="7.5" fontWeight="bold" fontFamily="monospace" fill="#09090b" letterSpacing="0.5">
                YOU
              </text>
            </g>
          )}
          {player.is_bot && (
            <g>
              <rect x={6} y={BADGE_Y + (isOwner ? 16 : 0)} rx="2" width={26} height={13}
                fill="#A855F7" fillOpacity="0.9" />
              <text x={19} y={BADGE_Y + (isOwner ? 26 : 10)} textAnchor="middle"
                fontSize="7.5" fontWeight="bold" fontFamily="monospace" fill="white" letterSpacing="0.5">
                BOT
              </text>
            </g>
          )}

          {/* ── 13. Profile ring — avatar lives here ── */}
          {/* Black backing behind avatar */}
          <circle cx={BW / 2} cy={BRING_CY} r={BRING_OUTER}
            fill="#0d0d11" />

          {/* Avatar image / bot icon / initials clipped to inner circle */}
          {player.avatar_id && !player.is_bot ? (
            <image
              href={getAvatarUrl(player.avatar_id)}
              x={BW / 2 - BRING_R} y={BRING_CY - BRING_R}
              width={BRING_R * 2} height={BRING_R * 2}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#ring-clip-${uid})`}
            />
          ) : (
            <g clipPath={`url(#ring-clip-${uid})`}>
              <circle cx={BW / 2} cy={BRING_CY} r={BRING_R}
                fill={`${factionColor}20`} />
              {player.is_bot ? (
                <g transform={`translate(${BW / 2 - 13}, ${BRING_CY - 13})`}
                  stroke={factionColor} fill="none" strokeWidth="1.8">
                  <rect x="0" y="7" width="26" height="17" rx="2" />
                  <circle cx="13" cy="3" r="3" />
                  <line x1="13" y1="6" x2="13" y2="7" />
                  <circle cx="8"  cy="15.5" r="2" fill={factionColor} stroke="none" />
                  <circle cx="18" cy="15.5" r="2" fill={factionColor} stroke="none" />
                </g>
              ) : (
                <text
                  x={BW / 2} y={BRING_CY + 9}
                  textAnchor="middle" fill={factionColor}
                  fontSize="24" fontWeight="900"
                  fontFamily="'JetBrains Mono', 'Roboto Mono', monospace"
                >
                  {player.username.slice(0, 2).toUpperCase()}
                </text>
              )}
            </g>
          )}

          {/* Gold outer ring border */}
          <circle cx={BW / 2} cy={BRING_CY} r={BRING_OUTER}
            fill="none" stroke={`url(#gold-${uid})`} strokeWidth="3.5" />
          {/* Inner thin ring */}
          <circle cx={BW / 2} cy={BRING_CY} r={BRING_R + 2}
            fill="none" stroke={`url(#gold-${uid})`} strokeWidth="0.8" strokeOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

function EmptyPortraitSlot({ index, displayPosition }: { index: number; displayPosition: number }) {
  const body = makeBannerPath(0);
  const scale   = BANNER_SCALES[displayPosition]  ?? 1.0;
  const opacity = (BANNER_OPACITY[displayPosition] ?? 1.0) * 0.4;

  return (
    <div className="flex flex-col items-center flex-1"
      style={{ transform: `scale(${scale})`, opacity, transformOrigin: "50% 100%", transition: "transform 0.3s ease, opacity 0.3s ease" }}>
      <div
        className="relative w-full"
        style={{ aspectRatio: `${BW}/${BH}` }}
      >
        <svg
          viewBox={`0 0 ${BW} ${BH}`}
          className="absolute inset-0 w-full h-full"
          style={{ overflow: "visible" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`empty-bg-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#1a1a20" />
              <stop offset="100%" stopColor="#0e0e12" />
            </linearGradient>
          </defs>

          {/* Banner body */}
          <path d={body} fill={`url(#empty-bg-${index})`} />

          {/* Dashed border */}
          <path d={body} fill="none"
            stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeDasharray="5 4" />

          {/* Slot number */}
          <text x={8} y={BCUT + 20}
            fill="rgba(255,255,255,0.1)" fontSize="10"
            fontFamily="monospace" fontWeight="bold">
            {index.toString().padStart(2, "0")}
          </text>

          {/* "Open slot" label */}
          <text x={BW / 2} y={BH - 16}
            textAnchor="middle" fill="rgba(255,255,255,0.2)"
            fontSize="8" fontFamily="monospace" letterSpacing="2">
            OPEN SLOT
          </text>

          {/* Dim ring (dashed, no avatar) */}
          <circle cx={BW / 2} cy={BRING_CY} r={BRING_OUTER}
            fill="#0e0e12" stroke="rgba(255,255,255,0.1)"
            strokeWidth="1.5" strokeDasharray="5 4" />
          {/* Silhouette icon inside ring */}
          <circle cx={BW / 2} cy={BRING_CY - 6} r={10}
            fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
          <path
            d={`M ${BW/2 - 14},${BRING_CY + 18} A 14,10 0 0,1 ${BW/2 + 14},${BRING_CY + 18}`}
            fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2"
          />
        </svg>
      </div>
    </div>
  );
}

