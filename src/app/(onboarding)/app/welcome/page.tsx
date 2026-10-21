import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db, t } from "@/db";
import { Skeleton } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { getActiveSeason } from "@/lib/queries";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <Suspense fallback={<WelcomeSkeleton />}>
      <WelcomeContent />
    </Suspense>
  );
}

function WelcomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[520px] px-5 pt-[calc(var(--safe-top)+120px)]">
      <Skeleton className="size-24 rounded-full" />
      <Skeleton className="mt-8 h-9 w-64" />
      <Skeleton className="mt-3 h-5 w-80" />
    </div>
  );
}

async function WelcomeContent() {
  const user = await requireUser();
  // Onboarding is for the first run only: anyone with a season goes straight to Now.
  if (await getActiveSeason(user.id)) redirect("/app");
  const past = await db.select({ id: t.seasons.id }).from(t.seasons).where(eq(t.seasons.userId, user.id)).get();
  return (
    <Onboarding
      name={user.name}
      today={user.today}
      timezone={user.timezone}
      dayStartMin={user.dayStartMin}
      dayEndMin={user.dayEndMin}
      seasonName={past ? "New season" : "First season"}
    />
  );
}
