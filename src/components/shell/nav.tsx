"use client";

import { CalendarDays, Dumbbell, LineChart, Sparkles, Sun, Target, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { QuickAdd } from "./quick-add";

type Tab = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean };

const TABS: Tab[] = [
  { href: "/", label: "Today", icon: Sun, match: (p) => p === "/" },
  { href: "/plan", label: "Plan", icon: CalendarDays, match: (p) => p.startsWith("/plan") },
  { href: "/goals", label: "Goals", icon: Target, match: (p) => p.startsWith("/goals") },
  { href: "/fitness", label: "Fitness", icon: Dumbbell, match: (p) => p.startsWith("/fitness") },
  { href: "/review", label: "Review", icon: LineChart, match: (p) => p.startsWith("/review") },
];

// Screens that take over the whole display
const IMMERSIVE = [/^\/fitness\/workout\//, /^\/goals\/setup/, /^\/review\/week/];

export function TabBar() {
  const pathname = usePathname();
  if (IMMERSIVE.some((r) => r.test(pathname))) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end gap-2.5 px-3 pb-[max(10px,var(--safe-bottom))] lg:hidden">
      <nav
        aria-label="Main"
        className="glass pointer-events-auto flex h-[var(--tabbar-h)] flex-1 items-stretch rounded-[26px] border border-line px-1.5 shadow-float"
      >
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="tap relative flex flex-1 flex-col items-center justify-center gap-[3px]"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-x-0.5 inset-y-1.5 rounded-[20px] bg-sunken"
                  transition={{ type: "spring", damping: 32, stiffness: 420 }}
                />
              )}
              <Icon
                className={cn("relative size-[21px] transition-colors", active ? "text-ink" : "text-ink-3")}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                className={cn(
                  "relative text-[10px] font-semibold tracking-tight transition-colors",
                  active ? "text-ink" : "text-ink-3",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="pointer-events-auto">
        <QuickAdd />
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-4 py-8 lg:flex">
      <Link href="/" className="mb-10 flex items-center gap-2.5 px-2">
        <Image src="/icon-192.png" alt="" width={30} height={30} className="rounded-[9px]" />
        <span className="display text-[26px] text-ink">Timeo</span>
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "tap flex h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium",
                active ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:bg-sunken",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2">
        <Link
          href="/assistant"
          className={cn(
            "tap flex h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium",
            pathname.startsWith("/assistant") ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:bg-sunken",
          )}
        >
          <Sparkles className="size-[18px] text-accent" />
          Ask Timeo
        </Link>
        <QuickAdd variant="wide" />
      </div>
    </aside>
  );
}
