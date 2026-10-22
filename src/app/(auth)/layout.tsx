import Link from "next/link";
import { Suspense } from "react";
import { LogoMark } from "@/components/ui/primitives";
import { AuthTopLink } from "./auth-form";
import { NowPill, PanelClock } from "./panel";
import "./auth.css";

/**
 * Sign in, sign up and password reset. Mobile: one full-screen form.
 * Desktop: the form on the left, an ember panel on the right with the block
 * you would be on right now.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="auth-theme flex min-h-dvh bg-bg text-ink">
      <section className="flex min-h-dvh w-full flex-col px-6 pt-safe pb-[max(16px,var(--safe-bottom))] sm:px-10 lg:w-[42%] lg:max-w-[620px] lg:shrink-0 lg:px-14">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col lg:mx-0 lg:max-w-none">
          <header className="auth-fade flex h-16 items-center justify-between gap-4 lg:h-24">
            <Link href="/" aria-label="Timeo home" className="tap -ml-1 flex h-11 items-center gap-2.5 rounded-[12px] px-1">
              <LogoMark size={24} />
              <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Timeo</span>
            </Link>
            {/* The reset link's path holds a token, so its pathname is only known per request */}
            <Suspense>
              <AuthTopLink />
            </Suspense>
          </header>

          <div className="flex flex-1 flex-col pt-[6vh] pb-10 lg:justify-center lg:pt-0 lg:pb-16">
            <div className="auth-panel flex w-full flex-1 flex-col lg:max-w-[360px] lg:flex-none">{children}</div>
          </div>

          <footer className="auth-fade flex h-11 items-center text-[13px] text-ink-3">
            © <Year /> Timeo
          </footer>
        </div>
      </section>

      <aside className="hidden flex-1 p-3 pl-0 lg:flex" aria-label="A look at Timeo">
        <div className="auth-showcase @container flex flex-1 flex-col overflow-hidden rounded-[24px] bg-[var(--ember)] p-12 text-[var(--ember-ink)] xl:p-14">
          <div aria-hidden className="mono flex items-center justify-between text-[12.5px] opacity-75">
            <span>timeo</span>
            <PanelClock />
          </div>

          <p className="mt-auto font-display text-[length:clamp(64px,20cqw,200px)] leading-[0.93] font-extrabold tracking-[-0.035em]">
            <span className="auth-line">One thing</span>
            <span className="auth-line" style={{ "--d": "320ms" } as React.CSSProperties}>
              at a time.
            </span>
          </p>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
            <NowPill />
            <p className="max-w-[250px] text-[14.5px] leading-[1.45] text-pretty opacity-85">
              Timeo turns your goals into time on the calendar, then shows you what to do right now.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}

async function Year() {
  "use cache";
  return new Date().getFullYear();
}
