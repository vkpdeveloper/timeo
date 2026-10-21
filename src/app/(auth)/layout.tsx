import Link from "next/link";
import { LogoMark } from "@/components/ui/primitives";
import { ObjectsLook } from "./objects";
import "./auth.css";

/**
 * Sign in, sign up and password reset. Mobile: one full-screen form.
 * Desktop: the form on the left, floating objects on the right.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh bg-bg text-ink">
      <section className="flex min-h-dvh w-full flex-col px-6 pt-safe pb-[max(24px,var(--safe-bottom))] sm:px-10 lg:w-[min(46%,640px)] lg:shrink-0 lg:px-14">
        <header className="auth-fade flex h-16 items-center lg:h-24">
          <Link href="/" aria-label="Timeo home" className="tap -ml-1 flex h-11 items-center gap-2.5 rounded-[12px] px-1">
            <LogoMark size={26} />
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Timeo</span>
          </Link>
        </header>
        <div className="flex flex-1 flex-col pt-[7vh] pb-8 lg:justify-center lg:pt-0 lg:pb-24">
          <div className="auth-panel mx-auto flex w-full max-w-[380px] flex-1 flex-col lg:flex-none">{children}</div>
        </div>
      </section>

      <aside className="hidden flex-1 p-3 pl-0 lg:flex" aria-label="A look at Timeo">
        <div className="auth-showcase relative flex flex-1 overflow-hidden rounded-[24px] border border-line bg-accent-soft">
          <ObjectsLook />
        </div>
      </aside>
    </main>
  );
}
