"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface NavItem {
  label: string;
  href: string;
  isRoute?: boolean;
  external?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "#home" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "80/20 Engine", href: "#engine" },
  { label: "Bots", href: "#bots" },
  { label: "Vibe-Coding", href: "/vibe-coding", isRoute: true },
  { label: "Keynote", href: "/assests/League_of_Traders_Keynote.pdf", external: true },
];

const SECTION_IDS = NAV_ITEMS.filter((item) => !item.isRoute).map((item) =>
  item.href.slice(1)
);

export default function Navbar() {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isHomePage = pathname === "/";

  // Track which section is in view (only on homepage)
  useEffect(() => {
    if (!isHomePage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [isHomePage]);

  // Track scroll for background opacity
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth" });
      setMobileOpen(false);
    },
    []
  );

  function isActive(item: NavItem) {
    if (item.isRoute) return pathname === item.href;
    return isHomePage && activeSection === item.href.slice(1);
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || !isHomePage
          ? "nav-glass border-b border-border-default"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="relative w-7 h-7 rounded-md bg-safety-cyan/10 border border-safety-cyan/30 flex items-center justify-center group-hover:bg-safety-cyan/20 transition-colors duration-200">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <polyline points="1,12 5,7 9,9 15,3" stroke="#00E5FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="11,3 15,3 15,7" stroke="#00E5FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-display font-bold text-base tracking-widest text-safety-cyan">
            League of Traders
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
              >
                {item.label}
              </a>
            ) : item.isRoute ? (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 ${
                  isActive(item)
                    ? "text-safety-cyan bg-safety-cyan/10"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
                }`}
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.href}
                href={isHomePage ? item.href : `/${item.href}`}
                onClick={
                  isHomePage
                    ? (e) => handleAnchorClick(e, item.href)
                    : undefined
                }
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors duration-200 ${
                  isActive(item)
                    ? "text-safety-cyan bg-safety-cyan/10"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
                }`}
              >
                {item.label}
              </a>
            )
          )}
        </div>

        {/* Desktop CTA */}
        <a
          href="/play"
          className="hidden md:inline-block py-2 px-5 bg-safety-cyan text-bg-primary text-sm font-bold rounded-lg hover:brightness-110 active:scale-[0.98] transition-all duration-150 cursor-pointer font-display tracking-widest uppercase"
        >
          Join the League
        </a>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            {mobileOpen ? (
              <path
                d="M6 6l12 12M6 18L18 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 8h16M4 16h16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden nav-glass border-t border-border-default">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-1">
            {NAV_ITEMS.map((item) =>
              item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
                >
                  {item.label}
                </a>
              ) : item.isRoute ? (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 ${
                    isActive(item)
                      ? "text-safety-cyan bg-safety-cyan/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={isHomePage ? item.href : `/${item.href}`}
                  onClick={
                    isHomePage
                      ? (e) => handleAnchorClick(e, item.href)
                      : () => setMobileOpen(false)
                  }
                  className={`px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 ${
                    isActive(item)
                      ? "text-safety-cyan bg-safety-cyan/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
                  }`}
                >
                  {item.label}
                </a>
              )
            )}
            <a
              href="/play"
              className="mt-2 py-2.5 px-5 bg-safety-cyan text-bg-primary text-sm font-bold rounded-lg text-center"
            >
              Join the League
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
