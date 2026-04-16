"use client";

import { motion } from "motion/react";

interface AnimateInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  /** Run animation every time it enters view (default: once) */
  repeat?: boolean;
}

export default function AnimateIn({
  children,
  className = "",
  delay = 0,
  y = 32,
  repeat = false,
}: AnimateInProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      }}
      viewport={{ once: !repeat, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}
