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
}

export type PayoutRole = "alpha" | "rescue" | "even" | "inactive";

export interface PayoutResult {
  playerId: string;
  username: string;
  isBot: boolean;
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
  inactiveForfeited: number;
}

// ---- Main calculation ----

export function calculatePayouts(
  inputs: PayoutInput[],
  buyIn: number
): PayoutSummary {
  let safetyNet = 0;
  let inactiveForfeited = 0;

  // Step 1: Initialize results and handle inactive players
  const results: PayoutResult[] = inputs.map((p) => {
    const isInactive = p.tradeCount < MIN_TRADES_QUOTA;

    if (isInactive) {
      // Forfeit balance to safety net
      inactiveForfeited += p.rawBalance;
      safetyNet += p.rawBalance;

      return {
        playerId: p.playerId,
        username: p.username,
        isBot: p.isBot,
        tradeCount: p.tradeCount,
        rawBalance: p.rawBalance,
        role: "inactive" as PayoutRole,
        alphaTax: 0,
        afterTaxBalance: 0,
        bailoutReceived: 0,
        spilloverReceived: 0,
        botProfitRouted: 0,
        finalBalance: 0,
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

  // Step 4: Victory Spillover — return excess Safety Net to Alphas proportionally
  let spilloverDistributed = 0;
  const alphas = results.filter((r) => r.role === "alpha");

  if (safetyNet > 0.01 && alphas.length > 0) {
    const totalAlphaProfit = alphas.reduce(
      (sum, a) => sum + (a.rawBalance - buyIn),
      0
    );

    if (totalAlphaProfit > 0) {
      for (const alpha of alphas) {
        const profit = alpha.rawBalance - buyIn;
        const share = round2((profit / totalAlphaProfit) * safetyNet);
        alpha.spilloverReceived = share;
        alpha.finalBalance = round2(alpha.finalBalance + share);
        spilloverDistributed = round2(spilloverDistributed + share);
      }
    } else {
      // Edge case: all alphas had 0 raw profit after tax, split evenly
      const share = round2(safetyNet / alphas.length);
      for (const alpha of alphas) {
        alpha.spilloverReceived = share;
        alpha.finalBalance = round2(alpha.finalBalance + share);
        spilloverDistributed = round2(spilloverDistributed + share);
      }
    }
  }

  // Step 5: Bot Profit Routing — hired bot's net profit goes to their owner
  const playerMap = new Map(results.map((r) => [r.playerId, r]));

  for (const r of results) {
    if (r.isBot && r.hiredBy) {
      const botProfit = round2(r.finalBalance - buyIn);
      if (botProfit > 0) {
        const owner = playerMap.get(r.hiredBy);
        if (owner) {
          // Transfer profit from bot to owner
          r.botProfitRouted = -botProfit; // bot loses the profit
          r.finalBalance = buyIn;         // bot resets to buyIn
          owner.botProfitRouted = round2(owner.botProfitRouted + botProfit);
          owner.finalBalance = round2(owner.finalBalance + botProfit);

          console.log(
            `[Payout] Bot ${r.username} routed $${botProfit.toFixed(2)} profit to ${owner.username}`
          );
        }
      }
    }
  }

  return {
    players: results,
    safetyNetTotal: round2(inactiveForfeited + alphas.reduce((s, a) => s + a.alphaTax, 0)),
    bailoutDistributed,
    spilloverDistributed,
    inactiveForfeited,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
