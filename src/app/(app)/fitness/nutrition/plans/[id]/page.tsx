import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { PlanEditor } from "./editor";

export default function PlanPage(props: PageProps<"/fitness/nutrition/plans/[id]">) {
  return (
    <>
      <SubHeader back="/fitness/nutrition" backLabel="Nutrition" />
      <Suspense
        fallback={
          <div className="pt-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="mt-6 h-64 rounded-[22px]" />
          </div>
        }
      >
        <Plan params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Plan({
  params,
  searchParams,
}: {
  params: PageProps<"/fitness/nutrition/plans/[id]">["params"];
  searchParams: PageProps<"/fitness/nutrition/plans/[id]">["searchParams"];
}) {
  const user = await requireUser();
  const { id } = await params;
  const isNew = (await searchParams).new === "1";
  const [plan, meals] = await Promise.all([
    db.select().from(t.dietPlans).where(and(eq(t.dietPlans.id, id), eq(t.dietPlans.userId, user.id))).get(),
    db
      .select({ m: t.dietPlanMeals })
      .from(t.dietPlanMeals)
      .innerJoin(t.dietPlans, eq(t.dietPlans.id, t.dietPlanMeals.planId))
      .where(and(eq(t.dietPlanMeals.planId, id), eq(t.dietPlans.userId, user.id)))
      .orderBy(asc(t.dietPlanMeals.timeMin), asc(t.dietPlanMeals.sortOrder))
      .then((r) => r.map((x) => x.m)),
  ]);
  if (!plan) notFound();
  return <PlanEditor plan={plan} meals={meals} isNew={isNew} />;
}
