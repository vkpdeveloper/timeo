import { and, eq, isNotNull } from "drizzle-orm";
import { Suspense } from "react";
import { PageHeader, Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { LibraryBrowser } from "../../_components/catalog-list";

export default function LibraryPage() {
  return (
    <>
      <SubHeader back="/app/fitness/exercises" backLabel="Exercises" />
      <PageHeader title="Library" subtitle="Every exercise with photos and steps. Add one to use it in routines." />
      <Suspense fallback={<Skeleton className="h-96 rounded-[20px]" />}>
        <Browser />
      </Suspense>
    </>
  );
}

async function Browser() {
  const user = await requireUser();
  const owned = await db
    .select({ catalogId: t.exercises.catalogId })
    .from(t.exercises)
    .where(and(eq(t.exercises.userId, user.id), isNotNull(t.exercises.catalogId)));
  return <LibraryBrowser owned={owned.map((r) => r.catalogId!)} />;
}
