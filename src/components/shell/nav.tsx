"use client";

import { CalendarDays, Dumbbell, LineChart, Settings2, Sun, Target, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { springs } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { QuickAdd } from "./quick-add";

type Tab = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean };

const TABS: Tab[] = [
  { href: "/app", label: "Today", icon: Sun, match: (p) => p === "/app" },
  { href: "/app/plan", label: "Plan", icon: CalendarDays, match: (p) => p.startsWith("/app/plan") },
  { href: "/app/goals", label: "Goals", icon: Target, match: (p) => p.startsWith("/app/goals") },
  { href: "/app/fitness", label: "Fitness", icon: Dumbbell, match: (p) => p.startsWith("/app/fitness") },
  { href: "/app/review", label: "Review", icon: LineChart, match: (p) => p.startsWith("/app/review") },
];

// Screens that take over the whole display
const IMMERSIVE = [/^\/app\/fitness\/workout\//, /^\/app\/goals\/setup/, /^\/app\/review\/week/];

function TabIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <motion.span
      className="relative grid place-items-center"
      initial={false}
      animate={active ? { y: -0.5, scale: 1.06 } : { y: 0, scale: 1 }}
      whileTap={{ scale: 0.86 }}
      transition={springs.snappy}
    >
      <Icon
        className={cn("size-5 transition-colors duration-200", active ? "text-ink" : "text-ink-3")}
        strokeWidth={active ? 2.2 : 1.8}
      />
    </motion.span>
  );
}

export function TabBar() {
  const pathname = usePathname();
  if (IMMERSIVE.some((r) => r.test(pathname))) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end gap-2 px-3 pb-[max(8px,var(--safe-bottom))] lg:hidden">
      <nav
        aria-label="Main"
        className="glass pointer-events-auto flex h-[var(--tabbar-h)] flex-1 items-stretch rounded-[22px] border border-line px-1 shadow-float"
      >
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-[3px] select-none"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-x-0.5 inset-y-1 rounded-[17px] bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]"
                  transition={springs.smooth}
                />
              )}
              <TabIcon icon={tab.icon} active={active} />
              <span
                className={cn(
                  "relative text-[10px] leading-none font-semibold tracking-tight transition-colors duration-200",
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

function SideLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tap relative flex h-10 items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium transition-colors",
        active ? "text-ink" : "text-ink-2 hover:bg-sunken hover:text-ink",
      )}
    >
      {active && (
        <motion.span
          layoutId="side-pill"
          className="absolute inset-0 rounded-[12px] border border-line bg-surface shadow-soft"
          transition={springs.smooth}
        />
      )}
      <Icon className="relative size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
      <span className="relative">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line px-3 py-6 lg:flex">
      <Link href="/app" className="mb-7 flex items-center gap-2.5 px-3">
        <Image src="/icon-192.png" alt="" width={26} height={26} className="rounded-[8px]" />
        <span className="display text-[23px] text-ink">Timeo</span>
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {TABS.map((tab) => (
          <SideLink key={tab.href} href={tab.href} label={tab.label} icon={tab.icon} active={tab.match(pathname)} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        <SideLink href="/app/settings" label="Settings" icon={Settings2} active={pathname.startsWith("/app/settings")} />
        <QuickAdd variant="wide" />
      </div>
    </aside>
  );
}
