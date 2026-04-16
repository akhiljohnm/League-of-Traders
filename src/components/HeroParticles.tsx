"use client";

import { useState, useEffect } from "react";

interface Particle {
  x: number;
  bottom: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  tx: number;
}

const COLORS = ["#00E5FF", "#00FFA3", "#00E5FF", "#00E5FF", "#00FFA3", "#00E5FF", "#FF3366"];

export default function HeroParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const ps: Particle[] = Array.from({ length: 28 }, (_, i) => ({
      x: (i * 37.3 + 5) % 100,
      bottom: ((i * 19.7) % 35) + 2,
      size: ((i * 1.3) % 2.5) + 0.6,
      color: COLORS[i % COLORS.length],
      delay: (i * 0.73) % 13,
      duration: ((i * 1.17) % 10) + 13,
      tx: ((i % 7) - 3) * 22,
    }));
    setParticles(ps);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${p.x}%`,
            bottom: `${p.bottom}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--tx": `${p.tx}px`,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}80`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
