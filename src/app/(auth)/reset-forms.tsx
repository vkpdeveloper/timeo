"use client";

import { MailCheck } from "lucide-react";
import { motion } from "motion/react";
import { useActionState, useId, useState } from "react";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { springs, useReducedMotion } from "@/components/ui/motion";
import { AuthField, AuthHeading, AuthInput, AuthSubmit, FormError, PasswordInput } from "./auth-form";
import { requestPasswordReset, resetPassword, type ForgotState, type ResetState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, undefined);
  const reduce = useReducedMotion();
  const ids = useId();

  if (state?.sent)
    return (
      <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={springs.smooth}>
        <span className="mb-6 grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <MailCheck className="size-[22px]" strokeWidth={1.8} />
        </span>
        <AuthHeading
          title="Check your email"
          body={
            <>
              If <span className="font-medium break-all text-ink">{state.email}</span> has an account, a reset link is on its way. It works
              once, for 10 minutes.
            </>
          }
        />
        <form action={action}>
          <input type="hidden" name="email" value={state.email} />
          <SubmitButton size="lg" variant="outline" className="h-12 !rounded-full">
            Send again
          </SubmitButton>
          <p className="px-1 pt-3 text-center text-[13.5px] text-ink-3">Nothing after a minute? Check spam, or send it again.</p>
        </form>
      </motion.div>
    );

  return (
    <div className="flex flex-1 flex-col">
      <AuthHeading title="Reset your password" body="Enter your email and we’ll send a link to choose a new one." />
      <form action={action} noValidate className="flex flex-col gap-5">
        <AuthField label="Email" htmlFor={`${ids}-email`} error={state?.error}>
          <AuthInput
            id={`${ids}-email`}
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            defaultValue={state?.email}
            invalid={!!state?.error}
            required
            autoFocus
          />
        </AuthField>
        <div className="pt-2">
          <AuthSubmit pending={pending} label="Send reset link" pendingLabel="Sending" />
        </div>
      </form>
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, undefined);
  const ids = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  // flag a mismatch as soon as the confirmation stops being a prefix of the password, or on submit
  const mismatch = confirm.length > 0 && (tried ? confirm !== password : !password.startsWith(confirm));
  const short = state?.error && /characters/.test(state.error);

  if (state?.expired) return <ExpiredLink />;

  return (
    <>
      <AuthHeading title="Choose a new password" body="You’ll be signed in right after." />
      <form
        action={action}
        noValidate
        onSubmit={(e) => {
          setTried(true);
          if (confirm !== password) e.preventDefault();
        }}
        className="flex flex-col gap-5"
      >
        <input type="hidden" name="token" value={token} />
        {/* lets password managers save the new password against the account */}
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <AuthField label="New password" htmlFor={`${ids}-password`} hint="8 or more characters." error={short ? state?.error : null}>
          <PasswordInput
            id={`${ids}-password`}
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            autoFocus
            invalid={!!short}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </AuthField>
        <AuthField label="Confirm password" htmlFor={`${ids}-confirm`} error={mismatch ? "Passwords don't match." : null}>
          <AuthInput
            id={`${ids}-confirm`}
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={mismatch}
          />
        </AuthField>
        {!mismatch && !short && <FormError error={state?.error} />}
        <div className="pt-2">
          <AuthSubmit pending={pending} label="Save and sign in" pendingLabel="Saving" />
        </div>
        <p className="pt-1 text-center text-[13.5px] leading-relaxed text-ink-3">This signs you out on your other devices.</p>
      </form>
    </>
  );
}

export function ExpiredLink() {
  return (
    <div className="flex flex-1 flex-col">
      <AuthHeading title="This link has expired" body="Reset links work once, for 10 minutes. Send yourself a fresh one." />
      <ButtonLink href="/forgot-password" variant="primary" size="lg" className="h-12 !rounded-full">
        Send a new link
      </ButtonLink>
    </div>
  );
}
