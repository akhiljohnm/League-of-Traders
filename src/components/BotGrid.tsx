"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { purchaseBotSubscription } from "@/lib/actions/subscription";
import type { BotStrategy } from "@/lib/types/database";
import BotSubscribeDialog, { BOT_CATALOG, type BotInfo } from "./BotSubscribeDialog";

export default function BotGrid() {
  const [unlockedStrategies, setUnlockedStrategies] = useState<Set<BotStrategy>>(new Set());
  const [dialogBot, setDialogBot] = useState<BotInfo | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const loadSubscriptions = () => {
    const playerId = localStorage.getItem("lot_player_id");
    if (!playerId) return;

    supabase
      .from("bot_subscriptions")
      .select("bot_strategy, is_active, expires_at")
      .eq("player_id", playerId)
      .then(({ data }) => {
        if (!data) return;
        const now = new Date();
        const active = new Set<BotStrategy>();
        for (const sub of data) {
          if (sub.is_active && new Date(sub.expires_at) >= now) {
            active.add(sub.bot_strategy as BotStrategy);
          }
        }
        setUnlockedStrategies(active);
      });
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const handleBotClick = (bot: BotInfo) => {
    if (unlockedStrategies.has(bot.strategy)) return;
    setPurchaseError(null);
    setDialogBot(bot);
  };

  const handlePurchase = async () => {
    if (!dialogBot) return;
    const playerId = localStorage.getItem("lot_player_id");
    if (!playerId) {
      setPurchaseError("You need to join a game first before subscribing to bots.");
      return;
    }

    setIsPurchasing(true);
    setPurchaseError(null);
    try {
      await purchaseBotSubscription(playerId, dialogBot.strategy);
      console.log(`[BotGrid] Subscribed to ${dialogBot.strategy}`);
      loadSubscriptions();
      setDialogBot(null);
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Failed to purchase subscription");
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {BOT_CATALOG.map((bot) => (
          <BotCard
            key={bot.strategy}
            bot={bot}
            unlocked={unlockedStrategies.has(bot.strategy)}
            onClick={() => handleBotClick(bot)}
          />
        ))}
      </div>

      {dialogBot && (
        <BotSubscribeDialog
          bot={dialogBot}
          onConfirm={handlePurchase}
          onCancel={() => { setDialogBot(null); setPurchaseError(null); }}
          isPurchasing={isPurchasing}
          error={purchaseError}
        />
      )}
    </>
  );
}

function BotCard({
  bot,
  unlocked,
  onClick,
}: {
  bot: BotInfo;
  unlocked: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={!unlocked ? onClick : undefined}
      className={`relative bg-bg-surface border border-border-default rounded-xl p-6 card-hover flex flex-col overflow-hidden ${
        !unlocked ? "cursor-pointer" : ""
      }`}
    >
      {/* Lock / Unlock badge */}
      <div
        className={`absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 z-10 ${
          unlocked
            ? "bg-alpha-green/10 border border-alpha-green/30"
            : "bg-bg-primary/90 border border-border-hover"
        }`}
      >
        {unlocked ? (
          <>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-alpha-green"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 0 10 0" />
            </svg>
            <span className="font-mono-numbers text-[10px] text-alpha-green font-bold">
              UNLOCKED
            </span>
          </>
        ) : (
          <>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-text-muted"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="font-mono-numbers text-[10px] text-text-muted font-bold">
              LOCKED
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-text-primary font-semibold">{bot.name}</h3>
        <span
          className={`${bot.tagColor} text-[10px] font-mono-numbers font-bold uppercase tracking-wider px-2 py-0.5 rounded-full`}
        >
          {bot.tag}
        </span>
      </div>
      <p className="text-text-secondary text-sm leading-relaxed mb-4 flex-1">
        {bot.description}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {bot.traits.map((trait) => (
          <span
            key={trait}
            className="text-[11px] text-text-muted bg-bg-elevated px-2 py-1 rounded"
          >
            {trait}
          </span>
        ))}
      </div>

      {/* Subscribe CTA / Active indicator */}
      <div className="border-t border-border-default pt-4 mt-auto">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono-numbers text-xl font-bold text-text-primary">
              $200
            </span>
            <span className="text-text-muted text-xs">/month</span>
          </div>
          {unlocked ? (
            <span className="px-4 py-2 bg-alpha-green/10 border border-alpha-green/30 text-alpha-green text-xs font-bold rounded-lg uppercase tracking-wider">
              Active
            </span>
          ) : (
            <span className="px-4 py-2 bg-safety-cyan/10 border border-safety-cyan/30 text-safety-cyan text-xs font-bold rounded-lg uppercase tracking-wider">
              Subscribe to Unlock
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
