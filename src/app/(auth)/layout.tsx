import { DotField } from "@/components/landing/dot-field";
import { Wordmark } from "@/components/landing/wordmark";
import "@/components/landing/landing.css";
import "./auth.css";

/** Sign in, sign up and password reset: one compact form over a faint dot field. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-bg pt-safe">
      <DotField variant="quiet" />
      <header data-dots-clear className="auth-fade relative mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-6">
        <Wordmark />
      </header>
      <div className="relative mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-6 pt-4 pb-16 sm:pb-24">
        <div data-dots-clear="card" className="auth-panel">
          {children}
        </div>
      </div>
    </main>
  );
}
