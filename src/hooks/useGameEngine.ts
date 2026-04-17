"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useDerivTicker } from "@/hooks/useDerivTicker";
import { BotEngine } from "@/lib/bots/engine";
import {
  placeTrade as placeTradeToDb,
  resolveTrade as resolveTradeInDb,
  getPayoutMultiplier,
} from "@/lib/game/rise-fall";
import {
  endGame,
  updatePlayerFinalBalance,
} from "@/lib/actions/lobby";
import { creditPlayerBalance } from "@/lib/actions/player";
import {
  calculatePayouts,
  type PayoutSummary,
  type PayoutInput,
} from "@/lib/game/payout-engine";
import { supabase } from "@/lib/supabase";
import type { DerivTick } from "@/lib/types/deriv";
import type {
  Player,
  LobbyPlayer,
  TradeDirection,
} from "@/lib/types/database";

// ============================================================
// Game Engine Hook — Orchestrates the entire game loop
// ============================================================

const GAME_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export type GamePhase = "starting" | "active" | "ending" | "finished";

export interface PendingHumanTrade {
  tradeId: string;
  direction: TradeDirection;
  stake: number;
  entryPrice: number;
  entryTickIndex: number;
  tickDuration: number;
}

export interface ResolvedTrade {
  tradeId: string;
  direction: TradeDirection;
  stake: number;
  entryPrice: number;
  exitPrice: number;
  status: "won" | "lost";
  grossPayout: number;
  netPnl: number;
  resolvedAt: number; // timestamp for ordering
}

export interface PlayerBalance {
  playerId: string;
  username: string;
  isBot: boolean;
  botStrategy: string | null;
  avatarId: number | null;
  hiredBy: string | null;
  balance: number;
  initialBalance: number;
  tradeCount: number;
  pnl: number;
  isCurrentPlayer: boolean;
}

interface UseGameEngineParams {
  lobbyId: string;
  symbol: string;
  currentPlayer: Player;
  allPlayers: (LobbyPlayer & { player: Player })[];
  buyIn: number;
}

interface UseGameEngineReturn {
  currentTick: DerivTick | null;
  previousTick: DerivTick | null;
  isConnected: boolean;
  tickCount: number;

  timeRemainingMs: number;
  isGameOver: boolean;

  humanBalance: number;
  humanTradeCount: number;
  pendingTrades: PendingHumanTrade[];
  tradeHistory: ResolvedTrade[];
  placeHumanTrade: (
    direction: TradeDirection,
    stake: number,
    tickDuration: number
  ) => Promise<void>;
  canTrade: boolean;

  playerBalances: PlayerBalance[];
  gamePhase: GamePhase;
  payoutSummary: PayoutSummary | null;

  pausedBots: Set<string>;
  toggleBotPause: (botId: string) => void;
}

export function useGameEngine(params: UseGameEngineParams): UseGameEngineReturn {
  const { lobbyId, symbol, currentPlayer, allPlayers, buyIn } = params;

  // Deriv tick stream (symbol is set by the /play page at lobby phase)
  const { currentTick, previousTick, isConnected, tickCount } = useDerivTicker({
    symbol,
  });

  // Game phase
  const [gamePhase, setGamePhase] = useState<GamePhase>("starting");

  // Timer
  const startTimeRef = useRef<number>(Date.now());
  const [timeRemainingMs, setTimeRemainingMs] = useState(GAME_DURATION_MS);
  const isGameOver = gamePhase === "ending" || gamePhase === "finished";

  // Human trading state
  const [humanBalance, setHumanBalance] = useState(buyIn);
  const [humanTradeCount, setHumanTradeCount] = useState(0);
  const [pendingTrades, setPendingTrades] = useState<PendingHumanTrade[]>([]);
  const [tradeHistory, setTradeHistory] = useState<ResolvedTrade[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null);

  // Bot engine
  const botEngineRef = useRef<BotEngine | null>(null);
  const [botBalances, setBotBalances] = useState<
    Map<string, { balance: number; tradeCount: number }>
  >(new Map());
  const [pausedBots, setPausedBots] = useState<Set<string>>(new Set());

  // Other human players' balances tracked via Supabase Realtime
  const [otherHumanBalances, setOtherHumanBalances] = useState<
    Map<string, { balance: number; tradeCount: number }>
  >(() => {
    const initial = new Map<string, { balance: number; tradeCount: number }>();
    for (const lp of allPlayers) {
      if (lp.player.id !== currentPlayer.id && !lp.player.is_bot) {
        initial.set(lp.player.id, { balance: buyIn, tradeCount: 0 });
      }
    }
    return initial;
  });

  // Tick index for trade resolution
  const tickIndexRef = useRef(0);

  // Prevent double-click trade placement (debounce guard)
  const lastTradeTimeRef = useRef(0);

  // Prevent double trade resolution
  const resolvedTradeIdsRef = useRef(new Set<string>());

  // Prevent double game-end
  const gameEndedRef = useRef(false);

  // ---- Initialize bot engine on mount ----
  useEffect(() => {
    const engine = new BotEngine(lobbyId);
    for (const lp of allPlayers) {
      if (lp.player.is_bot) {
        engine.addBot(lp.player);
      }
    }
    botEngineRef.current = engine;
    console.log(
      `[GameEngine] Initialized with ${engine.botCount} bots for lobby ${lobbyId}`
    );
  }, [lobbyId, allPlayers]);

  // ---- Single source of truth: recompute all other humans' balances from DB ----
  // Uses one batched query instead of N separate queries.
  // Called on initial subscription, on every relevant Realtime event, and by the polling reconciler.
  const syncOtherHumanBalances = useCallback(async () => {
    const otherHumanIds = allPlayers
      .filter((lp) => lp.player.id !== currentPlayer.id && !lp.player.is_bot)
      .map((lp) => lp.player.id);

    if (otherHumanIds.length === 0) return;

    try {
      const { data: trades, error } = await supabase
        .from("trades")
        .select("player_id, stake, direction, status")
        .eq("lobby_id", lobbyId)
        .in("player_id", otherHumanIds);

      if (error) {
        console.error("[GameEngine] syncOtherHumanBalances query error:", error.message);
        return;
      }
      if (!trades) return;

      // Recompute balance for each player from their full trade history
      const computed = new Map<string, { balance: number; tradeCount: number }>();
      for (const id of otherHumanIds) {
        computed.set(id, { balance: buyIn, tradeCount: 0 });
      }

      for (const t of trades) {
        const entry = computed.get(t.player_id);
        if (!entry) continue;
        entry.balance -= t.stake;
        entry.tradeCount++;
        if (t.status === "won") {
          entry.balance += Math.round(
            t.stake * getPayoutMultiplier(t.direction as TradeDirection) * 100
          ) / 100;
        }
      }

      setOtherHumanBalances((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, data] of computed) {
          const old = prev.get(id);
          // Compare in cents to avoid floating-point false positives
          const balanceDrifted = !old || Math.round(old.balance * 100) !== Math.round(data.balance * 100);
          const countDrifted = !old || old.tradeCount !== data.tradeCount;
          if (balanceDrifted || countDrifted) {
            next.set(id, { balance: Math.round(data.balance * 100) / 100, tradeCount: data.tradeCount });
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } catch (err) {
      console.error("[GameEngine] syncOtherHumanBalances error:", err);
    }
  }, [allPlayers, currentPlayer.id, lobbyId, buyIn]);

  // ---- Supabase Realtime WebSocket — live trade updates ----
  // On any trade INSERT or UPDATE for this lobby, trigger a full recompute
  // instead of tracking incrementally (incremental state drifts on missed events).
  useEffect(() => {
    const otherHumanIds = allPlayers
      .filter((lp) => lp.player.id !== currentPlayer.id && !lp.player.is_bot)
      .map((lp) => lp.player.id);

    if (otherHumanIds.length === 0) return;

    console.log(
      `[GameEngine] Opening Realtime WebSocket for ${otherHumanIds.length} teammate(s) in lobby ${lobbyId}`
    );

    const channel = supabase
      .channel(`game-trades-${lobbyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trades",
          filter: `lobby_id=eq.${lobbyId}`,
        },
        (payload) => {
          const row = payload.new as { player_id: string };
          // Ignore current player and bot trades — only sync for other humans
          if (!otherHumanIds.includes(row.player_id)) return;
          console.log(`[GameEngine] Realtime: trade event for teammate ${row.player_id} — syncing balances`);
          syncOtherHumanBalances();
        }
      )
      .subscribe((status) => {
        console.log(`[GameEngine] Realtime channel status: ${status}`);
        if (status === "SUBSCRIBED") {
          // Immediately sync on channel open to catch trades placed before we subscribed
          syncOtherHumanBalances();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`[GameEngine] Realtime channel ${status} — polling reconciler will catch up`);
        }
      });

    return () => {
      console.log("[GameEngine] Closing Realtime WebSocket channel");
      supabase.removeChannel(channel);
    };
  }, [lobbyId, allPlayers, currentPlayer.id, syncOtherHumanBalances]);

  // ---- Polling reconciler: re-sync every 3s as a safety net ----
  // Ensures eventual consistency if Realtime events are dropped.
  useEffect(() => {
    if (gamePhase === "finished") return;

    const interval = setInterval(() => {
      syncOtherHumanBalances();
    }, 3000);

    return () => clearInterval(interval);
  }, [gamePhase, syncOtherHumanBalances]);

  // ---- Transition to active once connected ----
  useEffect(() => {
    if (isConnected && gamePhase === "starting") {
      setGamePhase("active");
      startTimeRef.current = Date.now();
      console.log("[GameEngine] Game is ACTIVE — timer started");
    }
  }, [isConnected, gamePhase]);

  // ---- 5-minute countdown timer ----
  useEffect(() => {
    if (gamePhase !== "active") return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
      setTimeRemainingMs(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gamePhase]);

  // ---- End game when timer reaches 0 ----
  const handleGameEnd = useCallback(async () => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setGamePhase("ending");
    console.log("[GameEngine] Timer expired — ending game");

    const finalTick = currentTick;

    // 1. Force-resolve human pending trades
    if (finalTick) {
      const currentPending = pendingTrades;
      const resolved: ResolvedTrade[] = [];

      for (const trade of currentPending) {
        // Skip if already resolved by the tick effect
        if (resolvedTradeIdsRef.current.has(trade.tradeId)) continue;
        resolvedTradeIdsRef.current.add(trade.tradeId);

        try {
          const result = await resolveTradeInDb({
            tradeId: trade.tradeId,
            entryPrice: trade.entryPrice,
            exitPrice: finalTick.quote,
            direction: trade.direction,
            stake: trade.stake,
          });

          resolved.push({
            tradeId: trade.tradeId,
            direction: trade.direction,
            stake: trade.stake,
            entryPrice: trade.entryPrice,
            exitPrice: finalTick.quote,
            status: result.status as "won" | "lost",
            grossPayout: result.grossPayout,
            netPnl: result.netPnl,
            resolvedAt: Date.now(),
          });

          setHumanBalance((b) => b + result.grossPayout);
        } catch (err) {
          console.error("[GameEngine] Failed to resolve trade on end:", err);
        }
      }

      setPendingTrades([]);
      setTradeHistory((prev) => [...resolved, ...prev]);

      // 2. Force-resolve bot trades
      if (botEngineRef.current) {
        await botEngineRef.current.resolveAllTrades(finalTick);
      }
    }

    // 3. Detect forfeited players: they wrote final_balance=0 to lobby_players via handleConfirmExit.
    // A null final_balance means the game is still in progress (not forfeited).
    // Explicitly 0 means the player exited early and their balance goes to the Safety Net.
    const forfeitedPlayerIds = new Set<string>();
    try {
      const { data: lobbyState } = await supabase
        .from("lobby_players")
        .select("player_id, final_balance")
        .eq("lobby_id", lobbyId);

      if (lobbyState) {
        for (const row of lobbyState) {
          if (row.final_balance === 0) {
            forfeitedPlayerIds.add(row.player_id);
            console.log(`[GameEngine] Detected forfeited player: ${row.player_id}`);
          }
        }
      }
    } catch (err) {
      console.error("[GameEngine] Failed to detect forfeited players:", err);
    }

    // 4. Run payout engine on raw balances
    const payoutInputs: PayoutInput[] = allPlayers.map((lp) => {
      let rawBalance: number;
      let tradeCount: number;

      if (lp.player.id === currentPlayer.id) {
        rawBalance = humanBalance;
        tradeCount = humanTradeCount;
      } else if (lp.player.is_bot && botEngineRef.current) {
        rawBalance = botEngineRef.current.getBotBalance(lp.player.id);
        tradeCount = botEngineRef.current.getBotTradeCount(lp.player.id);
      } else {
        // Other humans — use Realtime-tracked balances
        const otherData = otherHumanBalances.get(lp.player.id);
        rawBalance = otherData?.balance ?? buyIn;
        tradeCount = otherData?.tradeCount ?? 0;
      }

      return {
        playerId: lp.player.id,
        username: lp.player.username,
        rawBalance,
        tradeCount,
        isBot: lp.player.is_bot,
        hiredBy: lp.hired_by,
        avatarId: lp.player.avatar_id,
        hasForfeited: forfeitedPlayerIds.has(lp.player.id),
      };
    });

    const payout = calculatePayouts(payoutInputs, buyIn);
    setPayoutSummary(payout);

    console.log("[GameEngine] Payout calculated:", {
      safetyNet: payout.safetyNetTotal,
      bailout: payout.bailoutDistributed,
      spillover: payout.spilloverDistributed,
      forfeited: payout.forfeitedTotal,
    });

    // 5. Write payout-adjusted final balances to DB
    for (const p of payout.players) {
      await updatePlayerFinalBalance(lobbyId, p.playerId, p.finalBalance);
    }

    // 6. End the game in DB
    try {
      await endGame(lobbyId);
    } catch (err) {
      console.error("[GameEngine] Failed to end game in DB:", err);
    }

    // 7. Credit final payout back to human player's global balance
    const humanPayout = payout.players.find(
      (p) => p.playerId === currentPlayer.id
    );
    if (humanPayout) {
      try {
        await creditPlayerBalance(currentPlayer.id, humanPayout.finalBalance);
        console.log(
          `[GameEngine] Credited $${humanPayout.finalBalance.toFixed(2)} back to ${currentPlayer.username}`
        );
      } catch (err) {
        console.error("[GameEngine] Failed to credit player balance:", err);
      }
    }

    setGamePhase("finished");
    console.log("[GameEngine] Game FINISHED");
  }, [currentTick, lobbyId, allPlayers, currentPlayer.id, buyIn, humanBalance, humanTradeCount, otherHumanBalances]);

  useEffect(() => {
    if (timeRemainingMs <= 0 && gamePhase === "active") {
      handleGameEnd();
    }
  }, [timeRemainingMs, gamePhase, handleGameEnd]);

  // ---- Process ticks: feed bots + resolve human trades ----
  useEffect(() => {
    if (!currentTick || gamePhase !== "active") return;

    tickIndexRef.current++;
    const currentTickIdx = tickIndexRef.current;

    // Feed tick to bot engine
    const engine = botEngineRef.current;
    if (engine) {
      engine.processTick(currentTick).then(() => {
        // Update bot balances after processing
        const newBalances = new Map<
          string,
          { balance: number; tradeCount: number }
        >();
        for (const lp of allPlayers) {
          if (lp.player.is_bot) {
            newBalances.set(lp.player.id, {
              balance: engine.getBotBalance(lp.player.id),
              tradeCount: engine.getBotTradeCount(lp.player.id),
            });
          }
        }
        setBotBalances(newBalances);
      });
    }

    // Resolve matured human trades
    // Step 1: Pure state update — separate matured from remaining (no side effects)
    setPendingTrades((prev) => {
      const remaining: PendingHumanTrade[] = [];

      for (const trade of prev) {
        if (currentTickIdx - trade.entryTickIndex >= trade.tickDuration) {
          // Queue resolution outside updater via dedup-guarded ref
          if (!resolvedTradeIdsRef.current.has(trade.tradeId)) {
            resolvedTradeIdsRef.current.add(trade.tradeId);

            resolveTradeInDb({
              tradeId: trade.tradeId,
              entryPrice: trade.entryPrice,
              exitPrice: currentTick.quote,
              direction: trade.direction,
              stake: trade.stake,
            }).then((result) => {
              setHumanBalance((b) => b + result.grossPayout);

              setTradeHistory((h) => [
                {
                  tradeId: trade.tradeId,
                  direction: trade.direction,
                  stake: trade.stake,
                  entryPrice: trade.entryPrice,
                  exitPrice: currentTick.quote,
                  status: result.status as "won" | "lost",
                  grossPayout: result.grossPayout,
                  netPnl: result.netPnl,
                  resolvedAt: Date.now(),
                },
                ...h,
              ]);
            });
          }
        } else {
          remaining.push(trade);
        }
      }

      return remaining;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTick]);

  // ---- Place a human trade ----
  const placeHumanTrade = useCallback(
    async (direction: TradeDirection, stake: number, tickDuration: number) => {
      // Debounce: prevent accidental double-clicks (300ms cooldown)
      const now = Date.now();
      if (now - lastTradeTimeRef.current < 300) return;
      if (!currentTick || isGameOver || stake <= 0 || stake > humanBalance) {
        return;
      }

      lastTradeTimeRef.current = now;

      // Optimistic: deduct stake
      setHumanBalance((b) => b - stake);
      setHumanTradeCount((c) => c + 1);

      try {
        const result = await placeTradeToDb({
          playerId: currentPlayer.id,
          lobbyId,
          direction,
          stake,
          entryPrice: currentTick.quote,
        });

        setPendingTrades((prev) => [
          ...prev,
          {
            tradeId: result.tradeId,
            direction,
            stake,
            entryPrice: currentTick.quote,
            entryTickIndex: tickIndexRef.current,
            tickDuration,
          },
        ]);

        console.log(
          `[GameEngine] Human placed ${direction} $${stake.toFixed(2)} for ${tickDuration} ticks @ ${currentTick.quote}`
        );
      } catch (err) {
        // Refund on failure
        setHumanBalance((b) => b + stake);
        setHumanTradeCount((c) => c - 1);
        console.error("[GameEngine] Failed to place human trade:", err);
      }
    },
    [currentTick, isGameOver, humanBalance, currentPlayer.id, lobbyId]
  );

  const toggleBotPause = useCallback((botId: string) => {
    const engine = botEngineRef.current;
    if (!engine) return;
    if (engine.isPaused(botId)) {
      engine.resumeBot(botId);
      setPausedBots((prev) => {
        const next = new Set(prev);
        next.delete(botId);
        return next;
      });
    } else {
      engine.pauseBot(botId);
      setPausedBots((prev) => new Set(prev).add(botId));
    }
  }, []);

  const canTrade =
    gamePhase === "active" && !!currentTick && isConnected && humanBalance > 0;

  // ---- Compute player balances (memoized to avoid re-render storms) ----
  const playerBalances: PlayerBalance[] = useMemo(() => {
    const balances = allPlayers.map((lp) => {
      const isMe = lp.player.id === currentPlayer.id;
      const isBot = lp.player.is_bot;

      let balance: number;
      let tradeCount: number;

      if (isMe) {
        balance = humanBalance;
        tradeCount = humanTradeCount;
      } else if (isBot) {
        const botData = botBalances.get(lp.player.id);
        balance = botData?.balance ?? buyIn;
        tradeCount = botData?.tradeCount ?? 0;
      } else {
        // Other humans — tracked via Supabase Realtime
        const otherData = otherHumanBalances.get(lp.player.id);
        balance = otherData?.balance ?? buyIn;
        tradeCount = otherData?.tradeCount ?? 0;
      }

      return {
        playerId: lp.player.id,
        username: lp.player.username,
        isBot,
        botStrategy: lp.player.bot_strategy,
        avatarId: lp.player.avatar_id,
        hiredBy: lp.hired_by,
        balance,
        initialBalance: buyIn,
        tradeCount,
        pnl: Math.round((balance - buyIn) * 100) / 100,
        isCurrentPlayer: isMe,
      };
    });

    // Sort by balance descending
    balances.sort((a, b) => b.balance - a.balance);
    return balances;
  }, [allPlayers, currentPlayer.id, humanBalance, humanTradeCount, botBalances, otherHumanBalances, buyIn]);

  return {
    currentTick,
    previousTick,
    isConnected,
    tickCount,
    timeRemainingMs,
    isGameOver,
    humanBalance,
    humanTradeCount,
    pendingTrades,
    tradeHistory,
    placeHumanTrade,
    canTrade,
    playerBalances,
    gamePhase,
    payoutSummary,
    pausedBots,
    toggleBotPause,
  };
}
