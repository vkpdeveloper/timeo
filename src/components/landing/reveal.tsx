"use client";

import { motion, MotionConfig } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

/** Transforms switch off for people who prefer reduced motion; fades stay. */
export function LandingMotion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fade and a short rise when scrolled into view, once. */
export function Reveal({
  delay = 0,
  className,
  children,
  as = "div",
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
  as?: "div" | "li";
}) {
  const Tag = as === "li" ? motion.li : motion.div;
  return (
    <Tag
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.6, ease, delay }}
      className={className}
    >
      {children}
    </Tag>
  );
}
