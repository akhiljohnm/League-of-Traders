import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Vibe-Coding Log | League of Traders",
  description:
    "A real-time log of AI-assisted development for the Deriv API Grand Prix 2026.",
};

const ENTRIES: VibeEntryData[] = [
  {
    phase: "Phase 1",
    phaseColor: "bg-safety-cyan/10 text-safety-cyan",
    title: "Manual Scaffolding Over CLI",
    problem:
      "create-next-app refused to initialize in a directory named 'League of Traders' — npm naming restrictions block spaces and capitals.",
    solution:
      "Bypassed the CLI entirely. Hand-crafted package.json, tsconfig, and all configs manually. Faster than the CLI and zero boilerplate to delete.",
    tech: "Next.js 16 + Tailwind v4 + TypeScript — first build passed with zero errors.",
  },
  {
    phase: "Phase 1",
    phaseColor: "bg-safety-cyan/10 text-safety-cyan",
    title: "Cyber-Terminal Theme System",
    problem:
      "The design spec demanded a data-dense, high-frequency trading terminal aesthetic with specific brand colors and monospace numbers.",
    solution:
      "Built a semantic token system using Tailwind v4's @theme directive. Defined glow effects, live-pulse animations, and tabular-nums for price stability.",
    tech: "Custom CSS with @theme {} block, Google Fonts via next/font, .font-mono-numbers with font-variant-numeric: tabular-nums.",
  },
  {
    phase: "Phase 2",
    phaseColor: "bg-alpha-green/10 text-alpha-green",
    title: "4-Table Supabase Schema",
    problem:
      "Needed a relational database to manage multiplayer lobbies, virtual balances, paper trades, and bot mechanics — all with real-time sync.",
    solution:
      "Designed players → lobbies → lobby_players → trades with enum types for status lifecycles, hired_by tracking for bots, and Supabase Realtime publication.",
    tech: "SQL migration pushed via supabase db push. RLS enabled with open policies. TypeScript types mirror the schema exactly.",
  },
  {
    phase: "Phase 2",
    phaseColor: "bg-rekt-crimson/10 text-rekt-crimson",
    title: "UUID Function Bug on Supabase",
    problem:
      "uuid_generate_v4() threw SQLSTATE 42883 even though uuid-ossp extension was installed — functions weren't in the public schema.",
    solution:
      "Switched to PostgreSQL's built-in gen_random_uuid() (Postgres 13+). No extension dependency, and it's actually the modern best practice.",
    tech: "Find-and-replace across migration SQL. Re-pushed with supabase db push — all 4 tables verified via JS client.",
  },
  {
    phase: "Landing Page",
    phaseColor: "bg-safety-cyan/10 text-safety-cyan",
    title: "Multi-Section Marketing Website",
    problem:
      "The initial page.tsx was a simple centered card. Needed a proper marketing website explaining the concept with a prominent CTA.",
    solution:
      "Designed a 5-section scroll-through landing page: Hero, How It Works, 80/20 Engine, Mercenary Bots, and Footer CTA. Zero dependencies added — pure Tailwind + CSS animations.",
    tech: "Custom CSS: hero-grid, hero-radial, btn-glow, animate-fade-up with stagger delays, text-gradient-cyan, card-hover lift. All TypeScript-typed components.",
  },
  {
    phase: "Navigation",
    phaseColor: "bg-alpha-green/10 text-alpha-green",
    title: "Sticky Navbar with Scroll Tracking",
    problem:
      "Landing page needed navigation with active tab highlighting and a dedicated Vibe-Coding page to keep the homepage clean.",
    solution:
      "Built a client-side Navbar with IntersectionObserver for active section detection, glassmorphism effect, mobile hamburger menu, and hybrid routing — anchor scrolls for homepage sections, Next.js Link for the /vibe-coding page.",
    tech: "IntersectionObserver with rootMargin '-40% 0px -55% 0px', nav-glass CSS with backdrop-blur, usePathname() for route-aware active states.",
  },
  {
    phase: "Phase 3",
    phaseColor: "bg-rekt-crimson/10 text-rekt-crimson",
    title: "V3 to V2 API Correction via llms.md",
    problem:
      "Initial research pointed to the old Deriv v3 WebSocket API. The llms.md doc revealed the correct V2 API with a completely different URL, symbol naming, and no app_id requirement.",
    solution:
      "Audited llms.md: public WS is wss://api.derivws.com/trading/v1/options/ws/public, symbol is 1HZ100V (not R_100), forget_all takes an array, and pinging every 30s is mandatory.",
    tech: "Updated .env.local, built TypeScript types in src/lib/types/deriv.ts matching exact V2 response shapes.",
  },
  {
    phase: "Phase 3",
    phaseColor: "bg-alpha-green/10 text-alpha-green",
    title: "useDerivTicker — Production WebSocket Hook",
    problem:
      "Need a React hook managing the full WebSocket lifecycle: connect, subscribe, ping, error handling, exponential backoff reconnect, and clean unmount.",
    solution:
      "Built useDerivTicker with 25s ping interval, subscription ID tracking, forget_all cleanup on unmount, and exponential backoff (1s to 30s cap). LiveTicker component shows live quote with green/red glow.",
    tech: "src/hooks/useDerivTicker.ts returns { currentTick, previousTick, isConnected, connectionState, error, tickCount }. LiveTicker embedded in homepage hero.",
  },
  {
    phase: "Phase 4",
    phaseColor: "bg-safety-cyan/10 text-safety-cyan",
    title: "Real-Time Lobby with Mercenary Bot Hiring",
    problem:
      "Needed a lobby system where players wait for others, see live updates via WebSocket, and can hire AI bots to fill empty slots — all without a dedicated server.",
    solution:
      "Built LobbyView with Supabase Realtime subscriptions on lobby_players table. Bot hiring creates a new player record with is_bot=true, deducts buy-in from the hiring human, and auto-locks the lobby at 5/5.",
    tech: "Supabase Realtime postgres_changes, optimistic UI updates, auto-lock via checkAndLockLobby(), 3 bot strategies (trend_follower, mean_reverter, high_freq_gambler).",
  },
  {
    phase: "Phase 4",
    phaseColor: "bg-rekt-crimson/10 text-rekt-crimson",
    title: "Dynamic Market Selection from Deriv API",
    problem:
      "Players needed to choose which market to trade. Hardcoding Volatility 100 limited the experience. The Deriv V2 API provides active_symbols with hundreds of instruments.",
    solution:
      "Built useActiveSymbols hook that fetches all tradeable instruments, groups them by market/submarket, and presents them in a collapsible selector. Players choose their battleground before matchmaking.",
    tech: "Custom useActiveSymbols hook, DerivActiveSymbol types, grouped accordion UI, symbol-scoped lobby matching via findOrCreateLobby(buyIn, symbol).",
  },
  {
    phase: "Phase 5",
    phaseColor: "bg-alpha-green/10 text-alpha-green",
    title: "useGameEngine — 5-Minute Trading Cockpit",
    problem:
      "Need to orchestrate a 5-minute timed game loop: live Deriv price ticks, human Rise/Fall trading, concurrent bot decision-making, trade resolution, and real-time leaderboard — all in a single React hook.",
    solution:
      "Built useGameEngine as the central orchestrator. It manages game phases (starting, active, ending, finished), feeds ticks to BotEngine, handles optimistic stake deductions, and resolves trades based on tick maturity.",
    tech: "Custom hook composing useDerivTicker + BotEngine class, concurrent async trade resolution, 100ms timer interval, tick-indexed trade maturity tracking.",
  },
  {
    phase: "Phase 5",
    phaseColor: "bg-safety-cyan/10 text-safety-cyan",
    title: "Rise/Fall Paper Trading Module",
    problem:
      "All trades must be simulated locally — no Deriv proposal/buy/sell APIs. We needed a shared module for win/loss determination and payout math used by both humans and bots.",
    solution:
      "Built rise-fall.ts as a pure module with placeTrade() and resolveTrade(). Win condition: UP wins when exit > entry, DOWN wins when exit < entry. Same price = loss. Payout: 1.954x for Rise, 1.952x for Fall.",
    tech: "Supabase trades table for persistence, round2() helper for float safety, configurable tick durations (1-10), shared by GameView and BotEngine.",
  },
  {
    phase: "Phase 6",
    phaseColor: "bg-rekt-crimson/10 text-rekt-crimson",
    title: "3-Strategy Bot Framework with Tunable Hyperparameters",
    problem:
      "Bots needed distinct trading personalities: a conservative trend-follower, a contrarian mean-reverter, and an aggressive high-frequency gambler — each with realistic trade timing and stake sizing.",
    solution:
      "Implemented BotStrategyInstance interface with onTick()/reset(). Trend Follower uses dual-EMA crossover, Mean Reverter uses Bollinger Bands, HF Gambler uses momentum-biased coin flips. All share configurable hyperparameter objects.",
    tech: "Strategy pattern with TypeScript interfaces. EMA calculations, rolling standard deviation for Bollinger Bands, cooldown timers, game-aware staking with quota urgency and role-aware sizing.",
  },
  {
    phase: "Phase 7",
    phaseColor: "bg-safety-cyan/10 text-safety-cyan",
    title: "Pure-Function Payout Engine with Alpha Tax & Bailout",
    problem:
      "The core game mechanic: winners (Alphas) pay 20% of profits into a Safety Net, which bails out losers (Rescues). Surplus returns to Alphas as Spillover. Inactive players forfeit everything. Bot profits route to their hiring human.",
    solution:
      "Built calculatePayouts() as a pure function — no side effects, no DB calls. 5-step pipeline: classify, tax, bailout, spillover, bot-routing. All math uses round2() to prevent floating-point drift.",
    tech: "Pure TypeScript function with PayoutInput to PayoutSummary. Deficit-sorted bailout distribution, proportional spillover, and bot profit routing via hiredBy relationship.",
  },
  {
    phase: "Phase 8",
    phaseColor: "bg-alpha-green/10 text-alpha-green",
    title: "Post-Game Results Screen with Animated Payout Flow",
    problem:
      "Game ended abruptly with a basic overlay. No MVP highlight, no bot narratives, no payout flow visualization, and the player's final balance was never credited back to their global account.",
    solution:
      "Replaced the overlay with a full-screen PostGameView component on a dedicated 'post-game' phase. Added MVP crown with gold glow, bot narrative highlights, animated payout flow bars, balance crediting to Supabase, and Play Again flow.",
    tech: "New PlayPhase 'post-game', PayoutSummary passed from GameView to PlayPage to PostGameView. CSS keyframe animations for crown-bounce, flow-bar, scale-in. creditPlayerBalance server action for Supabase balance refund.",
  },
];

export default function VibeCodingPage() {
  return (
    <main className="min-h-screen bg-bg-primary">
      <Navbar />

      {/* Header */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-8">
            <Link
              href="/"
              className="text-text-muted text-sm hover:text-text-secondary transition-colors"
            >
              Home
            </Link>
            <span className="text-text-muted text-sm">/</span>
            <span className="text-safety-cyan text-sm">Vibe-Coding</span>
          </div>

          <div className="inline-flex items-center gap-2 bg-safety-cyan/10 border border-safety-cyan/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-safety-cyan text-xs font-mono-numbers uppercase tracking-widest">
              AI-Assisted Development
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-4">
            Vibe-Coding{" "}
            <span className="text-gradient-cyan">Log</span>
          </h1>

          <p className="text-text-secondary text-lg max-w-2xl">
            Every major decision, every bug squashed, every pivot — documented
            in real-time as human and AI built League of Traders together for
            the Deriv API Grand Prix 2026.
          </p>

          {/* Stats bar */}
          <div className="flex items-center gap-6 mt-8 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-alpha-green" />
              <span className="text-text-muted">
                <span className="font-mono-numbers text-text-primary">
                  {ENTRIES.length}
                </span>{" "}
                entries logged
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-safety-cyan" />
              <span className="text-text-muted">
                Updated with every milestone
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="divider-gradient max-w-4xl mx-auto" />

      {/* Timeline */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            {ENTRIES.map((entry, i) => (
              <VibeEntry key={i} index={i + 1} {...entry} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer note */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-bg-surface border border-border-default rounded-xl p-6 text-center">
            <p className="text-text-secondary text-sm">
              This page is a live mirror of{" "}
              <span className="text-safety-cyan font-mono-numbers">
                vibe-coding.md
              </span>{" "}
              in our repository. New entries are added as we build each phase of
              League of Traders.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 py-2 px-6 bg-safety-cyan text-bg-primary text-sm font-bold rounded-lg hover:brightness-110 active:scale-[0.98] transition-all duration-150"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-default py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-text-muted text-xs">
            Powered by{" "}
            <span className="text-text-secondary">Deriv API V2</span>
          </span>
          <span className="text-text-muted text-xs">
            Built for the API Grand Prix 2026
          </span>
        </div>
      </footer>
    </main>
  );
}

/* ===================== COMPONENTS ===================== */

interface VibeEntryData {
  phase: string;
  phaseColor: string;
  title: string;
  problem: string;
  solution: string;
  tech: string;
}

function VibeEntry({
  index,
  phase,
  phaseColor,
  title,
  problem,
  solution,
  tech,
}: VibeEntryData & { index: number }) {
  return (
    <div className="relative pl-12">
      {/* Timeline dot with number */}
      <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-bg-surface border border-border-default flex items-center justify-center">
        <span className="font-mono-numbers text-xs text-safety-cyan font-bold">
          {String(index).padStart(2, "0")}
        </span>
      </div>
      {/* Connector line */}
      <div className="timeline-line" />

      <div className="bg-bg-surface border border-border-default rounded-xl p-6 card-hover">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`${phaseColor} text-[10px] font-mono-numbers font-bold uppercase tracking-wider px-2 py-0.5 rounded-full`}
          >
            {phase}
          </span>
          <h3 className="text-text-primary font-semibold text-sm">{title}</h3>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <span className="text-rekt-crimson font-mono-numbers text-xs uppercase tracking-wider">
              Problem
            </span>
            <p className="text-text-secondary mt-1">{problem}</p>
          </div>
          <div>
            <span className="text-alpha-green font-mono-numbers text-xs uppercase tracking-wider">
              Solution
            </span>
            <p className="text-text-secondary mt-1">{solution}</p>
          </div>
          <div>
            <span className="text-safety-cyan font-mono-numbers text-xs uppercase tracking-wider">
              Tech
            </span>
            <p className="text-text-secondary mt-1">{tech}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
