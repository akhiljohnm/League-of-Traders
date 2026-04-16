"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

export default function PayoutBar() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div ref={ref} className="bg-bg-surface border border-border-default rounded-xl p-6">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-mono-numbers text-alpha-green uppercase tracking-wider">
          Alpha Winners Keep
        </span>
        <span className="text-xs font-mono-numbers text-rekt-crimson uppercase tracking-wider">
          Safety Net Fund
        </span>
      </div>

      {/* Bar */}
      <div className="h-4 bg-bg-elevated rounded-full overflow-hidden flex gap-0.5">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{
            duration: 1.4,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.15,
          }}
          style={{
            transformOrigin: "left center",
            width: "80%",
            background: "linear-gradient(90deg, #00FFA3, #00E5FF)",
            height: "100%",
            borderRadius: "9999px 0 0 9999px",
          }}
        />
        <motion.div
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{
            duration: 1.0,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.45,
          }}
          style={{
            transformOrigin: "left center",
            width: "20%",
            background: "linear-gradient(90deg, #FF3366, #FF6688)",
            height: "100%",
            borderRadius: "0 9999px 9999px 0",
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-2.5">
        <motion.span
          className="font-mono-numbers text-sm font-bold text-alpha-green"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.8 }}
        >
          80%
        </motion.span>
        <motion.span
          className="font-mono-numbers text-sm font-bold text-rekt-crimson"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 1.0 }}
        >
          20%
        </motion.span>
      </div>
    </div>
  );
}
