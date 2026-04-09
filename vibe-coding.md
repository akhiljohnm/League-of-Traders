# Vibe-Coding Documentation: League of Traders

A comprehensive log of AI-assisted development for the Deriv API Grand Prix 2026.

---

## Phase 1: Project Scaffolding & Setup

### Entry 1: Manual Next.js Initialization in Existing Repo

* **Prompt/Problem:** We needed to initialize a Next.js project inside an existing git repo named "League of Traders." Running `create-next-app .` failed because the directory name contains spaces and capital letters, which violates npm naming restrictions.
* **AI Architecture/Solution:** Instead of fighting the CLI tool, we bypassed `create-next-app` entirely and manually scaffolded the project — `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` — giving us full control over every config value. This was actually faster than running the CLI and deleting the boilerplate it generates.
* **Technical Execution:** Created `package.json` with name `league-of-traders`, installed `next@latest`, `react@latest`, `tailwindcss@4`, `@supabase/supabase-js`, and all TypeScript tooling via `npm install`. Configured Tailwind v4 via `@tailwindcss/postcss` plugin. First `next build` passed with zero errors.

### Entry 2: Cyber-Terminal Dark Theme System

* **Prompt/Problem:** The design spec calls for an "elite, high-frequency e-sports trading terminal" aesthetic with strict dark mode, specific brand colors, and monospace fonts for all numerical data.
* **AI Architecture/Solution:** Built a comprehensive CSS theme layer using Tailwind v4's `@theme` directive to define semantic color tokens (`bg-primary`, `alpha-green`, `rekt-crimson`, `safety-cyan`) and font variables. Added utility classes for glow effects (`glow-green`, `glow-red`, `glow-cyan`) and a live-pulse animation for real-time data indicators. Used Google Fonts (`Inter` + `JetBrains Mono`) loaded via `next/font/google` for zero layout shift.
* **Technical Execution:** `globals.css` defines the full theme via `@theme {}` block. `layout.tsx` loads both font families as CSS variables. Landing page uses the theme tokens directly in Tailwind classes (`bg-bg-primary`, `text-safety-cyan`, `font-mono-numbers`). The `.font-mono-numbers` class applies `font-variant-numeric: tabular-nums` to prevent price/timer jitter.

---

## Phase 2: The Database Ledger (Supabase Schema)

### Entry 3: Supabase Schema Design & Migration

* **Prompt/Problem:** We needed to design a complete database schema to support multiplayer lobbies, player balances, paper trades, and bot mechanics — all with real-time capabilities for the live game UI.
* **AI Architecture/Solution:** Designed a 4-table relational schema: `players` (humans + bots with a `bot_strategy` field), `lobbies` (with an enum status lifecycle: waiting → locked → in_progress → completed), `lobby_players` (join table with `hired_by` to track which human hired which bot, plus `final_balance` for post-game payouts), and `trades` (with enum direction UP/DOWN and status open/won/lost). Enabled RLS with open policies (no Deriv OAuth, anon key only). Added Supabase Realtime publication on `lobbies`, `lobby_players`, and `trades` for live multiplayer sync.
* **Technical Execution:** SQL migration at `supabase/migrations/001_initial_schema.sql`. Pushed via `supabase db push`. TypeScript types at `src/lib/types/database.ts` with row types, insert types, and joined types for UI queries.

### Entry 4: uuid_generate_v4() Bug on Supabase

* **Prompt/Problem:** First `supabase db push` failed with `ERROR: function uuid_generate_v4() does not exist (SQLSTATE 42883)` even though `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` ran without error. The extension existed but its functions weren't accessible in the `public` schema.
* **AI Architecture/Solution:** Supabase installs `uuid-ossp` in the `extensions` schema by default, not `public`. Rather than adding schema qualifiers or search_path hacks, we switched all UUID defaults to PostgreSQL's built-in `gen_random_uuid()` (available since Postgres 13, which Supabase uses). This is actually the modern best practice — no extension dependency at all.
* **Technical Execution:** Replaced all `uuid_generate_v4()` calls with `gen_random_uuid()` in the migration SQL, removed the `CREATE EXTENSION` line. Re-ran `supabase db push` — all 4 tables created successfully. Verified via Supabase JS client: `players: OK`, `lobbies: OK`, `lobby_players: OK`, `trades: OK`.

---

## Landing Page: Full Marketing Website

### Entry 5: Multi-Section Landing Page with Cyber-Terminal Aesthetic

* **Prompt/Problem:** The initial `page.tsx` was a simple centered card. We needed a proper marketing website that explains the League of Traders concept to first-time visitors — the gameplay loop, the 80/20 payout engine, and the AI Mercenary Bots — with a prominent "Join the League" CTA.
* **AI Architecture/Solution:** Designed a 5-section scroll-through landing page: (1) Hero with animated grid background, gradient text, and glowing CTA, (2) "How It Works" 3-step card flow, (3) The 80/20 Engine payout breakdown with Alpha vs Rescued cards, (4) Mercenary Bots showcase with risk-level tags, (5) Footer CTA with game stats. Built entirely with Tailwind utility classes + custom CSS animations — zero JavaScript state, zero dependencies added. Every section uses the existing Cyber-Terminal theme tokens.
* **Technical Execution:** Extended `globals.css` with hero grid background (`hero-grid`, `hero-radial`), glowing button effect (`btn-glow` with box-shadow), fade-up entrance animation (`animate-fade-up` with stagger delays), gradient text (`text-gradient-cyan`), and card hover lift (`card-hover`). Rewrote `page.tsx` with 5 component functions (`StepCard`, `PayoutCard`, `BotCard`, `Stat`) — all typed with TypeScript interfaces. Production build passes clean.

### Entry 6: Sticky Navbar with Scroll-Tracking + Vibe-Coding Showcase Section

* **Prompt/Problem:** The landing page needed a navigation system — a sticky top nav with tabs highlighting the different sections, including a dedicated Vibe-Coding section to showcase the AI-assisted development log for the judges.
* **AI Architecture/Solution:** Built a `Navbar` client component with glassmorphism effect (`backdrop-blur + rgba background`), `IntersectionObserver`-based active section tracking, and a mobile hamburger menu. Added `id` attributes to every section (`#home`, `#how-it-works`, `#engine`, `#bots`, `#vibe-coding`, `#join`). Created a Vibe-Coding section with a vertical timeline layout — each entry shows Phase badge, Problem (red), Solution (green), and Tech (cyan) in a card format with connector dots and gradient lines. The section links back to the full `vibe-coding.md` file.
* **Technical Execution:** `src/components/Navbar.tsx` — client component with `useEffect` for `IntersectionObserver` (rootMargin `-40% 0px -55% 0px` for center-of-viewport detection) and scroll-based background opacity. CSS additions: `.nav-glass` for glassmorphism, `scroll-padding-top: 5rem` for fixed nav offset, `.timeline-line` for vertical connector. `VibeEntry` component renders the timeline cards. All smooth-scroll handled via CSS `scroll-behavior: smooth` + JS `scrollIntoView`.

### Entry 7: Vibe-Coding Extracted to Dedicated Route

* **Prompt/Problem:** The Vibe-Coding timeline section was cluttering the homepage. User wanted it as its own page to keep the landing page focused on selling the concept.
* **AI Architecture/Solution:** Moved the Vibe-Coding content to a new Next.js route at `/vibe-coding`. Updated the `Navbar` to support hybrid navigation — anchor scroll links for homepage sections (`#home`, `#how-it-works`, etc.) and a Next.js `Link` for the Vibe-Coding route. Added `usePathname()` to detect which page we're on so the Navbar knows when to use `IntersectionObserver` (homepage only) vs route-based active state (`/vibe-coding` page). The Vibe-Coding page got its own `metadata`, breadcrumb, stats bar, numbered timeline entries, and a footer CTA back to home.
* **Technical Execution:** `src/app/vibe-coding/page.tsx` — new route with `ENTRIES` data array, `VibeEntry` component with numbered timeline dots. Navbar updated with `NavItem` interface adding `isRoute` flag. Homepage sections now use `/#section` hrefs when navigating from other pages. Build output confirms both routes: `○ /` and `○ /vibe-coding`.

