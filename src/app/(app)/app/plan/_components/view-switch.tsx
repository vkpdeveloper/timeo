"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/components/ui/motion";
import { useState, type ReactNode } from "react";

/**
 * Swaps the day / week content with a short slide: forward in time slides in
 * from the right, back in time from the left, a view change just fades.
 */
export function ViewSwitch({ id, order, children }: { id: string; order: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const [prev, setPrev] = useState({ id, order });
  // null until the first switch: the first paint (SSR) shows at rest
  const [dir, setDir] = useState<number | null>(null);
  if (prev.id !== id) {
    setPrev({ id, order });
    setDir(order === prev.order ? 0 : order > prev.order ? 1 : -1);
  }
  return (
    <motion.div
      key={id}
      initial={reduce || dir == null ? false : { opacity: 0, x: dir * 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
