import { and, asc, eq, isNull, lt, or } from "drizzle-orm";
import { ArrowRight, Play, Settings2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CommandBar } from "@/components/ai/command-bar";
import { Card, Section, SectionLink, Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import type { Block } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { colorVar, softVar } from "@/lib/colors";
import { formatDuration, formatLongDate, formatMin, greeting, nowMinIn } from "@/lib/dates";
import { getActiveSeason, getGoalOptions, seasonProgress } from "@/lib/queries";
import { TodayTasks } from "./today-tasks";

export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const user = await requireUser();
  const nowMin = nowMinIn(user.timezone);
  const [season, goals, blocks, tasks] = await Promise.all([
    getActiveSeason(user.id),
    getGoalOptions(user.id),
    db
      .select()
      .from(t.blocks)
      .where(and(eq(t.blocks.userId, user.id), eq(t.blocks.date, user.today)))
      .orderBy(asc(t.blocks.startMin)),
    db
      .select()
      .from(t.tasks)
      .where(
        and(
          eq(t.tasks.userId, user.id),
          or(eq(t.tasks.dueDate, user.today), and(lt(t.tasks.dueDate, user.today), isNull(t.tasks.doneAt))),
        ),
      )
      .orderBy(asc(t.tasks.doneAt), asc(t.tasks.dueMin), asc(t.tasks.createdAt)),
  ]);
  const progress = season ? seasonProgress(season, user.today) : null;
  const goalById = new Map(goals.map((g) => [g.id, g]));

  return (
    <div className="fade-up">
      <header className="flex items-start justify-between gap-4 pt-6 pb-5 lg:pt-10">
        <div className="min-w-0">
          <div className="eyebrow mb-1.5">{formatLongDate(user.today)}</div>
          <h1 className="display text-[38px] text-ink lg:text-[46px]">
            {greeting(nowMin)},<br />
            <span className="text-ink-2 italic">{user.name.split(" ")[0]}</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {progress && (
            <Link href="/goals" className="tap rounded-full bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-2 shadow-soft ring-1 ring-line">
              Day {progress.day}
              <span className="text-ink-3"> / {progress.total}</span>
            </Link>
          )}
          <Link href="/settings" aria-label="Settings" className="tap grid size-9 place-items-center rounded-full bg-surface text-ink-2 shadow-soft ring-1 ring-line">
            <Settings2 className="size-[17px]" />
          </Link>
        </div>
      </header>

      <CommandBar />

      {!season && (
        <Card className="mt-5 overflow-hidden p-5">
          <div className="eyebrow">Start here</div>
          <p className="mt-1.5 text-[17px] font-semibold tracking-tight text-ink">Plan your 12-week season</p>
          <p className="mt-1 text-[14px] text-ink-3">Pick 2–3 goals. Give them time on your calendar.</p>
          <Link href="/goals/setup" className="tap mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-bg">
            Set up season <ArrowRight className="size-4" />
          </Link>
        </Card>
      )}

      <NowNext blocks={blocks} nowMin={nowMin} goalById={goalById} />

      <Section title="Today" action={<SectionLink href="/plan">Plan</SectionLink>}>
        <Agenda blocks={blocks} nowMin={nowMin} goalById={goalById} />
      </Section>

      <Section title="Tasks">
        <TodayTasks tasks={tasks} goals={goals} today={user.today} />
      </Section>
    </div>
  );
}

type GoalMap = Map<string, { id: string; title: string; color: string }>;

function NowNext({ blocks, nowMin, goalById }: { blocks: Block[]; nowMin: number; goalById: GoalMap }) {
  const open = blocks.filter((b) => !b.doneAt && !b.skippedAt);
  const now = open.find((b) => b.startMin <= nowMin && b.endMin > nowMin);
  const next = open.find((b) => b.startMin > nowMin);
  const b = now ?? next;
  if (!b) return null;
  const goal = b.goalId ? goalById.get(b.goalId) : undefined;
  const color = goal ? goal.color : "slate";
  const pct = now ? (nowMin - b.startMin) / (b.endMin - b.startMin) : 0;
  return (
    <div
      className="card mt-5 overflow-hidden p-4"
      style={{ background: `linear-gradient(135deg, ${softVar(color)} 0%, var(--surface) 70%)` }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold" style={{ color: colorVar(color) }}>
            {now ? `Now · until ${formatMin(b.endMin)}` : `Next · ${formatMin(b.startMin)} (in ${formatDuration(b.startMin - nowMin)})`}
          </div>
          <div className="mt-0.5 truncate text-[17px] font-semibold tracking-tight text-ink">{b.title}</div>
          {goal && <div className="mt-0.5 truncate text-[13px] text-ink-3">{goal.title}</div>}
        </div>
        {(b.kind === "focus" || b.kind === "admin") && (
          <Link
            href={`/focus?block=${b.id}`}
            className="tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-white"
            style={{ background: colorVar(color) }}
          >
            <Play className="size-3.5 fill-current" /> Focus
          </Link>
        )}
        {b.kind === "workout" && (
          <Link href="/fitness" className="tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-bg">
            Train
          </Link>
        )}
      </div>
      {now && (
        <div className="mt-3.5 h-1 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: colorVar(color) }} />
        </div>
      )}
    </div>
  );
}

function Agenda({ blocks, nowMin, goalById }: { blocks: Block[]; nowMin: number; goalById: GoalMap }) {
  if (!blocks.length) {
    return (
      <Link href="/plan" className="card tap flex items-center justify-between px-4 py-4 text-[14px] text-ink-3">
        Nothing blocked yet. Give your goals a slot.
        <ArrowRight className="size-4" />
      </Link>
    );
  }
  return (
    <div className="card overflow-hidden py-1.5">
      {blocks.map((b) => {
        const goal = b.goalId ? goalById.get(b.goalId) : undefined;
        const past = b.endMin <= nowMin;
        const live = b.startMin <= nowMin && b.endMin > nowMin;
        return (
          <Link
            key={b.id}
            href={`/plan?date=${b.date}`}
            className={cn("tap flex items-center gap-3 px-4 py-2.5 active:bg-sunken", (past || b.skippedAt) && !live && "opacity-55")}
          >
            <div className="tnum w-[62px] shrink-0 text-[12.5px] font-medium text-ink-3">{formatMin(b.startMin, true)}</div>
            <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: goal ? colorVar(goal.color) : "var(--line-strong)" }} />
            <div className="min-w-0 flex-1">
              <div className={cn("truncate text-[14.5px] font-medium text-ink", (b.doneAt || b.skippedAt) && "line-through decoration-ink-3")}>
                {b.title}
              </div>
              <div className="text-[12px] text-ink-3">{formatDuration(b.endMin - b.startMin)}{goal ? ` · ${goal.title}` : ""}</div>
            </div>
            {live && <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />}
          </Link>
        );
      })}
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="pt-6 lg:pt-10">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 h-20 w-56" />
      <Skeleton className="mt-6 h-[54px] rounded-[22px]" />
      <Skeleton className="mt-5 h-24" />
      <Skeleton className="mt-8 h-40" />
      <Skeleton className="mt-8 h-32" />
    </div>
  );
}
