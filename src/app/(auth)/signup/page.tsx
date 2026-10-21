import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="display text-[34px] leading-[1.04] text-balance text-ink sm:text-[38px]">
        Make the time <em className="text-accent">count.</em>
      </h1>
      <p className="mt-2.5 mb-7 text-[15px] leading-relaxed text-ink-2">Pick a few goals for 12 weeks. Timeo finds the time and tells you what’s next.</p>
      <AuthForm mode="signup" />
    </>
  );
}
