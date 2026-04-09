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
