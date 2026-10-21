import Link from "next/link";
import { LogoMark } from "@/components/ui/primitives";
import "./auth.css";

/** Sign in, sign up and password reset: one calm form, the same on every screen size. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-col bg-bg px-6 pt-safe pb-[max(24px,var(--safe-bottom))] text-ink sm:px-10">
      <header className="auth-fade mx-auto flex h-16 w-full max-w-6xl items-center lg:h-20">
        <Link href="/" aria-label="Timeo home" className="tap -ml-1 flex h-11 items-center gap-2.5 rounded-[12px] px-1">
          <LogoMark size={26} />
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Timeo</span>
        </Link>
      </header>
      <div className="flex flex-1 flex-col pt-[7vh] pb-8 lg:justify-center lg:pt-0 lg:pb-[12vh]">
        <div className="auth-panel mx-auto flex w-full max-w-[380px] flex-1 flex-col lg:flex-none">{children}</div>
      </div>
    </main>
  );
}
