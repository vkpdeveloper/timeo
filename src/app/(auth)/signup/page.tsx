import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-[30px]">Start your season</h1>
      <p className="mt-2 mb-8 text-[15px] leading-relaxed text-pretty text-ink-2">Pick two or three goals for 12 weeks. Timeo finds the time and shows what’s next.</p>
      <AuthForm mode="signup" />
    </>
  );
}
