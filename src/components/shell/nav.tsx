"use client";

import { Activity, CalendarDays, Clock, Settings2, Target, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { springs } from "@/components/ui/motion";
import { LogoMark } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { AskButton } from "./ask";

type Tab = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean };

export const TABS: Tab[] = [
  { href: "/app", label: "Now", icon: Clock, match: (p) => p === "/app" },
  { href: "/app/plan", label: "Week", icon: CalendarDays, match: (p) => p.startsWith("/app/plan") },
  {
    href: "/app/goals",
    label: "Season",
    icon: Target,
    match: (p) => p.startsWith("/app/goals") || p.startsWith("/app/review"),
  },
  { href: "/app/fitness", label: "Body", icon: Activity, match: (p) => p.startsWith("/app/fitness") },
];

// Screens that take over the whole display
const IMMERSIVE = [/^\/app\/fitness\/workout\//, /^\/app\/goals\/setup/, /^\/app\/review\/week/];

function TabIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <motion.span className="grid place-items-center" whileTap={{ scale: 0.88 }} transition={springs.snappy}>
      <Icon className={cn("size-[22px] transition-colors duration-200", active ? "text-ink" : "text-ink-3")} strokeWidth={active ? 2 : 1.7} />
    </motion.span>
  );
}

/** Mobile: a solid bar with Now, Week, Season, Body and the Ask circle at the right end. */
export function TabBar() {
  const pathname = usePathname();
  if (IMMERSIVE.some((r) => r.test(pathname))) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface pb-[var(--safe-bottom)] lg:hidden">
      <nav aria-label="Main" className="mx-auto flex h-[var(--tabbar-h)] max-w-[640px] items-stretch px-2">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 select-none"
            >
              <TabIcon icon={tab.icon} active={active} />
              <span
                className={cn(
                  "text-[11px] leading-none font-medium transition-colors duration-200",
                  active ? "text-ink" : "text-ink-3",
                )}
              >
                {tab.label}
              </span>
              {active && (
                <motion.span
                  layoutId="tab-mark"
                  className="absolute top-0 h-[2px] w-6 rounded-full bg-ink"
                  transition={springs.smooth}
                />
              )}
            </Link>
          );
        })}
        <div className="flex flex-1 items-center justify-center">
          <AskButton />
        </div>
      </nav>
    </div>
  );
}

function RailLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tap relative flex h-14 flex-col items-center justify-center gap-1 rounded-[12px] text-[11px] font-medium transition-colors",
        active ? "text-ink" : "text-ink-3 hover:bg-sunken hover:text-ink-2",
      )}
    >
      {active && <motion.span layoutId="rail-pill" className="absolute inset-0 rounded-[12px] bg-sunken" transition={springs.smooth} />}
      <Icon className="relative size-5" strokeWidth={active ? 2 : 1.7} />
      <span className="relative leading-none">{label}</span>
    </Link>
  );
}

/** Desktop: a narrow left rail with the same four, Ask and Settings. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[84px] shrink-0 flex-col border-r border-line bg-surface px-2.5 py-5 lg:flex">
      <Link href="/app" aria-label="Timeo" className="mx-auto mb-6 grid size-10 place-items-center">
        <LogoMark size={28} />
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {TABS.map((tab) => (
          <RailLink key={tab.href} href={tab.href} label={tab.label} icon={tab.icon} active={tab.match(pathname)} />
        ))}
      </nav>
      <div className="mt-4">
        <AskButton variant="rail" />
      </div>
      <div className="mt-auto">
        <RailLink href="/app/settings" label="Settings" icon={Settings2} active={pathname.startsWith("/app/settings")} />
      </div>
    </aside>
  );
}
