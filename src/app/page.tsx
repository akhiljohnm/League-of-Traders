import Link from "next/link";
import Navbar from "@/components/Navbar";
import BotGrid from "@/components/BotGrid";
import HeroSection from "@/components/HeroSection";
import AnimateIn from "@/components/AnimateIn";
import { StaggerGrid, StaggerItem } from "@/components/AnimateStagger";
import PayoutBar from "@/components/PayoutBar";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-primary">
      <Navbar />

      {/* ===================== HERO ===================== */}
      <HeroSection />

      {/* ================ HOW IT WORKS ================ */}
      <section id="how-it-works" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Section header */}
          <AnimateIn className="text-center mb-16">
            <p className="section-label mb-3">// 01 — How It Works</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-4 tracking-wide">
              Three Steps. One Round.
            </h2>
            <p className="text-text-secondary text-center max-w-md mx-auto text-sm">
              Everything on the line. Nobody trades alone.
            </p>
          </AnimateIn>

          {/* Cards — stagger */}
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StaggerItem>
              <StepCard
                step="01"
                title="Assemble Your Squad"
                description="5 players join a lobby — humans or AI Mercenary Bots. Everyone puts up $10,000 Game Tokens. No one trades alone."
                accent="cyan"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                }
              />
            </StaggerItem>
            <StaggerItem>
              <StepCard
                step="02"
                title="Trade the Markets"
                description="A 5-minute countdown begins. Buy UP or DOWN contracts against live Deriv market prices. Every tick counts."
                accent="green"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                }
              />
            </StaggerItem>
            <StaggerItem>
              <StepCard
                step="03"
                title="Split the Profits"
                description="When the timer hits zero, the 80/20 Engine kicks in. Winners fund the Safety Net. Losers get bailed out. Nobody walks away empty."
                accent="red"
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                }
              />
            </StaggerItem>
          </StaggerGrid>
        </div>
      </section>

      {/* ============= VIDEO SHOWCASE ============= */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <AnimateIn className="text-center mb-10">
            <p className="section-label mb-3">// See It Live</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-4 tracking-wide">
              Watch the{" "}
              <span className="text-gradient-cyan">Game</span>{" "}
              in Action
            </h2>
            <p className="text-text-secondary text-center max-w-md mx-auto text-sm">
              Five players. Five minutes. One shared market. Zero mercy.
            </p>
          </AnimateIn>

          <AnimateIn delay={0.1}>
            <div className="relative rounded-2xl overflow-hidden border border-safety-cyan/20 bg-bg-surface shadow-[0_0_60px_-15px_rgba(0,229,255,0.15)]">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-safety-cyan to-transparent" />
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src="https://www.youtube.com/embed/xDXUiD5JF2Y"
                  title="League of Traders — Gameplay Demo"
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      <div className="neon-divider max-w-4xl mx-auto" />

      {/* ============= WHY LEAGUE ============= */}
      <section id="why" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">

          <AnimateIn className="text-center mb-16">
            <p className="section-label mb-3">// 02 — Why League?</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-4 tracking-wide">
              Trading, Redesigned.
            </h2>
            <p className="text-text-secondary text-center max-w-md mx-auto text-sm">
              Two things that break traders. We fixed both.
            </p>
          </AnimateIn>

          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">

            {/* Card 1 — Social Proof */}
            <StaggerItem>
              <div className="relative bg-bg-surface border border-alpha-green/20 rounded-xl p-8 h-full overflow-hidden flex flex-col">
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-0.5 step-card-accent-green" />
                {/* Watermark */}
                <div className="absolute bottom-2 right-4 font-mono-numbers font-black text-8xl text-alpha-green opacity-[0.04] select-none pointer-events-none leading-none">
                  01
                </div>

                {/* Icon */}
                <div className="w-11 h-11 rounded-xl bg-alpha-green/10 border border-alpha-green/20 flex items-center justify-center mb-6 text-alpha-green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>

                <span className="font-mono-numbers text-[10px] font-bold text-alpha-green opacity-70 block mb-2 uppercase tracking-[0.3em]">
                  Social Proof
                </span>
                <h3 className="font-display text-2xl font-bold text-text-primary mb-3 tracking-wide">
                  Not a Scam.{" "}
                  <span className="text-alpha-green">A Skill Issue.</span>
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-6">
                  Solo trading breeds paranoia. Every loss feels rigged. But when you are
                  trading <span className="text-text-primary font-semibold">the exact same ticks</span> alongside
                  your teammates — and you watch them pocket the green — the math becomes
                  undeniable.
                </p>

                {/* Callout quote */}
                <div className="mt-auto bg-alpha-green/5 border border-alpha-green/15 rounded-lg px-5 py-4">
                  <p className="text-alpha-green font-display font-semibold text-sm leading-snug">
                    &ldquo;If they won on that tick, I should have too.&rdquo;
                  </p>
                  <p className="text-text-muted text-xs mt-1.5">
                    Shared market data. No excuses. Just edge.
                  </p>
                </div>
              </div>
            </StaggerItem>

            {/* Card 2 — Safety Net / Soft Landing */}
            <StaggerItem>
              <div className="relative bg-bg-surface border border-safety-cyan/20 rounded-xl p-8 h-full overflow-hidden flex flex-col">
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-safety-cyan to-transparent" />
                {/* Watermark */}
                <div className="absolute bottom-2 right-4 font-mono-numbers font-black text-8xl text-safety-cyan opacity-[0.04] select-none pointer-events-none leading-none">
                  02
                </div>

                {/* Icon */}
                <div className="w-11 h-11 rounded-xl bg-safety-cyan/10 border border-safety-cyan/20 flex items-center justify-center mb-6 text-safety-cyan">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>

                <span className="font-mono-numbers text-[10px] font-bold text-safety-cyan opacity-70 block mb-2 uppercase tracking-[0.3em]">
                  Soft Landing
                </span>
                <h3 className="font-display text-2xl font-bold text-text-primary mb-3 tracking-wide">
                  Lose Less.{" "}
                  <span className="text-safety-cyan">Stay Sane.</span>
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-6">
                  Most traders blow their account, rage-quit, and never come back — convinced
                  the market is against them. In League of Traders, winners automatically
                  fund a <span className="text-text-primary font-semibold">Safety Net</span> that
                  softens the blow for everyone who lost. You walk away with
                  <span className="text-text-primary font-semibold"> something</span> — not a bitter
                  zero.
                </p>

                {/* Example visual */}
                <div className="mt-auto space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Your loss</span>
                    <span className="font-mono-numbers text-rekt-crimson font-bold">− $3,200</span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-primary rounded-full overflow-hidden">
                    <div className="h-full w-[62%] bg-gradient-to-r from-safety-cyan/60 to-safety-cyan rounded-full" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Safety Net refund</span>
                    <span className="font-mono-numbers text-safety-cyan font-bold">+ $1,980</span>
                  </div>
                  <div className="pt-1 border-t border-border-default flex items-center justify-between text-xs">
                    <span className="text-text-secondary font-semibold">You keep</span>
                    <span className="font-mono-numbers text-text-primary font-bold">$8,780 <span className="text-text-muted font-normal">/ $10,000</span></span>
                  </div>
                </div>
              </div>
            </StaggerItem>

          </StaggerGrid>
        </div>
      </section>

      <div className="neon-divider max-w-4xl mx-auto" />

      {/* ============= THE 80/20 ENGINE ============= */}
      <section id="engine" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Section header */}
          <AnimateIn className="text-center mb-12">
            <p className="section-label mb-3">// 03 — Payout Model</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-4 tracking-wide">
              The{" "}
              <span className="text-gradient-cyan">80/20</span>{" "}
              Engine
            </h2>
            <p className="text-text-secondary text-center max-w-lg mx-auto text-sm">
              Cutthroat competition meets cooperative game theory.
              Winners fund losers. Everyone keeps playing.
            </p>
          </AnimateIn>

          {/* Animated 80/20 bar */}
          <AnimateIn className="max-w-3xl mx-auto mb-10" delay={0.1}>
            <PayoutBar />
          </AnimateIn>

          {/* Payout cards */}
          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <StaggerItem>
              <PayoutCard
                icon="▲"
                iconColor="text-alpha-green"
                borderAccent="rgba(0,255,163,0.15)"
                title="Alpha Winners"
                items={[
                  "Keep 80% of net profit",
                  "Get your $10,000 buy-in back",
                  "Receive Victory Spillover from unused Safety Net",
                ]}
              />
            </StaggerItem>
            <StaggerItem>
              <PayoutCard
                icon="▼"
                iconColor="text-rekt-crimson"
                borderAccent="rgba(255,51,102,0.15)"
                title="Rescued Players"
                items={[
                  "Split the 20% Safety Net fund evenly",
                  "Bailout capped at $10,000 — never more",
                  "Stay in the game for the next round",
                ]}
              />
            </StaggerItem>
          </StaggerGrid>

          {/* Active Quota Rule */}
          <AnimateIn delay={0.1} className="mt-8 max-w-3xl mx-auto">
            <div className="bg-bg-surface border border-safety-cyan/20 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-safety-cyan/10 border border-safety-cyan/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-safety-cyan text-sm">⚠</span>
                </div>
                <div>
                  <span className="text-text-primary font-semibold text-sm block mb-1">
                    Active Quota Rule
                  </span>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    Any player with fewer than{" "}
                    <span className="font-mono-numbers text-text-primary font-bold">5</span>{" "}
                    trades forfeits their entire balance. No passengers allowed —
                    everyone must contribute to the team.
                  </p>
                </div>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      <div className="neon-divider max-w-4xl mx-auto" />

      {/* ============= MERCENARY BOTS ============= */}
      <section id="bots" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <AnimateIn className="text-center">
            <p className="section-label mb-3">// 04 — AI Teammates</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-4 tracking-wide">
              Mercenary Bots
            </h2>
            <p className="text-text-secondary text-center max-w-lg mx-auto mb-5 text-sm">
              Subscribe to unlock AI teammates. Their profits are your profits.
            </p>

            {/* AutoResearch badge */}
            <div className="flex justify-center mb-14">
              <div className="inline-flex items-center gap-2.5 bg-bg-surface border border-border-hover rounded-full px-5 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-alpha-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-alpha-green" />
                </span>
                <span className="text-xs text-text-secondary">
                  Powered by{" "}
                  <span className="text-text-primary font-semibold">AutoResearch</span>
                  {" "}
                  <span className="text-text-muted">
                    — Karpathy&apos;s autonomous optimization across 5 live markets
                  </span>
                </span>
              </div>
            </div>
          </AnimateIn>

          <BotGrid />

          {/* Brain note */}
          <AnimateIn className="mt-6 max-w-2xl mx-auto">
            <div className="bg-bg-surface/50 border border-border-default rounded-xl p-5">
              <p className="text-text-muted text-xs leading-relaxed text-center">
                <span className="text-text-secondary font-semibold">One brain, three personalities.</span>{" "}
                All bots share the same AutoResearch-optimized signal engine — blending
                EMA crossover, Bollinger Bands, and micro-momentum across{" "}
                <span className="font-mono-numbers text-safety-cyan font-bold">5</span> volatility
                markets. When the brain improves, every bot improves.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      <div className="neon-divider max-w-4xl mx-auto" />

      {/* ============= PLAYER FEEDBACK ============= */}
      <section id="feedback" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">

          <AnimateIn className="text-center mb-16">
            <p className="section-label mb-3">// 05 — Player Feedback</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-text-primary mb-4 tracking-wide">
              What Players{" "}
              <span className="text-gradient-cyan">Think</span>
            </h2>
            <p className="text-text-secondary text-center max-w-md mx-auto text-sm">
              Don&apos;t take our word for it. Hear it from the traders.
            </p>
          </AnimateIn>

          <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <StaggerItem>
              <div className="relative bg-bg-surface border border-border-default rounded-xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 step-card-accent-cyan" />
                <iframe
                  src="https://www.youtube.com/embed/OnKOVT5GyUw"
                  title="Player feedback 1"
                  className="w-full aspect-[9/16]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="relative bg-bg-surface border border-border-default rounded-xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 step-card-accent-green" />
                <iframe
                  src="https://www.youtube.com/embed/91UkX7walX4"
                  title="Player feedback 2"
                  className="w-full aspect-[9/16]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="relative bg-bg-surface border border-border-default rounded-xl overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 step-card-accent-red" />
                <iframe
                  src="https://www.youtube.com/embed/w3DyXioWQjc"
                  title="Player feedback 3"
                  className="w-full aspect-[9/16]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </StaggerItem>
          </StaggerGrid>
        </div>
      </section>

      <div className="neon-divider max-w-4xl mx-auto" />

      {/* ================ FOOTER CTA ================ */}
      <section id="join" className="py-32 px-6 relative overflow-hidden">
        {/* Background atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(0,229,255,0.06)_0%,transparent_70%)]" />
        <div className="absolute inset-0 hero-grid opacity-30" />

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <AnimateIn>
            <p className="section-label mb-4">// Enter the Arena</p>
            <h2 className="font-display text-4xl sm:text-6xl font-bold text-text-primary mb-4 tracking-wide terminal-cursor">
              Ready to play?
            </h2>
            <p className="text-text-secondary mb-10 text-sm">
              Pick a name. Join a lobby. Prove you belong.
            </p>
          </AnimateIn>

          <AnimateIn delay={0.18}>
            <div className="flex flex-col items-center gap-10">
              <a
                href="/play"
                className="inline-block py-4 px-14 bg-safety-cyan text-bg-primary font-bold text-base tracking-widest rounded-xl btn-glow cursor-pointer font-display uppercase"
              >
                Join the League
              </a>

              {/* Stats row */}
              <StaggerGrid className="flex items-center justify-center gap-6">
                <StaggerItem><Stat value="5" label="Players" /></StaggerItem>
                <StaggerItem><div className="w-px h-8 bg-border-hover" /></StaggerItem>
                <StaggerItem><Stat value="$10K" label="Buy-in" /></StaggerItem>
                <StaggerItem><div className="w-px h-8 bg-border-hover" /></StaggerItem>
                <StaggerItem><Stat value="5:00" label="Per Round" /></StaggerItem>
                <StaggerItem><div className="w-px h-8 bg-border-hover" /></StaggerItem>
                <StaggerItem><Stat value="80/20" label="Payout" /></StaggerItem>
              </StaggerGrid>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ================ FOOTER ================ */}
      <footer className="border-t border-border-default py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-safety-cyan font-display font-bold text-sm tracking-widest">League of Traders</span>
            <span className="text-border-hover">·</span>
            <span className="text-text-muted text-xs">
              Powered by <span className="text-text-secondary">Deriv API V2</span>
            </span>
          </div>
          <span className="text-text-muted text-xs font-mono-numbers tracking-wider">
            // Built for the API Grand Prix 2026
          </span>
        </div>
      </footer>
    </main>
  );
}

/* ===================== COMPONENTS ===================== */

function StepCard({
  step,
  title,
  description,
  accent,
  icon,
}: {
  step: string;
  title: string;
  description: string;
  accent: "cyan" | "green" | "red";
  icon: React.ReactNode;
}) {
  const accentMap = {
    cyan: {
      color: "text-safety-cyan",
      bg: "bg-safety-cyan/10",
      border: "border-safety-cyan/20",
      line: "step-card-accent-cyan",
    },
    green: {
      color: "text-alpha-green",
      bg: "bg-alpha-green/10",
      border: "border-alpha-green/20",
      line: "step-card-accent-green",
    },
    red: {
      color: "text-rekt-crimson",
      bg: "bg-rekt-crimson/10",
      border: "border-rekt-crimson/20",
      line: "step-card-accent-red",
    },
  };

  const a = accentMap[accent];

  return (
    <div className="relative bg-bg-surface border border-border-default rounded-xl p-6 flex flex-col overflow-hidden h-full">
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${a.line}`} />

      {/* Big background step number */}
      <div className={`absolute bottom-3 right-4 font-mono-numbers font-black text-8xl ${a.color} opacity-[0.04] select-none pointer-events-none leading-none`}>
        {step}
      </div>

      {/* Icon */}
      <div className={`w-10 h-10 rounded-lg ${a.bg} border ${a.border} flex items-center justify-center mb-5 ${a.color}`}>
        {icon}
      </div>

      {/* Step label */}
      <span className={`font-mono-numbers text-[10px] font-bold ${a.color} opacity-70 block mb-2 uppercase tracking-[0.3em]`}>
        Step {step}
      </span>

      <h3 className="font-display text-xl font-bold text-text-primary mb-2 tracking-wide">
        {title}
      </h3>
      <p className="text-text-secondary text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function PayoutCard({
  icon,
  iconColor,
  borderAccent,
  title,
  items,
}: {
  icon: string;
  iconColor: string;
  borderAccent: string;
  title: string;
  items: string[];
}) {
  return (
    <div
      className="bg-bg-surface rounded-xl p-6 border transition-all duration-300 h-full"
      style={{ borderColor: borderAccent }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span className={`${iconColor} text-xl`}>{icon}</span>
        <h3 className="font-display text-lg font-bold text-text-primary tracking-wide">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <span className="text-text-muted mt-0.5 text-xs shrink-0">✓</span>
            <span className="text-text-secondary text-sm">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-mono-numbers text-text-primary font-bold text-lg leading-none mb-1">
        {value}
      </div>
      <div className="text-[10px] text-text-muted uppercase tracking-widest">{label}</div>
    </div>
  );
}
