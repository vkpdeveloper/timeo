"use client";

import { ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { setBlockDone } from "@/actions/blocks";
import type { GoalOption } from "@/actions/context";
import { setTaskDone } from "@/actions/tasks";
import { BlockSheet, TaskSheet } from "@/components/forms/sheets";
import { CheckCircle } from "@/components/ui/controls";
import type { Block, Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { formatMonthDay, formatWeekdayShort, relativeDay, toTimeInput } from "@/lib/dates";

type Props = { today: string; nowMin: number; blocks: Block[]; tasks: Task[]; goals: GoalOption[] };

// compact on desktop, still 44px tall on phones (where it opens in a sheet)
const row = "flex min-h-11 items-center gap-2.5 rounded-[10px] px-2.5 lg:min-h-8 hover:bg-sunken";
const title = "min-w-0 flex-1 truncate text-left text-[15px] text-ink lg:text-[13px]";
const meta = "tnum shrink-0 text-[12.5px] text-ink-3 lg:text-[11.5px]";
const time = "mono shrink-0 text-[12.5px] text-ink-3 lg:text-[11.5px]";

/** Today's plan and tasks beside the chat, so you can tick things off while talking to Timi. */
export function TodayPanel({ today, nowMin, blocks, tasks, goals }: Props) {
  const goalById = new Map(goals.map((g) => [g.id, g]));
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-2.5 pt-1 pb-1.5">
        <div className="truncate text-[15px] font-semibold tracking-tight text-ink lg:text-[13.5px]">
          Today <span className="font-normal text-ink-3">· {formatWeekdayShort(today)}, {formatMonthDay(today)}</span>
        </div>
        <Link
          href={`/app/plan?date=${today}`}
          aria-label="Open plan"
          className="tap grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink-2"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <PlanList blocks={blocks} goals={goals} goalById={goalById} today={today} nowMin={nowMin} />
      <div className="mx-2.5 my-1.5 h-px bg-line" />
      <TaskList tasks={tasks} goals={goals} goalById={goalById} today={today} />
    </div>
  );
}

type GoalMap = Map<string, GoalOption>;

function Group({ label, count, children }: { label: string; count?: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1 text-[12px] font-medium text-ink-3 lg:text-[11px]">
        {label}
        {count && <span className="tnum">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function AddRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn(row, "tap w-full text-[14px] text-ink-3 hover:text-ink-2 lg:text-[12.5px]")}>
      <Plus className="mx-[3px] size-3.5 shrink-0" strokeWidth={2.4} />
      {children}
    </button>
  );
}

function PlanList({ blocks, goals, goalById, today, nowMin }: Omit<Props, "tasks"> & { goalById: GoalMap }) {
  const [optimistic, setOptimistic] = useOptimistic(blocks, (state, { id, done }: { id: string; done: boolean }) =>
    state.map((b) => (b.id === id ? { ...b, doneAt: done ? Date.now() : null, skippedAt: null } : b)),
  );
  const [, start] = useTransition();
  const [editing, setEditing] = useState<Block | null>(null);
  const [adding, setAdding] = useState(false);
  // new blocks start at the next quarter hour
  const next = Math.min(23 * 60, Math.ceil((nowMin + 1) / 15) * 15);
  const done = optimistic.filter((b) => b.doneAt).length;

  return (
    <Group label="Plan" count={optimistic.length ? `${done}/${optimistic.length}` : undefined}>
      {optimistic.map((b) => {
        const goal = b.goalId ? goalById.get(b.goalId) : undefined;
        const isDone = !!b.doneAt;
        const live = !isDone && !b.skippedAt && b.startMin <= nowMin && b.endMin > nowMin;
        const past = b.endMin <= nowMin;
        return (
          <div key={b.id} className={cn(row, (past || b.skippedAt) && !isDone && !live && "opacity-60")}>
            <CheckCircle
              size={16}
              checked={isDone}
              color={goal ? colorVar(goal.color) : "var(--tint)"}
              onToggle={() =>
                start(async () => {
                  setOptimistic({ id: b.id, done: !isDone });
                  await setBlockDone(b.id, !isDone);
                })
              }
            />
            <button type="button" onClick={() => setEditing(b)} className={cn(title, (isDone || b.skippedAt) && "text-ink-3 line-through")}>
              {b.title}
            </button>
            {live && <span className="size-1.5 shrink-0 animate-pulse-soft rounded-full bg-accent" aria-label="Now" />}
            <span className={cn(time, live && "text-accent")}>{toTimeInput(b.startMin)}</span>
          </div>
        );
      })}
      <AddRow onClick={() => setAdding(true)}>Block time</AddRow>
      <BlockSheet
        open={adding}
        onClose={() => setAdding(false)}
        goals={goals}
        today={today}
        defaults={{ date: today, start: next, end: Math.min(24 * 60, next + 60) }}
      />
      {editing && <BlockSheet open onClose={() => setEditing(null)} goals={goals} today={today} block={editing} />}
    </Group>
  );
}

function TaskList({ tasks, goals, goalById, today }: { tasks: Task[]; goals: GoalOption[]; goalById: GoalMap; today: string }) {
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, { id, done }: { id: string; done: boolean }) =>
    state.map((t) => (t.id === id ? { ...t, doneAt: done ? Date.now() : null } : t)),
  );
  const [, start] = useTransition();
  const [editing, setEditing] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);
  const done = optimistic.filter((t) => t.doneAt).length;

  return (
    <Group label="Tasks" count={optimistic.length ? `${done}/${optimistic.length}` : undefined}>
      {optimistic.map((task) => {
        const goal = task.goalId ? goalById.get(task.goalId) : undefined;
        const isDone = !!task.doneAt;
        const overdue = !isDone && task.dueDate && task.dueDate < today;
        return (
          <div key={task.id} className={row}>
            <CheckCircle
              size={16}
              checked={isDone}
              color={goal ? colorVar(goal.color) : "var(--tint)"}
              onToggle={() =>
                start(async () => {
                  setOptimistic({ id: task.id, done: !isDone });
                  await setTaskDone(task.id, !isDone);
                })
              }
            />
            <button type="button" onClick={() => setEditing(task)} className={cn(title, isDone && "text-ink-3 line-through")}>
              {task.title}
            </button>
            {overdue ? (
              <span className={cn(meta, "text-warn")}>{relativeDay(task.dueDate!, today)}</span>
            ) : (
              task.dueMin != null && <span className={time}>{toTimeInput(task.dueMin)}</span>
            )}
          </div>
        );
      })}
      <AddRow onClick={() => setAdding(true)}>Add task</AddRow>
      <TaskSheet open={adding} onClose={() => setAdding(false)} goals={goals} today={today} defaults={{ dueDate: today }} />
      {editing && <TaskSheet open onClose={() => setEditing(null)} goals={goals} today={today} task={editing} />}
    </Group>
  );
}
