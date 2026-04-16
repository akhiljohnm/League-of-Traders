import type { BotStrategy } from "@/lib/types/database";

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
