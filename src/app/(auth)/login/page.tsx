import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="display text-[44px] text-ink">
        Make every day <em className="text-accent">count.</em>
      </h1>
      <p className="mt-3 mb-8 text-[15px] leading-relaxed text-ink-2">
        Welcome back. Your season is waiting.
      </p>
      <AuthForm mode="login" />
    </>
  );
}
