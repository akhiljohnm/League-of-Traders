"use client";

import { useState } from "react";

interface UsernameFormProps {
  onSubmit: (username: string) => void;
  isLoading: boolean;
  error: string | null;
}

/* Small decorative corner bracket */
function Corner({ className }: { className: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <path
        d="M0 12V0h12"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.35"
      />
    </svg>
  );
}

export default function UsernameForm({
  onSubmit,
  isLoading,
  error,
}: UsernameFormProps) {
  const [username, setUsername] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length >= 2 && trimmed.length <= 20) {
      onSubmit(trimmed);
    }
  };

  const isValid = username.trim().length >= 2 && username.trim().length <= 20;

  return (
    <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center w-full">
      <div className="w-full max-w-md relative">
        {/* Background grid + radial glow behind card */}
        <div className="absolute -inset-12 hero-grid opacity-40 rounded-3xl pointer-events-none" />
        <div className="absolute -inset-12 hero-radial opacity-60 rounded-3xl pointer-events-none" />

        {/* Main card */}
        <div className="relative bg-bg-surface border border-border-default rounded-2xl overflow-hidden">
          {/* Top neon accent line */}
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-safety-cyan to-transparent opacity-60" />

          {/* Scanline overlay */}
          <div className="absolute inset-0 scanlines pointer-events-none opacity-40" />

          {/* Corner brackets */}
          <Corner className="absolute top-3 left-3 text-safety-cyan" />
          <Corner className="absolute top-3 right-3 text-safety-cyan rotate-90" />
          <Corner className="absolute bottom-3 left-3 text-safety-cyan -rotate-90" />
          <Corner className="absolute bottom-3 right-3 text-safety-cyan rotate-180" />

          <div className="relative p-8 pt-7">
            {/* Header */}
            <div className="text-center mb-8">
              {/* Status badge */}
              <div className="inline-flex items-center gap-2 bg-bg-elevated/80 border border-border-default rounded-full px-4 py-1.5 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-safety-cyan animate-live-pulse" />
                <span className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-mono-numbers">
                  Enter the Arena
                </span>
              </div>

              <h2 className="text-2xl font-bold text-gradient-cyan mb-2">
                Choose Your Callsign
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed">
                Pick a name. Get{" "}
                <span className="font-mono-numbers text-alpha-green font-semibold">
                  $10,000
                </span>{" "}
                Game Tokens. Join the fight.
              </p>
            </div>

            {/* Terminal-style label */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono-numbers text-[10px] text-safety-cyan/50 uppercase tracking-widest">
                sys://callsign
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-border-default to-transparent" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <div
                  className={`relative rounded-xl transition-shadow duration-300 ${
                    isFocused
                      ? "shadow-[0_0_20px_rgba(0,229,255,0.1)]"
                      : ""
                  }`}
                >
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="enter_callsign..."
                    maxLength={20}
                    autoFocus
                    disabled={isLoading}
                    className="w-full bg-bg-primary border border-border-default rounded-xl px-4 py-3.5
                               text-text-primary font-mono-numbers text-lg placeholder:text-text-muted/50
                               focus:outline-none focus:border-safety-cyan/60 focus:ring-1 focus:ring-safety-cyan/20
                               disabled:opacity-50 transition-all"
                  />
                  {/* Blinking cursor indicator when empty & focused */}
                  {isFocused && username.length === 0 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-safety-cyan animate-pulse" />
                  )}
                </div>

                <div className="flex items-center justify-between mt-2.5 px-1">
                  <span className="text-text-muted text-xs font-mono-numbers">
                    2-20 chars &middot; lowercase
                  </span>
                  <span
                    className={`font-mono-numbers text-xs tabular-nums transition-colors ${
                      username.trim().length > 0
                        ? isValid
                          ? "text-alpha-green"
                          : "text-rekt-crimson"
                        : "text-text-muted"
                    }`}
                  >
                    [{username.trim().length.toString().padStart(2, "0")}/20]
                  </span>
                </div>
              </div>

              {error && (
                <div className="bg-rekt-crimson/10 border border-rekt-crimson/30 rounded-lg px-4 py-3 flex items-start gap-2">
                  <span className="text-rekt-crimson text-sm mt-px shrink-0">!</span>
                  <p className="text-rekt-crimson text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!isValid || isLoading}
                className="w-full py-3.5 bg-safety-cyan text-bg-primary font-bold text-base rounded-xl
                           btn-glow cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed
                           disabled:shadow-none transition-all uppercase tracking-wider"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  "Enter the Lobby"
                )}
              </button>
            </form>

            {/* Bottom decorative detail */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-border-hover" />
              <span className="font-mono-numbers text-[9px] text-text-muted/50 uppercase tracking-[0.3em]">
                League of Traders
              </span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-border-hover" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
