"use client";

import { useState } from "react";

interface UsernameFormProps {
  onSubmit: (username: string) => void;
  isLoading: boolean;
  error: string | null;
}

export default function UsernameForm({
  onSubmit,
  isLoading,
  error,
}: UsernameFormProps) {
  const [username, setUsername] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length >= 2 && trimmed.length <= 20) {
      onSubmit(trimmed);
    }
  };

  const isValid = username.trim().length >= 2 && username.trim().length <= 20;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-bg-surface border border-border-default rounded-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-bg-elevated border border-border-default rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-safety-cyan animate-live-pulse" />
            <span className="text-xs text-text-muted uppercase tracking-widest font-mono-numbers">
              Enter the Arena
            </span>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Choose Your Callsign
          </h2>
          <p className="text-text-secondary text-sm">
            Pick a name. Get <span className="font-mono-numbers text-alpha-green">$10,000</span> Game Tokens. Join the fight.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="Enter username..."
              maxLength={20}
              autoFocus
              disabled={isLoading}
              className="w-full bg-bg-primary border border-border-default rounded-xl px-4 py-3.5
                         text-text-primary font-mono-numbers text-lg placeholder:text-text-muted
                         focus:outline-none focus:border-safety-cyan focus:ring-1 focus:ring-safety-cyan/30
                         disabled:opacity-50 transition-colors"
            />
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-text-muted text-xs">
                2-20 characters, lowercase
              </span>
              <span className={`font-mono-numbers text-xs ${
                username.trim().length > 0
                  ? isValid ? "text-alpha-green" : "text-rekt-crimson"
                  : "text-text-muted"
              }`}>
                {username.trim().length}/20
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-rekt-crimson/10 border border-rekt-crimson/30 rounded-lg px-4 py-3">
              <p className="text-rekt-crimson text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || isLoading}
            className="w-full py-3.5 bg-safety-cyan text-bg-primary font-bold text-base rounded-xl
                       btn-glow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                       disabled:shadow-none transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connecting...
              </span>
            ) : (
              "ENTER THE LOBBY"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
