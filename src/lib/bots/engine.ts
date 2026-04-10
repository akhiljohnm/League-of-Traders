import type { DerivTick } from "@/lib/types/deriv";
import type { BotStrategy, Player } from "@/lib/types/database";
import type { BotStrategyInstance, TradeDecision } from "./types";
import { TRADE_DURATION_TICKS } from "./types";
import { createStrategy } from "./index";
import { placeTrade, resolveTrade } from "@/lib/game/rise-fall";

// ============================================================
// Bot Engine — Drives all bots in a lobby during the game loop
// ============================================================

interface PendingTrade {
  tradeId: string;
  botId: string;
  direction: "UP" | "DOWN";
  stake: number;
  entryPrice: number;
  entryTick: number; // tick index when trade was placed
}

interface ManagedBot {
  player: Player;
  strategy: BotStrategyInstance;
  balance: number;
  tradeCount: number;
}

export class BotEngine {
  private bots: Map<string, ManagedBot> = new Map();
  private pendingTrades: PendingTrade[] = [];
  private tickIndex = 0;
  private lobbyId: string;

  constructor(lobbyId: string) {
    this.lobbyId = lobbyId;
    console.log(`[BotEngine] Initialized for lobby ${lobbyId}`);
  }

  /**
   * Register a bot player with the engine.
   */
  addBot(player: Player): void {
    if (!player.is_bot || !player.bot_strategy) {
      console.warn(`[BotEngine] Player ${player.id} is not a bot — skipping`);
      return;
    }

    const strategy = createStrategy(player.bot_strategy as BotStrategy);
    this.bots.set(player.id, {
      player,
      strategy,
      balance: player.game_token_balance,
      tradeCount: 0,
    });

    console.log(
      `[BotEngine] Added bot: ${player.username} (${player.bot_strategy}) with $${player.game_token_balance} balance`
    );
  }

  /**
   * Process a new tick from the Deriv Oracle.
   * Feeds the tick to all bot strategies, executes any trade decisions,
   * and resolves any pending trades that have reached their duration.
   */
  async processTick(tick: DerivTick): Promise<void> {
    this.tickIndex++;

    // 1. Resolve any trades that have matured
    await this.resolveMaturedTrades(tick);

    // 2. Feed tick to each bot's strategy and collect decisions
    const decisions: { botId: string; decision: TradeDecision }[] = [];

    for (const [botId, bot] of this.bots) {
      const decision = bot.strategy.onTick(tick, bot.balance, this.getInitialBalance(botId));
      if (decision) {
        decisions.push({ botId, decision });
      }
    }

    // 3. Execute all trade decisions
    for (const { botId, decision } of decisions) {
      await this.executeTrade(botId, decision, tick.quote);
    }
  }

  /**
   * Place a Rise/Fall trade via the shared game module and deduct stake from bot balance.
   */
  private async executeTrade(
    botId: string,
    decision: TradeDecision,
    entryPrice: number
  ): Promise<void> {
    const bot = this.bots.get(botId);
    if (!bot) return;

    // Don't stake more than the bot has
    const actualStake = Math.min(decision.stake, bot.balance);
    if (actualStake <= 0) return;

    // Deduct stake from running balance
    bot.balance -= actualStake;
    bot.tradeCount++;

    try {
      const result = await placeTrade({
        playerId: botId,
        lobbyId: this.lobbyId,
        direction: decision.direction,
        stake: actualStake,
        entryPrice,
      });

      // Track pending trade for resolution
      this.pendingTrades.push({
        tradeId: result.tradeId,
        botId,
        direction: decision.direction,
        stake: actualStake,
        entryPrice,
        entryTick: this.tickIndex,
      });

      console.log(
        `[BotEngine] ${bot.player.username} placed ${decision.direction} trade #${bot.tradeCount}: $${actualStake.toFixed(2)} @ ${entryPrice.toFixed(2)} (balance: $${bot.balance.toFixed(2)})`
      );
    } catch (err) {
      console.error(`[BotEngine] Failed to place trade for ${bot.player.username}:`, err);
      // Refund the stake on failure
      bot.balance += actualStake;
      bot.tradeCount--;
    }
  }

  /**
   * Resolve trades that have been open for TRADE_DURATION_TICKS.
   * Uses the shared Rise/Fall module for win/loss determination and payout math.
   */
  private async resolveMaturedTrades(currentTick: DerivTick): Promise<void> {
    const exitPrice = currentTick.quote;
    const matured: PendingTrade[] = [];
    const remaining: PendingTrade[] = [];

    for (const trade of this.pendingTrades) {
      if (this.tickIndex - trade.entryTick >= TRADE_DURATION_TICKS) {
        matured.push(trade);
      } else {
        remaining.push(trade);
      }
    }

    this.pendingTrades = remaining;

    for (const trade of matured) {
      const bot = this.bots.get(trade.botId);
      if (!bot) continue;

      const result = await resolveTrade({
        tradeId: trade.tradeId,
        entryPrice: trade.entryPrice,
        exitPrice,
        direction: trade.direction,
        stake: trade.stake,
      });

      // Credit gross payout to bot balance (stake was already deducted on placement)
      bot.balance += result.grossPayout;

      console.log(
        `[BotEngine] ${bot.player.username} trade ${result.status.toUpperCase()}: ${trade.direction} $${trade.stake.toFixed(2)} → ${result.status === "won" ? `+$${result.grossPayout.toFixed(2)}` : `-$${trade.stake.toFixed(2)}`} (exit: ${exitPrice.toFixed(2)}, balance: $${bot.balance.toFixed(2)})`
      );
    }
  }

  /**
   * Force-resolve all remaining pending trades (called at game end).
   */
  async resolveAllTrades(finalTick: DerivTick): Promise<void> {
    console.log(
      `[BotEngine] Force-resolving ${this.pendingTrades.length} remaining trades`
    );

    // Temporarily set tickIndex far ahead to mature all trades
    const savedIndex = this.tickIndex;
    this.tickIndex = savedIndex + TRADE_DURATION_TICKS + 1;
    await this.resolveMaturedTrades(finalTick);
    this.tickIndex = savedIndex;
  }

  /**
   * Get the current balance for a bot.
   */
  getBotBalance(botId: string): number {
    return this.bots.get(botId)?.balance ?? 0;
  }

  /**
   * Get trade count for a bot (for active quota check).
   */
  getBotTradeCount(botId: string): number {
    return this.bots.get(botId)?.tradeCount ?? 0;
  }

  /**
   * Get a summary of all bots for the post-game scoreboard.
   */
  getSummary(): {
    botId: string;
    username: string;
    strategy: string;
    balance: number;
    tradeCount: number;
    pnl: number;
  }[] {
    return Array.from(this.bots.entries()).map(([botId, bot]) => ({
      botId,
      username: bot.player.username,
      strategy: bot.player.bot_strategy ?? "unknown",
      balance: bot.balance,
      tradeCount: bot.tradeCount,
      pnl: bot.balance - bot.player.game_token_balance,
    }));
  }

  /**
   * Reset all bots for a new round.
   */
  reset(): void {
    for (const bot of this.bots.values()) {
      bot.strategy.reset();
      bot.balance = bot.player.game_token_balance;
      bot.tradeCount = 0;
    }
    this.pendingTrades = [];
    this.tickIndex = 0;
    console.log("[BotEngine] Reset all bots");
  }

  /** Number of registered bots */
  get botCount(): number {
    return this.bots.size;
  }

  private getInitialBalance(botId: string): number {
    return this.bots.get(botId)?.player.game_token_balance ?? 0;
  }
}
