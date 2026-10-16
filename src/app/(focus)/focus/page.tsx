import { and, asc, desc, eq, isNull, lte, or } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { getGoalOptions } from "@/lib/queries";
import { getActiveSession, listDaySessions } from "./data";
import { FocusApp, type FocusOption } from "./focus-app";

export const metadata: Metadata = { title: "Focus" };

export default function FocusPage(props: PageProps<"/focus">) {
  return (
    <Suspense fallback={<FocusSkeleton />}>
      <FocusContent searchParams={props.searchParams} />
    </Suspense>
  );
}

function FocusSkeleton() {
  return (
    <div className="pt-16">
      <Skeleton className="h-12 w-40" />
      <Skeleton className="mt-8 h-20 w-full" />
      <Skeleton className="mt-3 h-20 w-full" />
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

async function FocusContent({ searchParams }: { searchParams: PageProps<"/focus">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const blockParam = one(sp.block);
  const taskParam = one(sp.task);
  const goalParam = one(sp.goal);

  const [goals, blockRows, taskRows, sessions, active] = await Promise.all([
    getGoalOptions(user.id),
    db
      .select({
        id: t.blocks.id,
        title: t.blocks.title,
        goalId: t.blocks.goalId,
        taskId: t.blocks.taskId,
        date: t.blocks.date,
        startMin: t.blocks.startMin,
        endMin: t.blocks.endMin,
        color: t.goals.color,
      })
      .from(t.blocks)
      .leftJoin(t.goals, eq(t.goals.id, t.blocks.goalId))
      .where(
        and(
          eq(t.blocks.userId, user.id),
          blockParam
            ? or(eq(t.blocks.id, blockParam), and(eq(t.blocks.date, user.today), eq(t.blocks.kind, "focus"), isNull(t.blocks.doneAt), isNull(t.blocks.skippedAt)))
            : and(eq(t.blocks.date, user.today), eq(t.blocks.kind, "focus"), isNull(t.blocks.doneAt), isNull(t.blocks.skippedAt)),
        ),
      )
      .orderBy(asc(t.blocks.startMin)),
    db
      .select({ id: t.tasks.id, title: t.tasks.title, goalId: t.tasks.goalId, estimateMin: t.tasks.estimateMin, color: t.goals.color })
      .from(t.tasks)
      .leftJoin(t.goals, eq(t.goals.id, t.tasks.goalId))
      .where(
        and(
          eq(t.tasks.userId, user.id),
          taskParam
            ? or(eq(t.tasks.id, taskParam), and(isNull(t.tasks.doneAt), lte(t.tasks.dueDate, user.today)))
            : and(isNull(t.tasks.doneAt), lte(t.tasks.dueDate, user.today)),
        ),
      )
      .orderBy(desc(t.tasks.dueDate), asc(t.tasks.sortOrder))
      .limit(12),
    listDaySessions(user.id, user.today),
    getActiveSession(user.id),
  ]);

  const options: FocusOption[] = [
    ...blockRows.map((b) => ({
      key: `block:${b.id}`,
      type: "block" as const,
      label: b.title,
      color: b.color,
      blockId: b.id,
      taskId: b.taskId,
      goalId: b.goalId,
      startMin: b.startMin,
      minutes: b.endMin - b.startMin,
    })),
    ...taskRows.map((x) => ({
      key: `task:${x.id}`,
      type: "task" as const,
      label: x.title,
      color: x.color,
      taskId: x.id,
      goalId: x.goalId,
      minutes: x.estimateMin,
    })),
    ...goals.map((g) => ({
      key: `goal:${g.id}`,
      type: "goal" as const,
      label: g.title,
      color: g.color,
      goalId: g.id,
    })),
  ];

  const initialKey = blockParam
    ? `block:${blockParam}`
    : taskParam
      ? `task:${taskParam}`
      : goalParam
        ? `goal:${goalParam}`
        : null;

  return (
    <FocusApp
      options={options}
      initialKey={options.some((o) => o.key === initialKey) ? initialKey : null}
      sessions={sessions}
      active={active ?? null}
      timezone={user.timezone}
    />
  );
}
