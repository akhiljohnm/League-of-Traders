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
}

export function useGameEngine(params: UseGameEngineParams): UseGameEngineReturn {
  const { lobbyId, symbol, currentPlayer, allPlayers, buyIn } = params;

  // Deriv tick stream
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

  // ---- Subscribe to other players' trades via Supabase Realtime ----
  useEffect(() => {
    const otherHumanIds = allPlayers
      .filter((lp) => lp.player.id !== currentPlayer.id && !lp.player.is_bot)
      .map((lp) => lp.player.id);

    if (otherHumanIds.length === 0) return;

    console.log(
      `[GameEngine] Subscribing to trades Realtime for ${otherHumanIds.length} teammate(s) in lobby ${lobbyId}`
    );

    const channel = supabase
      .channel(`game-trades-${lobbyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trades",
          filter: `lobby_id=eq.${lobbyId}`,
        },
        (payload) => {
          const row = payload.new as {
            player_id: string;
            stake: number;
            direction: TradeDirection;
          };
          // Only track other humans (not current player, not bots)
          if (!otherHumanIds.includes(row.player_id)) return;

          console.log(
            `[GameEngine] Teammate ${row.player_id} placed ${row.direction} $${row.stake} trade`
          );

          setOtherHumanBalances((prev) => {
            const next = new Map(prev);
            const current = next.get(row.player_id) ?? {
              balance: buyIn,
              tradeCount: 0,
            };
            next.set(row.player_id, {
              balance: current.balance - row.stake,
              tradeCount: current.tradeCount + 1,
            });
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trades",
          filter: `lobby_id=eq.${lobbyId}`,
        },
        (payload) => {
          const row = payload.new as {
            player_id: string;
            stake: number;
            direction: TradeDirection;
            status: string;
            payout: number | null;
          };
          if (!otherHumanIds.includes(row.player_id)) return;
          if (row.status !== "won" && row.status !== "lost") return;

          // Calculate gross payout the same way rise-fall.ts does
          const grossPayout =
            row.status === "won"
              ? Math.round(row.stake * getPayoutMultiplier(row.direction) * 100) / 100
              : 0;

          console.log(
            `[GameEngine] Teammate ${row.player_id} trade ${row.status}: ${row.status === "won" ? `+$${grossPayout}` : `-$${row.stake}`}`
          );

          setOtherHumanBalances((prev) => {
            const next = new Map(prev);
            const current = next.get(row.player_id) ?? {
              balance: buyIn,
              tradeCount: 0,
            };
            next.set(row.player_id, {
              ...current,
              balance: current.balance + grossPayout,
            });
            return next;
          });
        }
      )
      .subscribe((status) => {
        console.log(`[GameEngine] Trades Realtime status: ${status}`);
      });

    return () => {
      console.log("[GameEngine] Unsubscribing from trades Realtime");
      supabase.removeChannel(channel);
    };
  }, [lobbyId, allPlayers, currentPlayer.id, buyIn]);

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

    // 3. Run payout engine on raw balances
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
      };
    });

    const payout = calculatePayouts(payoutInputs, buyIn);
    setPayoutSummary(payout);

    console.log("[GameEngine] Payout calculated:", {
      safetyNet: payout.safetyNetTotal,
      bailout: payout.bailoutDistributed,
      spillover: payout.spilloverDistributed,
      inactive: payout.inactiveForfeited,
    });

    // 4. Write payout-adjusted final balances to DB
    for (const p of payout.players) {
      await updatePlayerFinalBalance(lobbyId, p.playerId, p.finalBalance);
    }

    // 5. End the game in DB
    try {
      await endGame(lobbyId);
    } catch (err) {
      console.error("[GameEngine] Failed to end game in DB:", err);
    }

    // 6. Credit final payout back to human player's global balance
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
  };
}
