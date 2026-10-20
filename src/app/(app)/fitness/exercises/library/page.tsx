import { and, eq, isNotNull } from "drizzle-orm";
import { Suspense } from "react";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { LibraryBrowser } from "../../_components/catalog-list";

export default function LibraryPage() {
  return (
    <>
      <SubHeader back="/fitness/exercises" backLabel="Exercises" title="Library" />
      <h1 className="display px-1 pt-5 pb-1 text-[38px] text-ink">Library</h1>
      <p className="px-1 pb-4 text-[14px] text-ink-3">Every exercise with photos and steps. Add one to use it in routines and workouts.</p>
      <Suspense fallback={<Skeleton className="h-96 rounded-[22px]" />}>
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
