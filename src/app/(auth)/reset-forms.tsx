"use client";

import { MailCheck } from "lucide-react";
import { useActionState, useState } from "react";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { Input } from "@/components/ui/controls";
import { AuthSwitch, FormError, PasswordInput } from "./auth-form";
import { requestPasswordReset, resetPassword, type ForgotState, type ResetState } from "./actions";

function BackToSignIn() {
  return <AuthSwitch text="Remembered it?" href="/login" label="Sign in" />;
}

export function ForgotForm() {
  const [state, action] = useActionState<ForgotState, FormData>(requestPasswordReset, undefined);

  if (state?.sent)
    return (
      <div className="animate-rise space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <MailCheck className="size-[18px]" strokeWidth={1.9} />
          </span>
          <p className="text-[14px] leading-relaxed text-ink-2">
            If <span className="font-semibold break-all text-ink">{state.email}</span> has an account, a reset link is on its way. It
            expires in 10 minutes.
          </p>
        </div>
        <form action={action} className="space-y-2">
          <input type="hidden" name="email" value={state.email} />
          <SubmitButton size="lg" variant="secondary">
            Send again
          </SubmitButton>
          <p className="px-1 text-center text-[13px] text-ink-3">Nothing after a minute? Check spam, or send it again.</p>
        </form>
        <BackToSignIn />
      </div>
    );

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-2.5">
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
          autoFocus
        />
        <FormError error={state?.error} />
        <SubmitButton variant="accent" size="lg" className="mt-1">
          Send reset link
        </SubmitButton>
      </form>
      <BackToSignIn />
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<ResetState, FormData>(resetPassword, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  // flag a mismatch as soon as the confirmation stops being a prefix of the password, or on submit
  const mismatch = confirm.length > 0 && (tried ? confirm !== password : !password.startsWith(confirm));

  if (state?.expired) return <ExpiredLink />;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        setTried(true);
        if (confirm !== password) e.preventDefault();
      }}
      className="space-y-2.5"
    >
      <input type="hidden" name="token" value={token} />
      {/* lets password managers save the new password against the account */}
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <PasswordInput
        name="password"
        placeholder="New password"
        aria-label="New password"
        autoComplete="new-password"
        minLength={8}
        required
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        name="confirm"
        type="password"
        placeholder="Confirm new password"
        aria-label="Confirm new password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        aria-invalid={mismatch || undefined}
        className={mismatch ? "border-bad" : undefined}
      />
      {mismatch ? <FormError error="Passwords don't match." /> : <FormError error={state?.error} />}
      <SubmitButton variant="accent" size="lg" className="mt-1">
        Save and sign in
      </SubmitButton>
      <p className="pt-1 text-center text-[13px] leading-relaxed text-ink-3">This signs you out on your other devices.</p>
    </form>
  );
}

export function ExpiredLink() {
  return (
    <div className="space-y-5">
      <FormError error="This link has expired or was already used. Links work once, for 10 minutes." />
      <ButtonLink href="/forgot-password" variant="accent" size="lg">
        Send a new link
      </ButtonLink>
      <BackToSignIn />
    </div>
  );
}
