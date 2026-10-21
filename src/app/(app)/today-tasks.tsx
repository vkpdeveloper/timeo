"use client";

import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { useOptimistic, useState, useTransition } from "react";
import type { GoalOption } from "@/actions/context";
import { setTaskDone } from "@/actions/tasks";
import { TaskSheet } from "@/components/forms/sheets";
import { CheckCircle } from "@/components/ui/controls";
import { springs } from "@/components/ui/motion";
import { Section } from "@/components/ui/primitives";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { formatMin, relativeDay } from "@/lib/dates";

/** Today's checklist. Checked tasks strike through and settle to the bottom. */
export function TodayTasks({ tasks, goals, today }: { tasks: Task[]; goals: GoalOption[]; today: string }) {
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, { id, done }: { id: string; done: boolean }) =>
    state.map((t) => (t.id === id ? { ...t, doneAt: done ? Date.now() : null } : t)),
  );
  const [, start] = useTransition();
  const [editing, setEditing] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);
  const goalById = new Map(goals.map((g) => [g.id, g]));

  // open first, in the server's order; done after
  const order = new Map(tasks.map((t, i) => [t.id, i]));
  const sorted = [...optimistic].sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || order.get(a.id)! - order.get(b.id)!);
  const left = sorted.filter((t) => !t.doneAt).length;

  return (
    <>
      <Section title="Tasks" count={tasks.length ? (left ? `${left} left` : "All done") : undefined} card>
        {sorted.length === 0 && <div className="px-4 py-4 text-[14px] text-ink-3">Nothing due. Add one thing that matters.</div>}
        {sorted.map((task) => {
          const goal = task.goalId ? goalById.get(task.goalId) : undefined;
          const done = !!task.doneAt;
          const overdue = !done && task.dueDate && task.dueDate < today;
          const meta = goal || task.dueMin != null || overdue;
          return (
            <motion.div
              key={task.id}
              layout="position"
              transition={springs.smooth}
              className="flex min-h-[52px] items-center gap-3 bg-surface px-4 py-1"
            >
              <CheckCircle
                checked={done}
                size={22}
                color={goal ? colorVar(goal.color) : "var(--ink-2)"}
                label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
                onToggle={() =>
                  start(async () => {
                    setOptimistic({ id: task.id, done: !done });
                    await setTaskDone(task.id, !done);
                  })
                }
              />
              <button
                type="button"
                onClick={() => setEditing(task)}
                className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-1 text-left"
              >
                <span className="relative max-w-full self-start">
                  <span
                    className={cn("block truncate text-[15px] transition-colors duration-200", done ? "text-ink-3" : "text-ink")}
                  >
                    {task.title}
                  </span>
                  <motion.span
                    aria-hidden
                    className="absolute inset-x-0 top-1/2 h-px origin-left bg-ink-3"
                    initial={false}
                    animate={{ scaleX: done ? 1 : 0 }}
                    transition={springs.snappy}
                  />
                </span>
                {meta && (
                  <span
                    className={cn(
                      "mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-3 transition-opacity",
                      done && "opacity-60",
                    )}
                  >
                    {goal && (
                      <>
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: colorVar(goal.color) }} />
                        <span className="truncate">{goal.title}</span>
                      </>
                    )}
                    {task.dueMin != null && (
                      <span className="tnum shrink-0">
                        {goal && "· "}
                        {formatMin(task.dueMin, true)}
                      </span>
                    )}
                    {overdue && (
                      <span className="shrink-0 font-medium text-bad">
                        {(goal || task.dueMin != null) && "· "}
                        {relativeDay(task.dueDate!, today)}
                      </span>
                    )}
                  </span>
                )}
              </button>
            </motion.div>
          );
        })}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="tap-row flex min-h-12 w-full items-center gap-3 px-4 text-[14.5px] font-medium text-ink-3"
        >
          <span className="grid size-[22px] place-items-center rounded-full bg-sunken">
            <Plus className="size-3.5" strokeWidth={2.6} />
          </span>
          Add task
        </button>
      </Section>
      <TaskSheet open={adding} onClose={() => setAdding(false)} goals={goals} today={today} />
      {editing && <TaskSheet open onClose={() => setEditing(null)} goals={goals} today={today} task={editing} />}
    </>
  );
}
