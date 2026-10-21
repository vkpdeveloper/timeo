import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { peekPasswordReset } from "@/lib/auth";
import { ExpiredLink, ResetForm } from "../../reset-forms";

export const metadata: Metadata = { title: "New password", referrer: "no-referrer" };

export default function ResetPasswordPage(props: PageProps<"/reset-password/[token]">) {
  return (
    <Suspense fallback={<ResetSkeleton />}>
      <ResetContent params={props.params} />
    </Suspense>
  );
}

function ResetSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="mb-8 h-[92px] w-full" />
      <Skeleton className="h-[78px] w-full" />
      <Skeleton className="h-[78px] w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

async function ResetContent({ params }: { params: PageProps<"/reset-password/[token]">["params"] }) {
  const { token } = await params;
  await connection(); // the link's expiry is checked against the current time
  return (await peekPasswordReset(token)) ? <ResetForm token={token} /> : <ExpiredLink />;
}
