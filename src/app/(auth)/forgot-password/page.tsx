import type { Metadata } from "next";
import { ForgotForm } from "../reset-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="display text-[34px] leading-[1.04] text-balance text-ink sm:text-[38px]">Reset your password</h1>
      <p className="mt-2.5 mb-7 text-[15px] leading-relaxed text-ink-2">Enter your email and we’ll send a link to choose a new one.</p>
      <ForgotForm />
    </>
  );
}
