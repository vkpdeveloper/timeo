"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { cn } from "@/lib/cn";
import { ease } from "./motion";
import { LANDING_HREF } from "./links";

/** Sticky glass bar. The hairline appears once the page scrolls. */
export function LandingNav({ children }: { children: React.ReactNode }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 8));

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease }}
      className={cn(
        "glass sticky top-0 z-50 border-b pt-safe transition-colors duration-300",
        scrolled ? "border-line" : "border-transparent",
      )}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link href={LANDING_HREF} className="tap flex h-11 items-center gap-2.5 pr-2" aria-label="Timeo home">
          <Image src="/icon-192.png" alt="" width={28} height={28} className="rounded-[8px]" loading="eager" />
          <span className="display text-[22px] leading-none">Timeo</span>
        </Link>
        <div className="flex items-center gap-1">
          <div className="mr-4 hidden items-center gap-6 text-[14px] text-ink-2 md:flex">
            <a href="#how" className="hover:text-ink">
              How it works
            </a>
            <a href="#tour" className="hover:text-ink">
              Tour
            </a>
            <a href="#timi" className="hover:text-ink">
              Timi
            </a>
          </div>
          {children}
        </div>
      </nav>
    </motion.header>
  );
}
