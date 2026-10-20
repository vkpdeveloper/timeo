import type { Metadata } from "next";
import { ForgotForm } from "../reset-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="display text-[44px] text-ink">Forgot your password?</h1>
      <p className="mt-3 mb-8 text-[15px] leading-relaxed text-ink-2">
        Enter your email and we&apos;ll send a link to choose a new one.
      </p>
      <ForgotForm />
    </>
  );
}
