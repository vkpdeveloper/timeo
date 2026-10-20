"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { TodayTasks } from "@/app/(app)/today-tasks";
import { setBlockDone } from "@/actions/blocks";
import type { GoalOption } from "@/actions/context";
import { BlockSheet } from "@/components/forms/sheets";
import { CheckCircle } from "@/components/ui/controls";
import type { Block, Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { formatLongDate, formatMin } from "@/lib/dates";

type Props = { today: string; nowMin: number; blocks: Block[]; tasks: Task[]; goals: GoalOption[] };

/** Today's plan and tasks beside the chat, so you can tick things off while talking to Timi. */
export function TodayPanel({ today, nowMin, blocks, tasks, goals }: Props) {
  const open = tasks.filter((t) => !t.doneAt).length;
  return (
    <div className="space-y-6">
      <div className="px-1">
        <div className="eyebrow">Today</div>
        <div className="mt-1 text-[17px] font-semibold tracking-tight text-ink">{formatLongDate(today)}</div>
      </div>
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <span className="eyebrow">Plan</span>
          <Link href={`/plan?date=${today}`} className="text-[12.5px] font-medium text-ink-3 hover:text-ink-2">
            Open
          </Link>
        </div>
        <PlanList blocks={blocks} goals={goals} today={today} nowMin={nowMin} />
      </section>
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <span className="eyebrow">Tasks</span>
          {tasks.length > 0 && <span className="tnum text-[12.5px] text-ink-3">{open ? `${open} open` : "All done"}</span>}
        </div>
        <TodayTasks tasks={tasks} goals={goals} today={today} />
      </section>
    </div>
  );
}

function PlanList({ blocks, goals, today, nowMin }: Omit<Props, "tasks">) {
  const [optimistic, setOptimistic] = useOptimistic(blocks, (state, { id, done }: { id: string; done: boolean }) =>
    state.map((b) => (b.id === id ? { ...b, doneAt: done ? Date.now() : null, skippedAt: null } : b)),
  );
  const [, start] = useTransition();
  const [editing, setEditing] = useState<Block | null>(null);
  const [adding, setAdding] = useState(false);
  const goalById = new Map(goals.map((g) => [g.id, g]));
  // new blocks start at the next quarter hour
  const next = Math.min(23 * 60, Math.ceil((nowMin + 1) / 15) * 15);

  return (
    <>
      <div className="card overflow-hidden">
        {optimistic.length === 0 && <div className="px-4 py-5 text-center text-[14px] text-ink-3">Nothing blocked yet.</div>}
        {optimistic.map((b) => {
          const goal = b.goalId ? goalById.get(b.goalId) : undefined;
          const done = !!b.doneAt;
          const live = !done && !b.skippedAt && b.startMin <= nowMin && b.endMin > nowMin;
          const past = b.endMin <= nowMin;
          return (
            <div
              key={b.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line",
                (past || b.skippedAt) && !done && !live && "opacity-60",
              )}
            >
              <CheckCircle
                checked={done}
                color={goal ? colorVar(goal.color) : "var(--ink)"}
                onToggle={() =>
                  start(async () => {
                    setOptimistic({ id: b.id, done: !done });
                    await setBlockDone(b.id, !done);
                  })
                }
              />
              <button type="button" onClick={() => setEditing(b)} className="min-w-0 flex-1 text-left">
                <div className={cn("truncate text-[15px] text-ink transition-colors", (done || b.skippedAt) && "text-ink-3 line-through")}>
                  {b.title}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-3">
                  <span className="tnum shrink-0">
                    {formatMin(b.startMin, true)}–{formatMin(b.endMin, true)}
                  </span>
                  {goal && (
                    <>
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: colorVar(goal.color) }} />
                      <span className="truncate">{goal.title}</span>
                    </>
                  )}
                </div>
              </button>
              {live && <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" aria-label="Now" />}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="tap flex w-full items-center gap-3 border-t border-line px-4 py-3 text-[14.5px] font-medium text-ink-3 active:bg-sunken"
        >
          <span className="grid size-6 place-items-center rounded-full bg-sunken">
            <Plus className="size-3.5" strokeWidth={2.6} />
          </span>
          Block time
        </button>
      </div>
      <BlockSheet
        open={adding}
        onClose={() => setAdding(false)}
        goals={goals}
        today={today}
        defaults={{ date: today, start: next, end: Math.min(24 * 60, next + 60) }}
      />
      {editing && <BlockSheet open onClose={() => setEditing(null)} goals={goals} today={today} block={editing} />}
    </>
  );
}
