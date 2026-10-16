"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { useClientValue } from "@/lib/hooks";
import { Input } from "@/components/ui/controls";
import { login, signup, type AuthState } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, undefined);
  const timezone = useClientValue(() => Intl.DateTimeFormat().resolvedOptions().timeZone, "UTC");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="timezone" value={timezone} />
      {mode === "signup" && (
        <Input name="name" placeholder="Your name" autoComplete="given-name" defaultValue={state?.name} required />
      )}
      <Input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state?.email}
        required
      />
      <Input
        name="password"
        type="password"
        placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        required
      />
      {state?.error && (
        <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">
          {state.error}
        </p>
      )}
      <SubmitButton size="lg" className="mt-2">
        {mode === "login" ? "Sign in" : "Create account"}
      </SubmitButton>
      <p className="pt-3 text-center text-[14px] text-ink-3">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-ink">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-ink">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
