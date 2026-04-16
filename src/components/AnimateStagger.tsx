"use client";

import { motion } from "motion/react";

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.13,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.65,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

interface Props {
  children: React.ReactNode;
  className?: string;
}

/** Wraps a grid of cards — children animate in with stagger on scroll */
export function StaggerGrid({ children, className = "" }: Props) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}

/** Each card inside a StaggerGrid */
export function StaggerItem({ children, className = "" }: Props) {
  return (
    <motion.div
      className={className}
      variants={itemVariants}
      whileHover={{
        y: -6,
        transition: { type: "spring", stiffness: 350, damping: 22 },
      }}
    >
      {children}
    </motion.div>
  );
}
