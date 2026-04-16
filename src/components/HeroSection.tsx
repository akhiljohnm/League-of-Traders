"use client";

import { motion, useScroll, useTransform } from "motion/react";
import LiveTicker from "./LiveTicker";
import HeroParticles from "./HeroParticles";
import BackgroundChart from "./BackgroundChart";

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 36 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

export default function HeroSection() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -70]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0]);
  const scrollIndicatorOpacity = useTransform(
    scrollYProgress,
    [0, 0.07],
    [1, 0]
  );

  return (
    <section
      id="home"
      className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden scanlines"
    >
      {/* Animated grid */}
      <div className="absolute inset-0 hero-grid" />

      {/* Animated candlestick chart */}
      <BackgroundChart />

      {/* Radial overlay — sits on top of chart to dim edges */}
      <div className="absolute inset-0 hero-radial" />

      {/* Floating particles */}
      <HeroParticles />

      {/* Content — parallax on scroll out */}
      <motion.div
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative z-10 text-center max-w-3xl mx-auto"
      >
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
        >
          {/* Live badge */}
          <motion.div
            variants={item}
            className="inline-flex items-center gap-2.5 bg-bg-surface/80 border border-border-hover rounded-full px-4 py-1.5 mb-10 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-alpha-green opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-alpha-green" />
            </span>
            <span className="text-xs text-text-muted uppercase tracking-widest font-mono-numbers">
              Markets Live
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            variants={item}
            className="font-display text-6xl sm:text-8xl font-bold tracking-wide text-text-primary mb-4 leading-none"
          >
            LEAGUE OF
            <br />
            <span
              className="text-gradient-cyan glitch-text"
              data-text="TRADERS"
            >
              TRADERS
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={item}
            className="text-base sm:text-lg text-text-secondary max-w-md mx-auto mb-3 leading-relaxed"
          >
            5 players. 5 minutes. Live markets.
          </motion.p>
          <motion.p
            variants={item}
            className="text-sm text-text-muted max-w-md mx-auto mb-10"
          >
            <span className="text-text-primary font-medium">
              Turn trading into a team sport.
            </span>{" "}
            No account. No real money. Pure competition.
          </motion.p>

          {/* Live Ticker */}
          <motion.div variants={item} className="mb-10">
            <LiveTicker />
          </motion.div>

          {/* CTA */}
          <motion.div variants={item}>
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="inline-block"
            >
              <a
                href="/play"
                className="inline-block py-4 px-12 bg-safety-cyan text-bg-primary font-bold text-base tracking-widest rounded-xl btn-glow cursor-pointer font-display uppercase"
              >
                Join the League
              </a>
            </motion.div>
          </motion.div>

          {/* Sub-copy */}
          <motion.p
            variants={item}
            className="text-text-muted text-xs mt-6 font-mono-numbers tracking-wider uppercase"
          >
            // pick a name · join a lobby · play
          </motion.p>
        </motion.div>
      </motion.div>

      {/* Scroll indicator — fades out on first scroll */}
      <motion.div
        style={{ opacity: scrollIndicatorOpacity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted pointer-events-none"
      >
        <span className="text-[10px] uppercase tracking-widest font-mono-numbers">
          Scroll
        </span>
        <svg
          width="14"
          height="22"
          viewBox="0 0 16 24"
          fill="none"
          className="animate-bounce opacity-60"
        >
          <path
            d="M8 4v12m0 0l-4-4m4 4l4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </section>
  );
}
