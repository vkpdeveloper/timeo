"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ButtonLink, SubmitButton } from "@/components/ui/button";
import { Input } from "@/components/ui/controls";
import { requestPasswordReset, resetPassword, type ForgotState, type ResetState } from "./actions";

function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">
      {error}
    </p>
  );
}

function BackToSignIn() {
  return (
    <p className="pt-3 text-center text-[14px] text-ink-3">
      Remembered it?{" "}
      <Link href="/login" className="font-semibold text-ink">
        Sign in
      </Link>
    </p>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState<ForgotState, FormData>(requestPasswordReset, undefined);

  if (state?.sent)
    return (
      <div>
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.8} />
          <p className="text-[14.5px] leading-relaxed text-ink-2">
            If <span className="font-semibold text-ink">{state.email}</span> has an account, a reset link is on its way. It
            expires in 10 minutes.
          </p>
        </div>
        <p className="mt-4 px-1 text-[13px] leading-relaxed text-ink-3">Nothing after a minute? Check spam, or send it again.</p>
        <form action={action} className="mt-5">
          <input type="hidden" name="email" value={state.email} />
          <SubmitButton size="lg" variant="secondary">
            Send again
          </SubmitButton>
        </form>
        <BackToSignIn />
      </div>
    );

  return (
    <form action={action} className="space-y-3">
      <Input name="email" type="email" placeholder="Email" autoComplete="email" inputMode="email" defaultValue={state?.email} required autoFocus />
      <ErrorNote error={state?.error} />
      <SubmitButton size="lg" className="mt-2">
        Send reset link
      </SubmitButton>
      <BackToSignIn />
    </form>
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
      className="space-y-3"
    >
      <input type="hidden" name="token" value={token} />
      {/* lets password managers save the new password against the account */}
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <Input
        name="password"
        type="password"
        placeholder="New password"
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
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        aria-invalid={mismatch || undefined}
        className={mismatch ? "border-bad" : undefined}
      />
      {mismatch ? <ErrorNote error="Passwords don't match." /> : <ErrorNote error={state?.error} />}
      <SubmitButton size="lg" className="mt-2">
        Save and sign in
      </SubmitButton>
      <p className="pt-2 text-center text-[13px] leading-relaxed text-ink-3">This signs you out on your other devices.</p>
    </form>
  );
}

export function ExpiredLink() {
  return (
    <div>
      <ErrorNote error="This link has expired or was already used. Links work once, for 10 minutes." />
      <ButtonLink href="/forgot-password" size="lg" className="mt-5">
        Send a new link
      </ButtonLink>
      <BackToSignIn />
    </div>
  );
}
