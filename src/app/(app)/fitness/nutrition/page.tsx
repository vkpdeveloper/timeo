import { asc, desc, eq, inArray } from "drizzle-orm";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Section, Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatLongDate } from "@/lib/dates";
import { DIET_LIBRARY, GOAL_LABEL } from "@/lib/diet-library";
import { getNutritionDay } from "@/lib/fitness";
import { MacroSummary } from "../_components/bits";
import { WaterCard } from "../_components/water";
import { createPlan } from "./actions";
import { LibraryCard, LoggedMeals, LogMealButton, PlanMeals, SetActiveButton } from "./client";

export default function NutritionPage() {
  return (
    <>
      <SubHeader back="/fitness" backLabel="Fitness" title="Nutrition" />
      <Suspense
        fallback={
          <div className="pt-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="mt-6 h-40 rounded-[22px]" />
            <Skeleton className="mt-4 h-64 rounded-[22px]" />
          </div>
        }
      >
        <Nutrition />
      </Suspense>
    </>
  );
}

async function Nutrition() {
  const user = await requireUser();
  const [day, plans] = await Promise.all([
    getNutritionDay(user.id, user.today),
    db.select().from(t.dietPlans).where(eq(t.dietPlans.userId, user.id)).orderBy(desc(t.dietPlans.active), asc(t.dietPlans.createdAt)),
  ]);
  const active = plans.find((p) => p.active) ?? null;
  const planMeals = active
    ? await db
        .select()
        .from(t.dietPlanMeals)
        .where(inArray(t.dietPlanMeals.planId, [active.id]))
        .orderBy(asc(t.dietPlanMeals.timeMin), asc(t.dietPlanMeals.sortOrder))
    : [];
  const loggedPlanMeals = day.meals.filter((m) => m.planMealId).map((m) => m.planMealId!);
  const sources = new Set(plans.map((p) => p.source).filter(Boolean));
  const left = day.target ? day.target.calories - day.totals.calories : null;

  const library = (
      <Section title="Plan library" action={plans.length ? undefined : "Pick one to set targets"}>
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
            {DIET_LIBRARY.map((p) => (
              <LibraryCard key={p.slug} plan={p} added={sources.has(p.slug)} />
            ))}
          </div>
        </Section>
    );

  return (
    <div className="fade-up pb-8">
      <header className="pt-5 pb-5">
        <div className="eyebrow">{formatLongDate(user.today)}</div>
        <h1 className="display mt-1.5 text-[38px] text-ink">Nutrition</h1>
        {left != null && (
          <p className="tnum mt-1 text-[15px] text-ink-2">
            {left >= 0 ? `${left.toLocaleString("en-US")} kcal left` : `${(-left).toLocaleString("en-US")} kcal over`}
            {day.target && ` · ${Math.max(0, day.target.proteinG - day.totals.proteinG)} g protein to go`}
          </p>
        )}
      </header>

      <div className="card p-5">
        <MacroSummary totals={day.totals} target={day.target} />
        <div className="mt-5">
          <LogMealButton today={user.today} />
        </div>
      </div>
      <div className="mt-3">
        <WaterCard ml={day.waterMl} targetMl={day.waterTargetMl} day={user.today} />
      </div>

      {active && planMeals.length > 0 && (
        <Section title={`From ${active.name}`} action={<Link href={`/fitness/nutrition/plans/${active.id}`} className="text-ink-3">Edit plan</Link>}>
          <PlanMeals meals={planMeals} logged={loggedPlanMeals} today={user.today} />
        </Section>
      )}

      <Section title="Logged today">
        <LoggedMeals meals={day.meals} />
      </Section>

      {!plans.length && library}
      <Section
        title="Your plans"
        action={
          <form action={createPlan}>
            <SubmitButton variant="ghost" size="sm" className="-mr-2 text-accent">
              <Plus className="size-4" /> New
            </SubmitButton>
          </form>
        }
      >
        {plans.length === 0 ? (
          <div className="card px-4 py-5 text-[14px] text-ink-3">No plans yet. Add one from the library above or start your own.</div>
        ) : (
          <div className="card overflow-hidden">
            {plans.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border-b border-line pr-3 last:border-0">
                <Link href={`/fitness/nutrition/plans/${p.id}`} className="tap flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15.5px] font-semibold text-ink">{p.name}</span>
                      {p.active && <span className="shrink-0 rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-semibold text-ok">Active</span>}
                    </div>
                    <div className="tnum mt-0.5 truncate text-[12.5px] text-ink-3">
                      {GOAL_LABEL[p.goal]} · {p.calories.toLocaleString("en-US")} kcal · P {p.proteinG} · C {p.carbsG} · F {p.fatG}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-ink-3" />
                </Link>
                {!p.active && <SetActiveButton id={p.id} />}
              </div>
            ))}
          </div>
        )}
      </Section>

      {plans.length > 0 && library}
    </div>
  );
}
