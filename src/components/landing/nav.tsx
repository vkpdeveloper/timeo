"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Wordmark } from "./wordmark";

/** Fixed top bar: clear over the hero, solid with a hairline once the page scrolls. */
export function LandingNav({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b pt-safe transition-colors duration-200",
        scrolled ? "border-line bg-bg" : "border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Wordmark />
        {children}
      </nav>
    </header>
  );
}
