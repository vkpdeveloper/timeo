import Image from "next/image";
import Link from "next/link";
import { LANDING_HREF } from "@/components/landing/links";
import "./auth.css";

/** Sign in, sign up and password reset: one calm column over slow season rings. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden pt-safe">
      <Backdrop />
      <header className="auth-fade relative mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-6">
        <Link href={LANDING_HREF} className="tap -ml-1 flex h-11 items-center gap-2.5 pr-2" aria-label="Timeo home">
          <Image src="/icon-192.png" alt="" width={28} height={28} className="rounded-[8px]" priority />
          <span className="display text-[22px] leading-none text-ink">Timeo</span>
        </Link>
      </header>
      <div className="relative mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-6 pt-6 pb-12 sm:pb-20">
        <div className="auth-panel stagger [--stagger:70ms] [--stagger-base:80ms]">{children}</div>
      </div>
      <p className="auth-fade relative pb-[max(20px,var(--safe-bottom))] text-center text-[12px] tracking-wide text-ink-3">
        Goal · Plan · System
      </p>
    </main>
  );
}

/** A soft accent glow and twelve week marks turning very slowly. Decorative. */
function Backdrop() {
  const r = 230;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="auth-glow absolute -top-56 left-1/2 size-[680px] -translate-x-1/2 rounded-full blur-3xl" />
      <div className="auth-rings absolute top-[-96px] left-1/2 size-[480px] -translate-x-1/2 sm:top-[-200px] sm:size-[820px]">
        <svg viewBox="0 0 600 600" className="size-full">
          <circle cx="300" cy="300" r="290" fill="none" stroke="var(--line)" strokeWidth="1" />
          <circle cx="300" cy="300" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="1" />
          <circle cx="300" cy="300" r="170" fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 8" />
          <circle
            className="auth-arc"
            cx="300"
            cy="300"
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            transform="rotate(-90 300 300)"
            pathLength="12"
            strokeDasharray="2 12"
          />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const on = i < 3;
            return (
              <circle
                key={i}
                cx={Math.round((300 + Math.cos(a) * r) * 100) / 100}
                cy={Math.round((300 + Math.sin(a) * r) * 100) / 100}
                r={on ? 5 : 3.5}
                fill={on ? "var(--accent)" : "var(--bg)"}
                stroke={on ? "none" : "var(--line-strong)"}
                strokeWidth="1"
              />
            );
          })}
        </svg>
      </div>
      <div className="absolute inset-x-0 top-[150px] h-[300px] bg-gradient-to-b from-transparent to-bg sm:top-[300px] sm:h-[420px]" />
    </div>
  );
}
