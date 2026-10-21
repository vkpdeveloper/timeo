import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-[30px]">Welcome back</h1>
      <p className="mt-2 mb-8 text-[15px] leading-relaxed text-pretty text-ink-2">Your season is right where you left it.</p>
      <AuthForm mode="login" />
    </>
  );
}
