import { and, eq, or, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { catalogEntry } from "@/lib/exercise-catalog-server";
import { muscleLabel } from "@/lib/fitness-math";
import { ExerciseFrames } from "../../../_components/exercise-photo";
import { AddFromLibrary } from "./add";
import { HowTo } from "../../../_components/how-to";

export default function LibraryEntryPage(props: PageProps<"/fitness/exercises/library/[id]">) {
  return (
    <>
      <SubHeader back="/fitness/exercises/library" backLabel="Library" />
      <Suspense
        fallback={
          <div className="pt-6">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="mt-6 aspect-[3/2] rounded-[22px]" />
          </div>
        }
      >
        <Entry params={props.params} />
      </Suspense>
    </>
  );
}

async function Entry({ params }: { params: PageProps<"/fitness/exercises/library/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const entry = catalogEntry(id);
  if (!entry) notFound();
  const mine = await db
    .select({ id: t.exercises.id })
    .from(t.exercises)
    .where(and(eq(t.exercises.userId, user.id), or(eq(t.exercises.catalogId, entry.id), sql`lower(${t.exercises.name}) = lower(${entry.name})`)))
    .get();

  return (
    <div className="pb-2">
      <header className="pt-5 pb-4 lg:pt-10 lg:pb-5">
        <div className="eyebrow">{[muscleLabel(entry.muscle), entry.equipment].filter(Boolean).join(" · ")}</div>
        <h1 className="display mt-1 text-[32px] lg:text-[40px] text-balance text-ink">{entry.name}</h1>
      </header>
      <ExerciseFrames catalogId={entry.id} name={entry.name} images={entry.images} />
      <AddFromLibrary catalogId={entry.id} mineId={mine?.id ?? null} />
      <HowTo entry={entry} />
    </div>
  );
}
