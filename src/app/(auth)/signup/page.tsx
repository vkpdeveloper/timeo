import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="display text-[44px] text-ink">
        168 hours a week. <em className="text-accent">Spend them well.</em>
      </h1>
      <p className="mt-3 mb-8 text-[15px] leading-relaxed text-ink-2">
        Plan 12-week seasons, protect time for your goals, train with intent and review honestly.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
