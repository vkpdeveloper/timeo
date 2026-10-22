"use client";

import { CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useId, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { springs, useReducedMotion } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { useClientValue } from "@/lib/hooks";
import { login, signup, type AuthState } from "./actions";

type Mode = "login" | "signup";

const COPY: Record<Mode, { title: string; body: string; submit: string; pending: string; path: string; doc: string }> = {
  login: {
    title: "Sign in",
    body: "Good to see you again.",
    submit: "Sign in",
    pending: "Signing in",
    path: "/login",
    doc: "Sign in · Timeo",
  },
  signup: {
    title: "Create an account",
    body: "A few goals, twelve weeks, and the time to do them.",
    submit: "Create account",
    pending: "Creating account",
    path: "/signup",
    doc: "Create account · Timeo",
  },
};

/* ─────────────────────────── Pieces shared by every auth screen ─────────────────────────── */

/** Title and one line under it. Crossfades when `id` changes. */
export function AuthHeading({ title, body, id }: { title: string; body: ReactNode; id?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="mb-8 min-h-[72px] lg:mb-9">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={id ?? title}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: springs.smooth }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.12 } }}
        >
          <h1 className="display text-[32px] text-balance text-ink lg:text-[34px]">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-pretty text-ink-2">{body}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** One plain amber line with an alert icon. */
export function FormError({ error, className }: { error?: string | null; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.p
          key={error}
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={springs.snappy}
          className={cn("overflow-hidden text-[14px] leading-snug font-medium text-warn", className)}
        >
          <span className="flex items-start gap-2 pt-2">
            <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2.2} />
            {error}
          </span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** Label above, the input, then an optional hint or error. */
export function AuthField({
  label,
  aside,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  aside?: ReactNode;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <label htmlFor={htmlFor} className="text-[13.5px] font-medium text-ink">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? <FormError error={error} /> : hint ? <p className="px-0.5 pt-2 text-[13px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

/** A 48px text field on the surface. Turns amber when `invalid`. */
export function AuthInput({ invalid, className, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        "field h-12 !rounded-[12px] !px-3.5 text-[16px]",
        invalid && "!border-warn focus:!shadow-[inset_0_0_0_1px_var(--warn)]",
        className,
      )}
    />
  );
}

/** Password field with a show / hide toggle. */
export function PasswordInput({ className, invalid, ...props }: Omit<ComponentProps<"input">, "type"> & { invalid?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <AuthInput {...props} invalid={invalid} type={shown ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="tap absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[12px] text-ink-3 hover:text-ink-2"
      >
        {shown ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

/** The one primary action: an ink pill, spinner and a short word while it works. */
export function AuthSubmit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  const reduce = useReducedMotion();
  const text = pending ? pendingLabel : label;
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending} aria-busy={pending} className="h-12 !rounded-full disabled:opacity-100">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className="inline-flex items-center gap-2"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {text}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

/**
 * Top right of every auth screen: "New to Timeo? Create an account". Between
 * sign in and sign up it swaps the URL in place, so the form keeps what was typed.
 */
export function AuthTopLink() {
  const pathname = usePathname();
  const onForm = pathname === "/login" || pathname === "/signup";
  const to: Mode = pathname === "/login" ? "signup" : "login";
  const text = pathname === "/login" ? "New to Timeo?" : pathname === "/signup" ? "Have an account?" : "Remembered it?";

  return (
    <p className="flex items-center gap-1 text-[14px] text-ink-2">
      <span className="max-[399px]:hidden">{text}</span>
      <Link
        href={COPY[to].path}
        onClick={(e) => {
          if (!onForm) return;
          e.preventDefault();
          // null, not history.state: Next only syncs usePathname for state it doesn't own
          window.history.replaceState(null, "", COPY[to].path);
          document.title = COPY[to].doc;
        }}
        className="tap -mr-1 -my-2.5 inline-flex h-11 items-center px-1 font-medium text-ink underline decoration-transparent underline-offset-4 hover:decoration-ink"
      >
        {to === "signup" ? "Create an account" : "Sign in"}
      </Link>
    </p>
  );
}

/* ─────────────────────────── Sign in / sign up ─────────────────────────── */

type FieldKey = "name" | "email" | "password" | "form";

/** Which field an action's message belongs under. */
function fieldFor(error: string): FieldKey {
  if (/call you/i.test(error)) return "name";
  if (/email doesn't look/i.test(error)) return "email";
  if (/characters|too long/i.test(error)) return "password";
  return "form";
}

/**
 * Sign in and sign up in one form. The mode follows the URL, which AuthTopLink
 * swaps without a page load: what was typed stays and the name field slides in or out.
 */
export function AuthForm() {
  const reduce = useReducedMotion();
  const ids = useId();
  const mode: Mode = usePathname() === "/signup" ? "signup" : "login";
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signup, undefined);
  const timezone = useClientValue(() => Intl.DateTimeFormat().resolvedOptions().timeZone, "UTC");

  const state = mode === "login" ? loginState : signupState;
  // Controlled, so what was typed survives the form reset after a failed submit and a switch of mode.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const pending = mode === "login" ? loginPending : signupPending;
  const copy = COPY[mode];

  // An error stays until its field is edited.
  const [dismissed, setDismissed] = useState<AuthState>(undefined);
  const error = state?.error && state !== dismissed ? state.error : null;
  const where = error ? fieldFor(error) : null;
  const errorOn = (k: FieldKey) => (where === k ? error : null);
  const clear = (k: FieldKey) => () => {
    if (where === k || where === "form") setDismissed(state);
  };

  return (
    <div className="flex flex-1 flex-col">
      <AuthHeading id={mode} title={copy.title} body={copy.body} />

      <form action={mode === "login" ? loginAction : signupAction} noValidate className="flex flex-col gap-5">
        <input type="hidden" name="timezone" value={timezone} />

        <AnimatePresence initial={false}>
          {mode === "signup" && (
            <motion.div
              key="name"
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: -16 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: -16 }}
              transition={springs.smooth}
              className="overflow-hidden"
            >
              <AuthField label="Name" htmlFor={`${ids}-name`} error={errorOn("name")}>
                <AuthInput
                  id={`${ids}-name`}
                  name="name"
                  placeholder="Your first name"
                  autoComplete="given-name"
                  value={name}
                  invalid={where === "name"}
                  onChange={(e) => {
                    setName(e.target.value);
                    clear("name")();
                  }}
                  maxLength={80}
                />
              </AuthField>
            </motion.div>
          )}
        </AnimatePresence>

        <AuthField label="Email" htmlFor={`${ids}-email`} error={errorOn("email")}>
          <AuthInput
            id={`${ids}-email`}
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            value={email}
            invalid={where === "email"}
            onChange={(e) => {
              setEmail(e.target.value);
              clear("email")();
            }}
            required
          />
        </AuthField>

        <AuthField
          label="Password"
          htmlFor={`${ids}-password`}
          error={errorOn("password")}
          hint={mode === "signup" ? "8 or more characters." : undefined}
          aside={
            <AnimatePresence initial={false}>
              {mode === "login" && (
                <motion.span
                  key="forgot"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Link
                    href="/forgot-password"
                    className="-my-3 inline-flex h-11 items-center px-1 text-[13.5px] text-ink-2 hover:text-ink"
                  >
                    Forgot password?
                  </Link>
                </motion.span>
              )}
            </AnimatePresence>
          }
        >
          <PasswordInput
            id={`${ids}-password`}
            name="password"
            placeholder={mode === "signup" ? "Choose a password" : "Enter your password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            invalid={where === "password"}
            onChange={clear("password")}
            required
          />
        </AuthField>

        <FormError error={errorOn("form")} className="-mt-4" />

        <div className="pt-1">
          <AuthSubmit pending={pending} label={copy.submit} pendingLabel={copy.pending} />
        </div>
      </form>
    </div>
  );
}
