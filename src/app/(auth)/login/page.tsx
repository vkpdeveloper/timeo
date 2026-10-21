import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="display text-[34px] leading-[1.04] text-balance text-ink sm:text-[38px]">
        Welcome <em className="text-accent">back.</em>
      </h1>
      <p className="mt-2.5 mb-7 text-[15px] leading-relaxed text-ink-2">Your season is right where you left it.</p>
      <AuthForm mode="login" />
    </>
  );
}
