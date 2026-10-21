import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { addDays, isValidISODate, startOfWeek, weekday } from "@/lib/dates";
import { getActiveSeason } from "@/lib/queries";
import { getEnergyReport, getGoalWeeks, getWeekStats } from "../data";
import { seasonWeek, weekLabel } from "../shared";
import { WeekFlow } from "./week-flow";

export const metadata: Metadata = { title: "Weekly review" };

export default function WeekReviewPage(props: PageProps<"/app/review/week">) {
  return (
    <Suspense fallback={<WeekSkeleton />}>
      <WeekReview searchParams={props.searchParams} />
    </Suspense>
  );
}

function WeekSkeleton() {
  return (
    <div>
      <SubHeader back="/app/goals" backLabel="Season" />
      <Skeleton className="mx-auto mt-3 h-2 w-32" />
      <Skeleton className="mt-6 h-3 w-24" />
      <Skeleton className="mt-2 h-9 w-40" />
      <Skeleton className="mt-5 h-[76px] rounded-[16px]" />
      <Skeleton className="mt-6 h-40 rounded-[16px]" />
    </div>
  );
}

async function WeekReview({ searchParams }: { searchParams: PageProps<"/app/review/week">["searchParams"] }) {
  const user = await requireUser();
  const { week } = await searchParams;
  const current = startOfWeek(user.today);
  const requested = typeof week === "string" && isValidISODate(week) ? startOfWeek(week) : current;
  const weekStart = requested > current ? current : requested;

  const season = await getActiveSeason(user.id);
  const [stats, goals, reflection, energy] = await Promise.all([
    getWeekStats(user.id, weekStart, user.today),
    season ? getGoalWeeks(user.id, season.id, weekStart) : Promise.resolve([]),
    db
      .select()
      .from(t.reflections)
      .where(and(eq(t.reflections.userId, user.id), eq(t.reflections.kind, "weekly"), eq(t.reflections.date, weekStart)))
      .get(),
    getEnergyReport(user.id, weekStart, addDays(weekStart, 6)),
  ]);

  const no = seasonWeek(weekStart, season);
  const label = weekLabel(weekStart, season);

  return (
    <WeekFlow
      key={weekStart}
      weekStart={weekStart}
      title={no ? `Week ${no}` : "This week"}
      range={label.replace(/^Week \d+ · /, "")}
      isCurrent={weekStart === current}
      daysLeft={weekStart === current ? 6 - weekday(user.today) : 0}
      stats={stats}
      goals={goals}
      reflection={
        reflection
          ? {
              wins: reflection.wins,
              slipped: reflection.slipped,
              learned: reflection.learned,
              energisers: reflection.energisers,
              drainers: reflection.drainers,
              next: reflection.next,
            }
          : null
      }
      hints={{ gave: [...new Set(energy.top)].slice(0, 3), drained: [...new Set(energy.bottom)].slice(0, 3) }}
    />
  );
}
