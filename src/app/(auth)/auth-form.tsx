"use client";

import { CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useActionState, useEffect, useId, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { GoogleMark } from "@/components/integrations/google-mark";
import { Button } from "@/components/ui/button";
import { springs, useReducedMotion } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { useClientValue } from "@/lib/hooks";
import { login, signup, type AuthState } from "./actions";

type Mode = "login" | "signup";

const COPY: Record<Mode, { title: string; body: string; submit: string; pending: string; path: string; doc: string }> = {
  login: {
    title: "Sign in to Timeo",
    body: "Use the email you signed up with.",
    submit: "Sign in",
    pending: "Signing in",
    path: "/login",
    doc: "Sign in · Timeo",
  },
  signup: {
    title: "Start your first season",
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
    <div className="mb-8 min-h-[92px] lg:mb-9">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={id ?? title}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: springs.smooth }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.12 } }}
        >
          <h1 className="text-[28px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance text-ink lg:text-[30px]">{title}</h1>
          <p className="mt-2.5 text-[15.5px] leading-relaxed text-pretty text-ink-2">{body}</p>
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
        <label htmlFor={htmlFor} className="text-[13.5px] font-medium text-ink-2">
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

/** The one primary action: accent fill, spinner and a short word while it works. */
export function AuthSubmit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  const reduce = useReducedMotion();
  const text = pending ? pendingLabel : label;
  return (
    <Button type="submit" variant="accent" size="lg" disabled={pending} aria-busy={pending} className="h-12 disabled:opacity-100">
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

/** Small line under a form: "New to Timeo? Create an account". */
export function AuthSwitch({
  text,
  href,
  label,
  onClick,
}: {
  text: string;
  href: string;
  label: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <p className="flex items-center justify-center gap-1 text-[14.5px] text-ink-3">
      {text}
      <Link
        href={href}
        onClick={onClick}
        className="tap -my-2.5 inline-flex h-11 items-center px-1 font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
      >
        {label}
      </Link>
    </p>
  );
}

/** "Continue with Google": a plain outlined button with Google's mark. A link, so the browser leaves for Google. */
export function GoogleButton({ timezone }: { timezone: string }) {
  const [leaving, setLeaving] = useState(false);
  return (
    <a
      href={`/api/auth/google?tz=${encodeURIComponent(timezone)}`}
      onClick={() => setLeaving(true)}
      aria-busy={leaving}
      className="tap flex h-12 w-full items-center justify-center gap-2.5 rounded-[12px] border border-line-strong bg-surface text-[16px] font-medium tracking-tight text-ink hover:bg-surface-2"
    >
      {leaving ? <Loader2 className="size-[18px] animate-spin text-ink-3" /> : <GoogleMark size={18} />}
      Continue with Google
    </a>
  );
}

function OrLine() {
  return (
    <div className="my-6 flex items-center gap-3 text-[13px] text-ink-3" aria-hidden>
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** ?error=google after a Google sign-in that didn't finish; ?link=google&email= when the email already has an account. */
function useGoogleReturn() {
  const search = useClientValue(() => window.location.search, "");
  return useMemo(() => {
    const sp = new URLSearchParams(search);
    return { error: sp.get("error") === "google", link: sp.get("link") === "google", email: sp.get("email") ?? "" };
  }, [search]);
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
 * Sign in and sign up in one form. Switching keeps what was typed, slides the
 * name field in or out and swaps the URL without a page load.
 */
export function AuthForm({ mode: initialMode, google = false }: { mode: Mode; google?: boolean }) {
  const reduce = useReducedMotion();
  const ids = useId();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signup, undefined);
  const timezone = useClientValue(() => Intl.DateTimeFormat().resolvedOptions().timeZone, "UTC");

  const state = mode === "login" ? loginState : signupState;
  // Controlled, so what was typed survives the form reset after a failed submit and a switch of mode.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const pending = mode === "login" ? loginPending : signupPending;
  const copy = COPY[mode];
  const back = useGoogleReturn();
  const linking = mode === "login" && back.link;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fill in the email Google just confirmed, once it's readable
    if (back.link && back.email) setEmail((e) => e || back.email);
  }, [back.link, back.email]);

  // An error stays until its field is edited.
  const [dismissed, setDismissed] = useState<AuthState>(undefined);
  const error = state?.error && state !== dismissed ? state.error : null;
  const where = error ? fieldFor(error) : null;
  const errorOn = (k: FieldKey) => (where === k ? error : null);
  const clear = (k: FieldKey) => () => {
    if (where === k || where === "form") setDismissed(state);
  };

  const switchTo = (next: Mode) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setMode(next);
    window.history.replaceState(window.history.state, "", COPY[next].path);
    document.title = COPY[next].doc;
  };

  return (
    <div className="flex flex-1 flex-col">
      <AuthHeading
        id={linking ? "link" : mode}
        title={linking ? "Link your Google account" : copy.title}
        body={linking ? "You already have a Timeo account with this email. Sign in with your password once, and Google works from then on." : copy.body}
      />

      {google && !linking && (
        <>
          <GoogleButton timezone={timezone} />
          <FormError error={back.error ? "Google sign-in didn't finish. Try again." : null} />
          <OrLine />
        </>
      )}

      <form action={mode === "login" ? loginAction : signupAction} noValidate className="flex flex-col gap-4">
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
                    className="-my-3 inline-flex h-11 items-center px-1 text-[13.5px] font-medium text-ink-3 hover:text-ink"
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
            placeholder={mode === "signup" ? "Choose a password" : "Your password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            invalid={where === "password"}
            onChange={clear("password")}
            required
          />
        </AuthField>

        <FormError error={errorOn("form")} className="-mt-3" />

        <div className="pt-1">
          <AuthSubmit pending={pending} label={copy.submit} pendingLabel={copy.pending} />
        </div>
      </form>

      <div className="mt-auto pt-10 lg:mt-7 lg:pt-0">
        {mode === "login" ? (
          <AuthSwitch text="New to Timeo?" href="/signup" label="Create an account" onClick={switchTo("signup")} />
        ) : (
          <AuthSwitch text="Have an account?" href="/login" label="Sign in" onClick={switchTo("login")} />
        )}
      </div>
    </div>
  );
}
