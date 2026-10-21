import { and, eq } from "drizzle-orm";
import { Dumbbell, Moon, NotebookPen } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { InstallBanner } from "@/components/shell/install";
import { AvatarLink, CardList, DayLine, Row, Skeleton, type DaySegment } from "@/components/ui/primitives";
import { db, t } from "@/db";
import type { Block } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getGoalHealth } from "@/lib/coach";
import { colorVar } from "@/lib/colors";
import { addDays, formatDuration, formatWeekdayShort, nowMinIn, toUTCDate } from "@/lib/dates";
import { getTodayTraining, type TodayTraining } from "@/lib/fitness";
import { getActiveSeason, getDayBlocks, getGoalOptions, getTodayTasks, seasonProgress } from "@/lib/queries";
import { NowHero, type HeroBlock, type HeroView } from "./_now/hero";
import { UpNext } from "./_now/up-next";
import { CoachAction } from "./goals/[id]/goal-client";
import { dayBounds, dayCapacity, heroChangesAt, pickHero } from "./today-headline";

export default function NowPage() {
  return (
    <Suspense fallback={<NowSkeleton />}>
      <Now />
    </Suspense>
  );
}

/** The evening check-in shows from this minute of the day. */
const EVENING_MIN = 18 * 60;

const KIND_NAME: Record<Block["kind"], string> = {
  focus: "Focus",
  meeting: "Meeting",
  workout: "Workout",
  meal: "Meal",
  life: "Life",
  admin: "Admin",
};

const fmtDayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One reading of the clock: unix ms and the minute of the day in the user's timezone. */
function readClock(timezone: string) {
  const now = new Date();
  return { serverNow: now.getTime(), nowMin: nowMinIn(timezone, now) };
}

async function Now() {
  const user = await requireUser();
  const { serverNow, nowMin } = readClock(user.timezone);
  const tomorrow = addDays(user.today, 1);
  const [season, goals, blocks, tasks, health, training, sessions, reflection, tomorrowBlocks] = await Promise.all([
    getActiveSeason(user.id),
    getGoalOptions(user.id),
    getDayBlocks(user.id, user.today),
    getTodayTasks(user.id, user.today),
    getGoalHealth(user.id, user.today),
    getTodayTraining(user.id, user.today),
    db
      .select({ focusedMin: t.focusSessions.focusedMin })
      .from(t.focusSessions)
      .where(and(eq(t.focusSessions.userId, user.id), eq(t.focusSessions.date, user.today))),
    db
      .select({ id: t.reflections.id })
      .from(t.reflections)
      .where(and(eq(t.reflections.userId, user.id), eq(t.reflections.kind, "daily"), eq(t.reflections.date, user.today)))
      .get(),
    getDayBlocks(user.id, tomorrow),
  ]);

  const goalById = new Map(goals.map((g) => [g.id, g]));
  const goalOf = (b: Pick<Block, "goalId">) => (b.goalId ? goalById.get(b.goalId) : undefined);
  const colorOf = (b: Pick<Block, "goalId">) => colorVar(goalOf(b)?.color ?? "stone");

  const live = blocks.filter((b) => !b.skippedAt);
  const bounds = dayBounds(user.dayStartMin, user.dayEndMin, live);
  const cap = dayCapacity({ blocks, nowMin, bounds });
  const hero = pickHero({ blocks, nowMin, bounds });

  // Block minutes -> unix ms. Every real timezone offset is whole minutes, so the
  // current UTC minute boundary is the local one too.
  const minuteStart = serverNow - (serverNow % 60_000);
  const at = (min: number) => minuteStart + (min - nowMin) * 60_000;
  const heroBlock = (b: Block): HeroBlock => ({
    id: b.id,
    title: b.title,
    kind: b.kind,
    startMin: b.startMin,
    endMin: b.endMin,
    startAt: at(b.startMin),
    endAt: at(b.endMin),
    context: goalOf(b)?.title ?? KIND_NAME[b.kind],
    color: goalOf(b) ? colorOf(b) : "var(--accent)",
  });

  const blocksDone = live.filter((b) => b.doneAt).length;
  const blocksLeft = live.filter((b) => !b.doneAt && b.endMin > nowMin).length;
  const tasksLeft = tasks.filter((x) => !x.doneAt).length;
  const focusMin = sessions.reduce((s, f) => s + f.focusedMin, 0);
  const firstTomorrow = tomorrowBlocks.find((b) => !b.skippedAt);

  const view: HeroView =
    hero.kind === "now" || hero.kind === "next"
      ? { kind: hero.kind, block: heroBlock(hero.block) }
      : hero.kind === "free"
        ? {
            kind: "free",
            until: hero.until,
            freeMin: hero.freeMin,
            next: hero.next ? { title: hero.next.title, color: colorOf(hero.next) } : null,
            empty: live.length === 0,
          }
        : {
            kind: "done",
            line: [
              live.length ? `${blocksDone} of ${plural(live.length, "block")} done` : "",
              focusMin ? `${formatDuration(focusMin)} focused` : "",
            ]
              .filter(Boolean)
              .join(" · "),
            tomorrow: firstTomorrow
              ? { title: firstTomorrow.title, startMin: firstTomorrow.startMin, color: colorOf(firstTomorrow) }
              : null,
          };
  const changesAt = heroChangesAt(hero, bounds);

  const segments: DaySegment[] = blocks.map((b) => ({
    start: b.startMin,
    end: b.endMin,
    color: colorOf(b),
    state: b.doneAt
      ? "done"
      : b.skippedAt || b.endMin <= nowMin
        ? "skipped"
        : b.startMin <= nowMin
          ? "now"
          : "upcoming",
    label: b.title,
  }));
  const summary = [
    nowMin < bounds.end && cap.freeMin > 0 ? `${formatDuration(cap.freeMin)} free` : "",
    blocksLeft
      ? `${plural(blocksLeft, "block")} left`
      : !live.length
        ? ""
        : blocksDone === live.length
          ? "All blocks done"
          : `${blocksDone} of ${plural(live.length, "block")} done`,
    tasksLeft ? plural(tasksLeft, "task") : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const drifting = health.find((h) => h.autoStatus !== "on_track" && h.recommendation);
  const progress = season ? seasonProgress(season, user.today) : null;
  const weeks = progress ? Math.ceil(progress.total / 7) : 0;
  const dateLine = `${formatWeekdayShort(user.today)} ${fmtDayMonth.format(toUTCDate(user.today))}${progress ? ` · Week ${progress.week} of ${weeks}` : ""}`;

  return (
    <div className="mx-auto max-w-[600px] pb-10">
      <header className="flex items-center justify-between gap-3 pt-4 lg:pt-9">
        <p className="tnum text-[14px] font-medium text-ink-2">{dateLine}</p>
        <AvatarLink name={user.name} />
      </header>

      <NowHero view={view} serverNow={serverNow} refreshAt={changesAt == null ? null : at(changesAt)} />

      <DayLine
        className="rise mt-12"
        dayStart={bounds.start}
        dayEnd={bounds.end}
        nowMin={nowMin}
        marks={[12 * 60, 18 * 60]}
        segments={segments}
        summary={summary || undefined}
      />

      <UpNext
        blocks={blocks}
        tasks={tasks}
        goals={goals}
        today={user.today}
        nowMin={nowMin}
        heroId={hero.kind === "now" || hero.kind === "next" ? hero.block.id : undefined}
      />

      {drifting?.recommendation ? (
        <div className="rise mt-10 border-t border-line pt-5">
          <p className="flex min-w-0 items-center gap-2 text-[14px] text-ink-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: colorVar(drifting.goal.color) }} />
            <span className="min-w-0 truncate">
              <span className="font-medium text-ink">{drifting.goal.title}</span>
              {drifting.reasons[0]
                ? ` · ${drifting.reasons[0].charAt(0).toLowerCase()}${drifting.reasons[0].slice(1)}`
                : " needs time this week"}
            </span>
          </p>
          <div className="mt-3">
            <CoachAction
              compact
              rec={drifting.recommendation}
              ctx={{ goals, today: user.today }}
              goalTitle={drifting.goal.title}
            />
          </div>
        </div>
      ) : !season ? (
        <div className="rise mt-10 border-t border-line pt-5">
          <p className="text-[14px] text-ink-2">
            No season yet.{" "}
            <Link href="/app/goals/setup" className="font-medium text-ink underline decoration-line-strong underline-offset-4">
              Plan your 12 weeks
            </Link>
          </p>
        </div>
      ) : null}

      <CardList className="rise mt-10">
        {nowMin >= EVENING_MIN && (
          <Row
            href="/app/review"
            icon={<NotebookPen />}
            title="Evening check-in"
            subtitle={reflection ? "Done for today" : "Two taps, three lines"}
          />
        )}
        <Row
          href="/app/fitness"
          icon={training.scheduled.isRest && !training.log ? <Moon /> : <Dumbbell />}
          title={bodyTitle(training)}
          subtitle={bodyLine(training)}
        />
      </CardList>

      <InstallBanner />
    </div>
  );
}

/** "Rest day", "Push day done" */
function bodyTitle({ scheduled, log }: TodayTraining) {
  if (scheduled.isRest && !log) return "Rest day";
  const status = log?.status;
  const tail =
    status === "completed" ? " · done" : status === "skipped" ? " · skipped" : status === "in_progress" ? " · in progress" : "";
  return `${log?.name ?? scheduled.name}${tail}`;
}

/** "1,820 of 1,950 kcal · 2.3 L water" */
function bodyLine({ nutrition, water }: TodayTraining) {
  const n = (v: number) => Math.round(v).toLocaleString("en-US");
  const target = nutrition.target?.calories;
  const kcal = target ? `${n(nutrition.calories)} of ${n(target)} kcal` : `${n(nutrition.calories)} kcal`;
  return <span className="tnum">{`${kcal} · ${(water.ml / 1000).toFixed(1)} L water`}</span>;
}

function NowSkeleton() {
  return (
    <div className="mx-auto max-w-[600px]">
      <div className="flex items-center justify-between pt-4 lg:pt-9">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="size-9 rounded-full" />
      </div>
      <div className="pt-12 lg:pt-16">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-3 h-8 w-56" />
        <Skeleton className="mt-9 h-[72px] w-64" />
        <Skeleton className="mt-7 h-1 rounded-full" />
        <Skeleton className="mt-9 h-12 rounded-[12px]" />
      </div>
      <Skeleton className="mt-14 h-2.5 rounded-full" />
      <Skeleton className="mt-12 h-4 w-20" />
      <Skeleton className="mt-4 h-12" />
      <Skeleton className="mt-2 h-12" />
      <Skeleton className="mt-2 h-12" />
    </div>
  );
}
