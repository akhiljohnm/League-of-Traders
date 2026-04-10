import Link from "next/link";
import Navbar from "@/components/Navbar";
import LiveTicker from "@/components/LiveTicker";
import BotGrid from "@/components/BotGrid";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-primary">
      <Navbar />

      {/* ===================== HERO ===================== */}
      <section
        id="home"
        className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
      >
        {/* Grid background + radial overlay */}
        <div className="absolute inset-0 hero-grid" />
        <div className="absolute inset-0 hero-radial" />

        {/* Content */}
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 bg-bg-surface border border-border-default rounded-full px-4 py-1.5 mb-8 animate-fade-up">
            <span className="w-2 h-2 rounded-full bg-alpha-green animate-live-pulse" />
            <span className="text-xs text-text-muted uppercase tracking-widest font-mono-numbers">
              Markets Live
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-text-primary mb-4 animate-fade-up stagger-1">
            LEAGUE OF{" "}
            <span className="text-gradient-cyan">TRADERS</span>
          </h1>

          <p className="text-lg sm:text-xl text-text-secondary max-w-xl mx-auto mb-8 animate-fade-up stagger-2">
            5 players. 5 minutes. Live markets.
            <br />
            <span className="text-text-primary font-medium">
              Turn trading into a team sport.
            </span>
          </p>

          {/* Live Price Feed */}
          <div className="mb-8 animate-fade-up stagger-3">
            <LiveTicker />
          </div>

          <div className="animate-fade-up stagger-4">
            <Link
              href="/play"
              className="inline-block py-4 px-10 bg-safety-cyan text-bg-primary font-bold text-lg rounded-xl btn-glow cursor-pointer"
            >
              JOIN THE LEAGUE
            </Link>
          </div>

          <p className="text-text-muted text-sm mt-6 animate-fade-up stagger-4">
            No real money. No account needed. Just pick a name and play.
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted animate-fade-up stagger-4">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <svg
            width="16"
            height="24"
            viewBox="0 0 16 24"
            fill="none"
            className="animate-bounce"
          >
            <path
              d="M8 4v12m0 0l-4-4m4 4l4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </section>

      {/* ================ HOW IT WORKS ================ */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-text-primary mb-4">
            How It Works
          </h2>
          <p className="text-text-secondary text-center max-w-lg mx-auto mb-16">
            Three steps. One round. Everything on the line.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              step="01"
              title="Assemble Your Squad"
              description="5 players join a lobby — humans or AI Mercenary Bots. Everyone puts up $10,000 Game Tokens. No one trades alone."
              accent="safety-cyan"
            />
            <StepCard
              step="02"
              title="Trade the Markets"
              description="A 5-minute countdown begins. Buy UP or DOWN contracts against live Deriv market prices. Every tick counts."
              accent="alpha-green"
            />
            <StepCard
              step="03"
              title="Split the Profits"
              description="When the timer hits zero, the 80/20 Engine kicks in. Winners fund the Safety Net. Losers get bailed out. Nobody walks away empty."
              accent="rekt-crimson"
            />
          </div>
        </div>
      </section>

      <div className="divider-gradient max-w-4xl mx-auto" />

      {/* ============= THE 80/20 ENGINE ============= */}
      <section id="engine" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-text-primary mb-4">
            The{" "}
            <span className="text-gradient-cyan">80/20</span>{" "}
            Engine
          </h2>
          <p className="text-text-secondary text-center max-w-lg mx-auto mb-16">
            Our profit contribution model turns cutthroat competition into
            cooperative game theory.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <PayoutCard
              icon="&#9650;"
              iconColor="text-alpha-green"
              title="Alpha Winners"
              items={[
                "Keep 80% of net profit",
                "Get your $10,000 buy-in back",
                "Receive Victory Spillover from unused Safety Net",
              ]}
            />
            <PayoutCard
              icon="&#9660;"
              iconColor="text-rekt-crimson"
              title="Rescued Players"
              items={[
                "Split the 20% Safety Net fund evenly",
                "Bailout capped at $10,000 — never more",
                "Stay in the game for the next round",
              ]}
            />
          </div>

          <div className="mt-12 bg-bg-surface border border-border-default rounded-xl p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-safety-cyan text-lg">&#9888;</span>
              <span className="text-text-primary font-semibold text-sm">
                Active Quota Rule
              </span>
            </div>
            <p className="text-text-secondary text-sm">
              Any player with fewer than{" "}
              <span className="font-mono-numbers text-text-primary">5</span>{" "}
              trades forfeits their entire balance. No passengers allowed —
              everyone must contribute to the team.
            </p>
          </div>
        </div>
      </section>

      <div className="divider-gradient max-w-4xl mx-auto" />

      {/* ============= MERCENARY BOTS ============= */}
      <section id="bots" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-text-primary mb-4">
            Mercenary Bots
          </h2>
          <p className="text-text-secondary text-center max-w-lg mx-auto mb-4">
            Subscribe to unlock AI teammates. Their profits are your profits.
          </p>

          {/* AutoResearch badge */}
          <div className="flex justify-center mb-16">
            <div className="inline-flex items-center gap-2 bg-bg-surface border border-border-default rounded-full px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-alpha-green opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-alpha-green" />
              </span>
              <span className="text-xs text-text-secondary">
                Powered by{" "}
                <span className="text-text-primary font-semibold">
                  AutoResearch
                </span>{" "}
                <span className="text-text-muted">
                  — Karpathy&apos;s autonomous optimization across 5 live markets
                </span>
              </span>
            </div>
          </div>

          <BotGrid />

          {/* Revenue model explainer */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-bg-surface border border-border-default rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-safety-cyan">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <h4 className="text-text-primary font-semibold text-sm">How it works</h4>
              </div>
              <ul className="space-y-2 text-text-secondary text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-safety-cyan mt-0.5 text-xs font-bold">1</span>
                  <span>Subscribe to a bot for <span className="font-mono-numbers text-text-primary">$200/mo</span> from your game balance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-safety-cyan mt-0.5 text-xs font-bold">2</span>
                  <span>Hire your unlocked bot into any lobby (buy-in cost applies)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-safety-cyan mt-0.5 text-xs font-bold">3</span>
                  <span>Bot trades autonomously — profits route back to you</span>
                </li>
              </ul>
            </div>
            <div className="bg-bg-surface border border-border-default rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-alpha-green">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <h4 className="text-text-primary font-semibold text-sm">Recurring revenue</h4>
              </div>
              <p className="text-text-secondary text-sm leading-relaxed">
                Subscriptions auto-renew monthly from your game balance. If your balance
                dips below <span className="font-mono-numbers text-text-primary">$200</span> on
                renewal day, the bot locks until you top up. No commitments — your balance
                is your subscription.
              </p>
            </div>
          </div>

          {/* Brain explainer */}
          <div className="mt-6 bg-bg-surface/50 border border-border-default rounded-xl p-5 max-w-2xl mx-auto">
            <p className="text-text-muted text-xs leading-relaxed text-center">
              <span className="text-text-secondary font-semibold">One brain, three personalities.</span>{" "}
              All bots share the same AutoResearch-optimized signal engine — blending
              EMA crossover, Bollinger Bands, and micro-momentum across{" "}
              <span className="font-mono-numbers text-safety-cyan">5</span> volatility
              markets. When the brain improves, every bot improves.
            </p>
          </div>
        </div>
      </section>

      <div className="divider-gradient max-w-4xl mx-auto" />

      {/* ================ FOOTER CTA ================ */}
      <section id="join" className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            Ready to enter the arena?
          </h2>
          <p className="text-text-secondary mb-10">
            Pick a name. Join a lobby. Prove you belong.
          </p>

          <Link
            href="/play"
            className="inline-block py-4 px-12 bg-safety-cyan text-bg-primary font-bold text-lg rounded-xl btn-glow cursor-pointer"
          >
            JOIN THE LEAGUE
          </Link>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-8 mt-12 text-text-muted text-sm">
            <Stat value="5" label="Players" />
            <span className="text-border-hover">|</span>
            <Stat value="$10,000" label="Buy-in" />
            <span className="text-border-hover">|</span>
            <Stat value="5:00" label="Per Round" />
            <span className="text-border-hover">|</span>
            <Stat value="80/20" label="Payout" />
          </div>
        </div>
      </section>

      {/* ================ FOOTER ================ */}
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

function StepCard({
  step,
  title,
  description,
  accent,
}: {
  step: string;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-6 card-hover">
      <span
        className={`font-mono-numbers text-4xl font-bold text-${accent} opacity-40 block mb-4`}
      >
        {step}
      </span>
      <h3 className="text-text-primary font-semibold text-lg mb-2">{title}</h3>
      <p className="text-text-secondary text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function PayoutCard({
  icon,
  iconColor,
  title,
  items,
}: {
  icon: string;
  iconColor: string;
  title: string;
  items: string[];
}) {
  return (
    <div className="bg-bg-surface border border-border-default rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className={`${iconColor} text-xl`}>{icon}</span>
        <h3 className="text-text-primary font-semibold">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="text-text-muted mt-0.5 text-xs">&#10003;</span>
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
      <div className="font-mono-numbers text-text-primary font-semibold">
        {value}
      </div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
