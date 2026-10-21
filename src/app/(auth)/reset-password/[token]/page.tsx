import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { peekPasswordReset } from "@/lib/auth";
import { ExpiredLink, ResetForm } from "../../reset-forms";

export const metadata: Metadata = { title: "New password", referrer: "no-referrer" };

export default function ResetPasswordPage(props: PageProps<"/reset-password/[token]">) {
  return (
    <>
      <h1 className="display text-[34px] leading-[1.04] text-balance text-ink sm:text-[38px]">Choose a new password</h1>
      <p className="mt-2.5 mb-7 text-[15px] leading-relaxed text-ink-2">At least 8 characters. You’ll be signed in right after.</p>
      <Suspense fallback={<Skeleton className="h-[52px] w-full" />}>
        <ResetContent params={props.params} />
      </Suspense>
    </>
  );
}

async function ResetContent({ params }: { params: PageProps<"/reset-password/[token]">["params"] }) {
  const { token } = await params;
  await connection(); // the link's expiry is checked against the current time
  return (await peekPasswordReset(token)) ? <ResetForm token={token} /> : <ExpiredLink />;
}
