"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type ComponentProps } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Input } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { useClientValue } from "@/lib/hooks";
import { login, signup, type AuthState } from "./actions";

/** One plain error line under the fields. */
export function FormError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex animate-pop items-start gap-2 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] leading-snug font-medium text-bad">
      <CircleAlert className="mt-px size-4 shrink-0" />
      {error}
    </p>
  );
}

/** Password field with a show / hide toggle. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="tap absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[14px] text-ink-3 hover:text-ink-2"
      >
        {shown ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

/** Small switch line under a form: "New here? Create an account". */
export function AuthSwitch({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <p className="pt-1 text-center text-[14px] text-ink-3">
      {text}{" "}
      <Link href={href} className="font-semibold text-ink underline-offset-4 hover:underline">
        {label}
      </Link>
    </p>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, undefined);
  const timezone = useClientValue(() => Intl.DateTimeFormat().resolvedOptions().timeZone, "UTC");

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-2.5">
        <input type="hidden" name="timezone" value={timezone} />
        {mode === "signup" && (
          <Input name="name" placeholder="Your name" aria-label="Your name" autoComplete="given-name" defaultValue={state?.name} required />
        )}
        <Input
          name="email"
          type="email"
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          spellCheck={false}
          defaultValue={state?.email}
          required
        />
        <PasswordInput
          name="password"
          placeholder={mode === "signup" ? "Password, 8 or more characters" : "Password"}
          aria-label="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
        />
        {mode === "login" && (
          <div className="-my-1 flex justify-end">
            <Link href="/forgot-password" className="tap flex h-11 items-center px-1 text-[13.5px] font-medium text-ink-3 hover:text-ink-2">
              Forgot password?
            </Link>
          </div>
        )}
        <FormError error={state?.error} />
        <SubmitButton variant="accent" size="lg" className={mode === "signup" ? "mt-2" : undefined}>
          {mode === "login" ? "Sign in" : "Create account"}
        </SubmitButton>
      </form>
      {mode === "login" ? (
        <AuthSwitch text="New here?" href="/signup" label="Create an account" />
      ) : (
        <AuthSwitch text="Have an account?" href="/login" label="Sign in" />
      )}
    </div>
  );
}
