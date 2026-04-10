"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  getLobbyPlayers,
  hireMercenaryBot,
  startLobby,
  getLobby,
} from "@/lib/actions/lobby";
import {
  getPlayerSubscriptions,
  purchaseBotSubscription,
} from "@/lib/actions/subscription";
import type {
  Player,
  LobbyPlayer,
  BotStrategy,
  BotSubscription,
  Lobby,
} from "@/lib/types/database";
import { BOT_SUBSCRIPTION_COST } from "@/lib/types/database";
import BotSubscribeDialog, { BOT_CATALOG, type BotInfo } from "./BotSubscribeDialog";

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
  { label: string; tag: string; tagColor: string }
> = {
  trend_follower: {
    label: "Trend Follower",
    tag: "LOW RISK",
    tagColor: "bg-alpha-green/10 text-alpha-green border-alpha-green/20",
  },
  mean_reverter: {
    label: "Mean Reverter",
    tag: "MED RISK",
    tagColor: "bg-safety-cyan/10 text-safety-cyan border-safety-cyan/20",
  },
  high_freq_gambler: {
    label: "HF Gambler",
    tag: "HIGH RISK",
    tagColor: "bg-rekt-crimson/10 text-rekt-crimson border-rekt-crimson/20",
  },
};

const MAX_LOBBY_SIZE = 5;
const MIN_LOBBY_SIZE = 2;

export default function LobbyView({
  lobbyId,
  currentPlayer,
  onLobbyLocked,
  onGameStart,
}: LobbyViewProps) {
  const [slots, setSlots] = useState<LobbySlot[]>([]);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [isHiring, setIsHiring] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState<BotStrategy | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [showBotMenu, setShowBotMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerBalance, setPlayerBalance] = useState(
    currentPlayer.game_token_balance
  );
  const [subscriptions, setSubscriptions] = useState<BotSubscription[]>([]);
  const [dialogBot, setDialogBot] = useState<BotInfo | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

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

  const loadSubscriptions = useCallback(async () => {
    try {
      const subs = await getPlayerSubscriptions(currentPlayer.id);
      setSubscriptions(subs);
    } catch (err) {
      console.error("[LobbyView] Failed to load subscriptions:", err);
    }
  }, [currentPlayer.id]);

  const isStrategySubscribed = (strategy: BotStrategy): boolean => {
    return subscriptions.some(
      (s) => s.bot_strategy === strategy && s.is_active
    );
  };

  // Initial load
  useEffect(() => {
    loadPlayers();
    loadLobby();
    loadSubscriptions();
  }, [loadPlayers, loadLobby, loadSubscriptions]);

  // Supabase Realtime subscription for lobby_players
  useEffect(() => {
    console.log(
      `[LobbyView] Subscribing to Realtime for lobby: ${lobbyId}`
    );

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

  // Polling fallback: sync players and lobby status every 3s
  // This ensures sync works even if Supabase Realtime is broken (RLS, publication issues, etc.)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Poll lobby status
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

        // Poll players
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

  // Refresh player balance periodically
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
      const { bot, lobbyPlayer } = await hireMercenaryBot(lobbyId, currentPlayer.id, strategy);
      console.log(`[LobbyView] Hired ${strategy} bot: ${bot.username}`);
      // Optimistic update — add the bot to slots immediately
      setSlots((prev) => [...prev, { lobbyPlayer, player: bot }]);
      // Also refresh from server to ensure consistency
      await loadPlayers();
      // Refresh lobby status (may have locked)
      await loadLobby();
      // Refresh balance
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

  const openSubscribeDialog = (strategy: BotStrategy) => {
    const bot = BOT_CATALOG.find((b) => b.strategy === strategy);
    if (bot) {
      setDialogError(null);
      setDialogBot(bot);
    }
  };

  const handleSubscribeConfirm = async () => {
    if (!dialogBot) return;
    setIsSubscribing(dialogBot.strategy);
    setDialogError(null);
    try {
      await purchaseBotSubscription(currentPlayer.id, dialogBot.strategy);
      console.log(`[LobbyView] Subscribed to ${dialogBot.strategy}`);
      await loadSubscriptions();
      // Refresh balance
      const { data } = await supabase
        .from("players")
        .select("game_token_balance")
        .eq("id", currentPlayer.id)
        .single();
      if (data) setPlayerBalance(data.game_token_balance);
      setDialogBot(null);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Failed to subscribe");
    } finally {
      setIsSubscribing(null);
    }
  };

  const handleStartGame = async () => {
    setIsStarting(true);
    setError(null);
    try {
      await startLobby(lobbyId, currentPlayer.id);
      console.log(`[LobbyView] Lobby started with ${slots.length} players`);
      // Owner navigates immediately — other players navigate via Realtime UPDATE handler
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
    <div className="w-full max-w-2xl mx-auto">
      {/* Lobby Header */}
      <div className="bg-bg-surface border border-border-default rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isLocked ? "bg-alpha-green" : "bg-safety-cyan animate-live-pulse"
              }`}
            />
            <h2 className="text-xl font-bold text-text-primary">
              {isLocked ? "LOBBY LOCKED" : "WAITING FOR PLAYERS"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-numbers text-2xl font-bold text-text-primary">
              {slots.length}
            </span>
            <span className="text-text-muted">/</span>
            <span className="font-mono-numbers text-2xl font-bold text-text-muted">
              {MAX_LOBBY_SIZE}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-bg-primary rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isLocked ? "bg-alpha-green" : "bg-safety-cyan"
            }`}
            style={{ width: `${(slots.length / MAX_LOBBY_SIZE) * 100}%` }}
          />
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="flex items-center gap-4 flex-wrap">
            {lobby?.symbol && (
              <span className="text-text-muted">
                Market:{" "}
                <span className="font-mono-numbers text-safety-cyan">
                  {lobby.symbol}
                </span>
              </span>
            )}
            <span className="text-text-muted">
              Buy-in:{" "}
              <span className="font-mono-numbers text-text-primary">
                ${buyIn.toLocaleString()}
              </span>
            </span>
            <span className="text-text-muted">
              Balance:{" "}
              <span className="font-mono-numbers text-alpha-green">
                ${playerBalance.toLocaleString()}
              </span>
            </span>
          </div>
          <span className="text-text-muted font-mono-numbers text-xs">
            {lobbyId.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* Player Slots */}
      <div className="space-y-3 mb-6">
        {slots.map((slot, i) => (
          <PlayerCard
            key={slot.lobbyPlayer.id}
            index={i + 1}
            player={slot.player}
            isCurrentPlayer={slot.player.id === currentPlayer.id}
            isOwner={slot.player.id === lobby?.owner_id}
            hiredBy={slot.lobbyPlayer.hired_by}
            buyIn={buyIn}
          />
        ))}

        {/* Empty slots */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <EmptySlot key={`empty-${i}`} index={slots.length + i + 1} />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rekt-crimson/10 border border-rekt-crimson/30 rounded-lg px-4 py-3 mb-6">
          <p className="text-rekt-crimson text-sm">{error}</p>
        </div>
      )}

      {/* Start Game Button (owner only) */}
      {canStart && (
        <div className="mb-6">
          <button
            onClick={handleStartGame}
            disabled={isStarting}
            className="w-full py-4 bg-alpha-green text-bg-primary font-bold text-lg rounded-xl
                       cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all
                       hover:brightness-110 active:scale-[0.98]"
            style={{ boxShadow: "0 0 20px rgba(0, 255, 163, 0.3), 0 0 60px rgba(0, 255, 163, 0.1)" }}
          >
            {isStarting ? "Starting..." : `START GAME (${slots.length} Players)`}
          </button>
          <p className="text-text-muted text-xs text-center mt-2">
            Minimum {MIN_LOBBY_SIZE} players required. You can add more or start now.
          </p>
        </div>
      )}

      {/* Non-owner waiting message */}
      {!isOwner && !isLocked && slots.length >= MIN_LOBBY_SIZE && (
        <div className="mb-6 text-center">
          <p className="text-text-muted text-sm">
            Waiting for lobby owner to start the game...
          </p>
        </div>
      )}

      {/* Hire Bot Panel */}
      {!isLocked && emptySlots > 0 && (
        <div className="bg-bg-surface border border-border-default rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-text-primary font-semibold">
                Hire a Mercenary Bot
              </h3>
              <p className="text-text-muted text-sm">
                Fill empty slots with AI traders (costs{" "}
                <span className="font-mono-numbers text-text-secondary">
                  ${buyIn.toLocaleString()}
                </span>{" "}
                each)
              </p>
            </div>
            <button
              onClick={() => setShowBotMenu(!showBotMenu)}
              disabled={isHiring}
              className="px-4 py-2 bg-bg-elevated border border-border-hover rounded-lg text-text-primary
                         text-sm font-medium hover:border-safety-cyan hover:text-safety-cyan
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isHiring ? "Hiring..." : showBotMenu ? "Cancel" : "+ Hire Bot"}
            </button>
          </div>

          {/* Bot strategy selector */}
          {showBotMenu && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                Object.entries(STRATEGY_META) as [
                  BotStrategy,
                  (typeof STRATEGY_META)[BotStrategy],
                ][]
              ).map(([strategy, meta]) => {
                const subscribed = isStrategySubscribed(strategy);
                const subscribingThis = isSubscribing === strategy;

                return subscribed ? (
                  /* UNLOCKED — can hire */
                  <button
                    key={strategy}
                    onClick={() => handleHireBot(strategy)}
                    disabled={isHiring}
                    className="bg-bg-primary border border-alpha-green/30 rounded-xl p-4 text-left
                               hover:border-alpha-green/60 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-primary font-semibold text-sm">
                        {meta.label}
                      </span>
                      <span
                        className={`${meta.tagColor} text-[9px] font-mono-numbers font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border`}
                      >
                        {meta.tag}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted text-xs">
                        ${buyIn.toLocaleString()} buy-in
                      </span>
                      <span className="text-[9px] text-alpha-green font-mono-numbers font-bold bg-alpha-green/10 px-1.5 py-0.5 rounded">
                        UNLOCKED
                      </span>
                    </div>
                  </button>
                ) : (
                  /* LOCKED — must subscribe */
                  <button
                    key={strategy}
                    onClick={() => openSubscribeDialog(strategy)}
                    disabled={!!isSubscribing}
                    className="relative bg-bg-primary border border-border-default rounded-xl p-4 text-left
                               hover:border-safety-cyan/40 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-muted font-semibold text-sm">
                        {meta.label}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-text-muted">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted text-xs">
                        <span className="font-mono-numbers text-text-secondary font-bold">${BOT_SUBSCRIPTION_COST}</span>/mo
                      </span>
                      <span className="text-[9px] text-safety-cyan font-mono-numbers font-bold bg-safety-cyan/10 px-1.5 py-0.5 rounded">
                        {subscribingThis ? "SUBSCRIBING..." : "SUBSCRIBE"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Locked state */}
      {isLocked && (
        <div className="bg-alpha-green/5 border border-alpha-green/20 rounded-2xl p-6 text-center">
          <div className="text-alpha-green text-3xl mb-3">&#9989;</div>
          <h3 className="text-alpha-green font-bold text-lg mb-1">
            Lobby Locked — Ready to Trade!
          </h3>
          <p className="text-text-secondary text-sm mb-4">
            {slots.length} players in the arena.
          </p>
          {isOwner ? (
            <button
              onClick={handleStartGame}
              disabled={isStarting}
              className="px-8 py-3 bg-alpha-green text-bg-primary font-bold text-lg rounded-xl
                         cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all
                         hover:brightness-110 active:scale-[0.98]"
              style={{ boxShadow: "0 0 20px rgba(0, 255, 163, 0.3), 0 0 60px rgba(0, 255, 163, 0.1)" }}
            >
              {isStarting ? "Starting..." : "START GAME"}
            </button>
          ) : (
            <p className="text-text-muted text-sm">
              Waiting for lobby owner to start the game...
            </p>
          )}
        </div>
      )}

      {/* Bot Subscribe Dialog */}
      {dialogBot && (
        <BotSubscribeDialog
          bot={dialogBot}
          onConfirm={handleSubscribeConfirm}
          onCancel={() => { setDialogBot(null); setDialogError(null); }}
          isPurchasing={isSubscribing === dialogBot.strategy}
          error={dialogError}
        />
      )}
    </div>
  );
}

/* ===================== SUB-COMPONENTS ===================== */

function PlayerCard({
  index,
  player,
  isCurrentPlayer,
  isOwner,
  hiredBy,
  buyIn,
}: {
  index: number;
  player: Player;
  isCurrentPlayer: boolean;
  isOwner: boolean;
  hiredBy: string | null;
  buyIn: number;
}) {
  return (
    <div
      className={`flex items-center gap-4 bg-bg-surface border rounded-xl p-4 transition-colors ${
        isCurrentPlayer
          ? "border-safety-cyan/40"
          : "border-border-default"
      }`}
    >
      {/* Slot number */}
      <span className="font-mono-numbers text-lg font-bold text-text-muted w-6 text-center">
        {index}
      </span>

      {/* Avatar placeholder */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
          player.is_bot
            ? "bg-bg-elevated border border-border-hover text-safety-cyan"
            : "bg-safety-cyan/10 border border-safety-cyan/20 text-safety-cyan"
        }`}
      >
        {player.is_bot ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="3" />
            <line x1="12" y1="8" x2="12" y2="11" />
            <circle cx="8" cy="16" r="1.5" fill="currentColor" />
            <circle cx="16" cy="16" r="1.5" fill="currentColor" />
          </svg>
        ) : (
          player.username.slice(0, 2).toUpperCase()
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-semibold text-sm truncate">
            {player.username}
          </span>
          {isOwner && (
            <span className="text-[10px] text-alpha-green bg-alpha-green/10 px-1.5 py-0.5 rounded font-mono-numbers">
              OWNER
            </span>
          )}
          {isCurrentPlayer && (
            <span className="text-[10px] text-safety-cyan bg-safety-cyan/10 px-1.5 py-0.5 rounded font-mono-numbers">
              YOU
            </span>
          )}
          {player.is_bot && (
            <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded font-mono-numbers">
              BOT
            </span>
          )}
          {hiredBy && (
            <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded font-mono-numbers">
              HIRED
            </span>
          )}
        </div>
        <span className="text-text-muted text-xs">
          {player.is_bot && player.bot_strategy
            ? STRATEGY_META[player.bot_strategy].label
            : `Paid $${buyIn.toLocaleString()} buy-in`}
        </span>
      </div>

      {/* Status indicator */}
      <div className="w-2.5 h-2.5 rounded-full bg-alpha-green animate-live-pulse" />
    </div>
  );
}

function EmptySlot({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-4 bg-bg-surface/50 border border-border-default border-dashed rounded-xl p-4">
      <span className="font-mono-numbers text-lg font-bold text-text-muted/50 w-6 text-center">
        {index}
      </span>
      <div className="w-10 h-10 rounded-full bg-bg-elevated/50 border border-border-default border-dashed" />
      <div className="flex-1">
        <span className="text-text-muted/50 text-sm">Waiting for player...</span>
      </div>
    </div>
  );
}
