"use client";

import { useState } from "react";
import type { BotStrategy } from "@/lib/types/database";
import { BOT_SUBSCRIPTION_COST } from "@/lib/types/database";

export interface BotInfo {
  strategy: BotStrategy;
  name: string;
  tag: string;
  tagColor: string;
  description: string;
  traits: string[];
  upsell: string;
}

export const BOT_CATALOG: BotInfo[] = [
  {
    strategy: "trend_follower",
    name: "The Trend Follower",
    tag: "LOW RISK",
    tagColor: "bg-alpha-green/10 text-alpha-green",
    description:
      "Patient and selective. Only trades when the AI brain detects strong directional signals — riding confirmed momentum with calculated entries.",
    traits: [
      "High confidence threshold",
      "6% conservative stakes",
      "8-tick cooldown",
      "AI signal: composite >= 0.4",
    ],
    upsell:
      "The safest pick for your squad. This bot waits for high-conviction momentum signals before entering — fewer trades, but each one counts. Ideal for players who want a reliable AI teammate that won't blow up the Safety Net.",
  },
  {
    strategy: "mean_reverter",
    name: "The Mean Reverter",
    tag: "MEDIUM RISK",
    tagColor: "bg-safety-cyan/10 text-safety-cyan",
    description:
      "Contrarian by design. Waits for the AI brain to detect overbought or oversold conditions, then bets on the snap back to the mean.",
    traits: [
      "Bollinger Band trigger",
      "10% medium stakes",
      "6-tick cooldown",
      "AI signal: reversion only",
    ],
    upsell:
      "The smart contrarian. When the market overextends, this bot fades the move and profits from the snap-back. Medium stakes and a balanced cooldown make it the perfect all-rounder for teams that want consistent, uncorrelated returns.",
  },
  {
    strategy: "high_freq_gambler",
    name: "The High-Freq Gambler",
    tag: "HIGH RISK",
    tagColor: "bg-rekt-crimson/10 text-rekt-crimson",
    description:
      "Rapid-fire trades on any signal the AI brain produces — even weak ones. Maximum volume, maximum variance. Could carry the team or need rescuing.",
    traits: [
      "Trades on any signal",
      "4% micro stakes",
      "Every 4 ticks",
      "AI signal: composite >= 0.05",
    ],
    upsell:
      "High risk, high reward. This bot fires on every signal — weak or strong — racking up trades at maximum speed. It'll either carry your team to the top of the leaderboard or need the full Safety Net bailout. Fortune favours the bold.",
  },
];

interface BotSubscribeDialogProps {
  bot: BotInfo;
  onConfirm: () => void;
  onCancel: () => void;
  isPurchasing: boolean;
  error?: string | null;
}

export default function BotSubscribeDialog({
  bot,
  onConfirm,
  onCancel,
  isPurchasing,
  error,
}: BotSubscribeDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-bg-surface border border-border-default rounded-2xl w-full max-w-md overflow-hidden animate-fade-up">
        {/* Header accent bar */}
        <div
          className={`h-1 w-full ${
            bot.strategy === "trend_follower"
              ? "bg-alpha-green"
              : bot.strategy === "mean_reverter"
              ? "bg-safety-cyan"
              : "bg-rekt-crimson"
          }`}
        />

        <div className="p-6">
          {/* Bot identity */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                bot.strategy === "trend_follower"
                  ? "bg-alpha-green/10 border border-alpha-green/30"
                  : bot.strategy === "mean_reverter"
                  ? "bg-safety-cyan/10 border border-safety-cyan/30"
                  : "bg-rekt-crimson/10 border border-rekt-crimson/30"
              }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={
                  bot.strategy === "trend_follower"
                    ? "text-alpha-green"
                    : bot.strategy === "mean_reverter"
                    ? "text-safety-cyan"
                    : "text-rekt-crimson"
                }
              >
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="3" />
                <line x1="12" y1="8" x2="12" y2="11" />
                <circle cx="8" cy="16" r="1.5" fill="currentColor" />
                <circle cx="16" cy="16" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h3 className="text-text-primary font-bold text-lg">{bot.name}</h3>
              <span
                className={`${bot.tagColor} text-[10px] font-mono-numbers font-bold uppercase tracking-wider px-2 py-0.5 rounded-full`}
              >
                {bot.tag}
              </span>
            </div>
          </div>

          {/* Upsell pitch */}
          <p className="text-text-secondary text-sm leading-relaxed mb-5">
            {bot.upsell}
          </p>

          {/* Traits */}
          <div className="flex flex-wrap gap-2 mb-5">
            {bot.traits.map((trait) => (
              <span
                key={trait}
                className="text-[11px] text-text-muted bg-bg-elevated px-2 py-1 rounded"
              >
                {trait}
              </span>
            ))}
          </div>

          {/* Pricing box */}
          <div className="bg-bg-primary border border-border-default rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-text-muted text-xs block mb-1">
                  Monthly subscription
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono-numbers text-2xl font-bold text-text-primary">
                    ${BOT_SUBSCRIPTION_COST}
                  </span>
                  <span className="text-text-muted text-xs">/month</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-text-muted text-xs block mb-1">
                  Renews from
                </span>
                <span className="text-text-secondary text-sm font-medium">
                  Game Balance
                </span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-rekt-crimson/10 border border-rekt-crimson/30 rounded-lg px-4 py-3 mb-4">
              <p className="text-rekt-crimson text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isPurchasing}
              className="flex-1 py-3 bg-bg-elevated border border-border-hover rounded-xl text-text-secondary
                         text-sm font-semibold hover:text-text-primary hover:border-text-muted
                         disabled:opacity-40 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isPurchasing}
              className="flex-1 py-3 bg-safety-cyan text-bg-primary rounded-xl text-sm font-bold
                         hover:brightness-110 active:scale-[0.98] disabled:opacity-40
                         disabled:cursor-not-allowed transition-all cursor-pointer"
              style={{
                boxShadow:
                  "0 0 16px rgba(0, 229, 255, 0.25), 0 0 48px rgba(0, 229, 255, 0.08)",
              }}
            >
              {isPurchasing ? "Purchasing..." : `Purchase for $${BOT_SUBSCRIPTION_COST}`}
            </button>
          </div>

          <p className="text-text-muted text-[11px] text-center mt-3">
            Auto-renews monthly. Locks if balance drops below ${BOT_SUBSCRIPTION_COST}.
          </p>
        </div>
      </div>
    </div>
  );
}
