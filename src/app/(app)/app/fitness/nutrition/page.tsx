import { asc, desc, eq, inArray } from "drizzle-orm";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { SubmitButton } from "@/components/ui/button";
import { CountUp } from "@/components/ui/motion";
import { Card, LinearProgress, PageHeader, Row, Section, SectionLink, Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatWeekdayShort, toUTCDate } from "@/lib/dates";
import { DIET_LIBRARY, GOAL_LABEL } from "@/lib/diet-library";
import { getNutritionDay } from "@/lib/fitness";
import { MacroMeters } from "../_components/bits";
import { WaterCard } from "../_components/water";
import { createPlan } from "./actions";
import { LibraryCard, LoggedMeals, LogMealButton, PlanMeals, SetActiveButton } from "./client";

const fmtDayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

export default function NutritionPage() {
  return (
    <>
      <SubHeader back="/app/fitness" backLabel="Body" />
      <Suspense
        fallback={
          <div>
            <div className="pt-5 pb-4">
              <Skeleton className="mb-2 h-3 w-32" />
              <Skeleton className="h-9 w-40" />
            </div>
            <Skeleton className="h-60 rounded-[16px]" />
            <Skeleton className="mt-6 h-[52px] rounded-[16px]" />
            <Skeleton className="mt-6 h-64 rounded-[16px]" />
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
  const target = day.target;
  const kcal = day.totals.calories;
  const left = target ? target.calories - kcal : null;
  const mealsLeft = planMeals.filter((m) => !loggedPlanMeals.includes(m.id)).length;

  const library = (
    <Section title="Plan library" hint={plans.length ? undefined : "Pick one to set your daily targets."}>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {DIET_LIBRARY.map((p) => (
          <LibraryCard key={p.slug} plan={p} added={sources.has(p.slug)} />
        ))}
      </div>
    </Section>
  );

  return (
    <div>
      <PageHeader
        eyebrow={`${formatWeekdayShort(user.today)} ${fmtDayMonth.format(toUTCDate(user.today))}`}
        title="Food"
        subtitle={
          active
            ? `${active.name} · ${mealsLeft ? `${mealsLeft} of ${planMeals.length} meals left` : planMeals.length ? "All planned meals logged" : GOAL_LABEL[active.goal]}`
            : "No plan yet. Pick one below to set targets."
        }
      />

      <Card className="rise p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <CountUp value={kcal} className="tnum text-[32px] leading-none font-semibold tracking-tight text-ink" />
              <span className="tnum text-[14px] font-medium text-ink-3">
                {target ? `of ${target.calories.toLocaleString("en-US")} kcal` : "kcal"}
              </span>
            </div>
          </div>
          {left != null && (
            <div className="shrink-0 text-right">
              <div className={`tnum text-[17px] font-semibold tracking-tight ${left < 0 ? "text-warn" : "text-ink"}`}>
                {Math.abs(left).toLocaleString("en-US")}
              </div>
              <div className="text-[12px] font-medium text-ink-3">{left < 0 ? "kcal over" : "kcal left"}</div>
            </div>
          )}
        </div>
        <LinearProgress
          value={target ? kcal / target.calories : 0}
          color={left != null && left < 0 ? "var(--warn)" : "var(--accent)"}
          height={6}
          className="mt-3"
        />
        <div className="mt-5">
          <MacroMeters totals={day.totals} target={target} />
        </div>
        <div className="mt-5">
          <LogMealButton today={user.today} />
        </div>
      </Card>

      <Section card className="mt-3!">
        <WaterCard ml={day.waterMl} targetMl={day.waterTargetMl} day={user.today} />
      </Section>

      {active && planMeals.length > 0 && (
        <Section
          title="Planned"
          count={`${planMeals.length - mealsLeft} of ${planMeals.length}`}
          action={<SectionLink href={`/app/fitness/nutrition/plans/${active.id}`}>Edit plan</SectionLink>}
        >
          <PlanMeals meals={planMeals} logged={loggedPlanMeals} today={user.today} />
        </Section>
      )}

      <Section title="Logged today" count={day.meals.length || undefined}>
        <LoggedMeals meals={day.meals} />
      </Section>

      {!plans.length && library}

      <Section
        title="Your plans"
        action={
          <form action={createPlan}>
            <SubmitButton variant="ghost" size="sm" className="-mr-2">
              <Plus className="size-4" /> New
            </SubmitButton>
          </form>
        }
        card
      >
        {plans.length === 0 ? (
          <div className="px-4 py-5 text-[14px] text-ink-3">No plans yet. Add one from the library or start your own.</div>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="flex items-center">
              <Row
                href={`/app/fitness/nutrition/plans/${p.id}`}
                className="min-w-0 flex-1 border-b-0!"
                title={
                  <span className="flex items-center gap-2">
                    <span className="truncate">{p.name}</span>
                    {p.active && (
                      <span className="shrink-0 rounded-full bg-ok-soft px-2 py-0.5 text-[11.5px] font-medium text-ok">Active</span>
                    )}
                  </span>
                }
                subtitle={`${GOAL_LABEL[p.goal]} · ${p.calories.toLocaleString("en-US")} kcal · P ${p.proteinG} · C ${p.carbsG} · F ${p.fatG}`}
              />
              {!p.active && (
                <div className="pr-3">
                  <SetActiveButton id={p.id} />
                </div>
              )}
            </div>
          ))
        )}
      </Section>

      {plans.length > 0 && library}
    </div>
  );
}
