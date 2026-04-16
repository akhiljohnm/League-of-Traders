// ============================================================
// 80/20 Payout Engine — Pure calculation, no side effects
// Implements the Profit Contribution Model from game-logic.md
// ============================================================

import { MIN_TRADES_QUOTA, ALPHA_TAX_RATE } from "@/lib/bots/types";

// ---- Types ----

export interface PayoutInput {
  playerId: string;
  username: string;
  rawBalance: number;
  tradeCount: number;
  isBot: boolean;
  hiredBy: string | null;
  avatarId: number | null;
  /** Player explicitly exited mid-game — their balance goes to the Safety Net. */
  hasForfeited: boolean;
}

export type PayoutRole = "alpha" | "rescue" | "even" | "inactive" | "forfeited";

export interface PayoutResult {
  playerId: string;
  username: string;
  isBot: boolean;
  avatarId: number | null;
  tradeCount: number;
  rawBalance: number;
  role: PayoutRole;
  /** 20% profit tax taken from Alphas */
  alphaTax: number;
  /** Post-tax balance (before bailout/spillover) */
  afterTaxBalance: number;
  /** Bailout received from Safety Net */
  bailoutReceived: number;
  /** Spillover returned from excess Safety Net */
  spilloverReceived: number;
  /** Bot profit routing: positive = profit sent to owner (bot) or received from bots (human) */
  botProfitRouted: number;
  /** Final balance after all adjustments */
  finalBalance: number;
  hiredBy: string | null;
}

export interface PayoutSummary {
  players: PayoutResult[];
  safetyNetTotal: number;
  bailoutDistributed: number;
  spilloverDistributed: number;
  inactiveForfeited: number; // always 0 — inactive players keep their balance
  forfeitedTotal: number;    // sum of balances forfeited to safety net by early-exit players
}

// ---- Main calculation ----

export function calculatePayouts(
  inputs: PayoutInput[],
  buyIn: number
): PayoutSummary {
  let safetyNet = 0;
  let forfeitedTotal = 0;

  // Step 1: Initialize results and classify each player
  const results: PayoutResult[] = inputs.map((p) => {
    // Forfeited players: exited mid-game — their entire balance goes to the Safety Net
    if (p.hasForfeited) {
      safetyNet += p.rawBalance;
      forfeitedTotal += p.rawBalance;

      return {
        playerId: p.playerId,
        username: p.username,
        isBot: p.isBot,
        avatarId: p.avatarId,
        tradeCount: p.tradeCount,
        rawBalance: p.rawBalance,
        role: "forfeited" as PayoutRole,
        alphaTax: 0,
        afterTaxBalance: 0,
        bailoutReceived: 0,
        spilloverReceived: 0,
        botProfitRouted: 0,
        finalBalance: 0,
        hiredBy: p.hiredBy,
      };
    }

    // Inactive players: did not meet minimum trade quota.
    // They keep their balance but are ineligible for bailouts or spillover.
    // Their balance is NOT forfeited to the Safety Net.
    const isInactive = p.tradeCount < MIN_TRADES_QUOTA;

    if (isInactive) {
      return {
        playerId: p.playerId,
        username: p.username,
        isBot: p.isBot,
        avatarId: p.avatarId,
        tradeCount: p.tradeCount,
        rawBalance: p.rawBalance,
        role: "inactive" as PayoutRole,
        alphaTax: 0,
        afterTaxBalance: p.rawBalance,
        bailoutReceived: 0,
        spilloverReceived: 0,
        botProfitRouted: 0,
        finalBalance: p.rawBalance,
        hiredBy: p.hiredBy,
      };
    }

    // Classify active players
    let role: PayoutRole;
    if (p.rawBalance > buyIn) {
      role = "alpha";
    } else if (p.rawBalance < buyIn) {
      role = "rescue";
    } else {
      role = "even";
    }

    return {
      playerId: p.playerId,
      username: p.username,
      isBot: p.isBot,
      avatarId: p.avatarId,
      tradeCount: p.tradeCount,
      rawBalance: p.rawBalance,
      role,
      alphaTax: 0,
      afterTaxBalance: p.rawBalance,
      bailoutReceived: 0,
      spilloverReceived: 0,
      botProfitRouted: 0,
      finalBalance: p.rawBalance,
      hiredBy: p.hiredBy,
    };
  });

  // Step 2: Alpha Tax — 20% of profit goes to Safety Net
  for (const r of results) {
    if (r.role === "alpha") {
      const profit = r.rawBalance - buyIn;
      const tax = round2(profit * ALPHA_TAX_RATE);
      r.alphaTax = tax;
      r.afterTaxBalance = round2(buyIn + profit - tax); // buyIn + 80% of profit
      r.finalBalance = r.afterTaxBalance;
      safetyNet += tax;
    }
  }

  // Step 3: Bailout — distribute Safety Net to Rescues, capped at restoring to buyIn
  const rescues = results.filter((r) => r.role === "rescue");
  let bailoutDistributed = 0;

  if (rescues.length > 0 && safetyNet > 0) {
    // Sort-based bailout: split evenly, cap at deficit, redistribute excess naturally
    let pool = safetyNet;
    const deficits = rescues.map((r) => ({
      r,
      deficit: round2(buyIn - r.rawBalance),
    }));

    // Sort by smallest deficit first (so capping works naturally)
    deficits.sort((a, b) => a.deficit - b.deficit);

    let remainingRescues = deficits.length;
    for (const { r, deficit } of deficits) {
      const equalShare = round2(pool / remainingRescues);
      const bailout = Math.min(equalShare, deficit);
      r.bailoutReceived = bailout;
      r.finalBalance = round2(r.rawBalance + bailout);
      pool = round2(pool - bailout);
      bailoutDistributed = round2(bailoutDistributed + bailout);
      remainingRescues--;
    }

    safetyNet = round2(safetyNet - bailoutDistributed);
  }

  // Step 4: Victory Spillover — return excess Safety Net to Alphas equally
  // Spillover is always split equally regardless of profit size.
  // If all players are Alpha (no rescues), the entire Safety Net is also split equally.
  let spilloverDistributed = 0;
  const alphas = results.filter((r) => r.role === "alpha");

  if (safetyNet > 0.01 && alphas.length > 0) {
    for (let i = 0; i < alphas.length; i++) {
      // Give last alpha the remainder to absorb any floating-point rounding
      const share =
        i === alphas.length - 1
          ? round2(safetyNet - spilloverDistributed)
          : round2(safetyNet / alphas.length);
      alphas[i].spilloverReceived = share;
      alphas[i].finalBalance = round2(alphas[i].finalBalance + share);
      spilloverDistributed = round2(spilloverDistributed + share);
    }
  }

  // Step 5: Bot Full Balance Routing — entire bot balance (including buyIn and any
  // bailout/spillover received) is transferred to the player who hired the bot.
  // The bot ends at $0. This applies regardless of win/loss.
  const playerMap = new Map(results.map((r) => [r.playerId, r]));

  for (const r of results) {
    if (r.isBot && r.hiredBy) {
      const fullBalance = r.finalBalance;
      const owner = playerMap.get(r.hiredBy);
      if (owner && fullBalance > 0) {
        r.botProfitRouted = -fullBalance; // bot transfers its entire balance
        r.finalBalance = 0;              // bot ends at $0
        owner.botProfitRouted = round2(owner.botProfitRouted + fullBalance);
        owner.finalBalance = round2(owner.finalBalance + fullBalance);

        console.log(
          `[Payout] Bot ${r.username} routed full balance $${fullBalance.toFixed(2)} to ${owner.username}`
        );
      }
    }
  }

  return {
    players: results,
    safetyNetTotal: round2(forfeitedTotal + alphas.reduce((s, a) => s + a.alphaTax, 0)),
    bailoutDistributed,
    spilloverDistributed,
    inactiveForfeited: 0,    // inactive players keep their balance — no forfeiture
    forfeitedTotal: round2(forfeitedTotal),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
