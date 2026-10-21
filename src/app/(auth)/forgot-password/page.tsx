import type { Metadata } from "next";
import { ForgotForm } from "../reset-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-[30px]">Reset your password</h1>
      <p className="mt-2 mb-8 text-[15px] leading-relaxed text-pretty text-ink-2">Enter your email and we’ll send a link to choose a new one.</p>
      <ForgotForm />
    </>
  );
}
