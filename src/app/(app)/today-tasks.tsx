"use client";

import { Plus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import type { GoalOption } from "@/actions/context";
import { setTaskDone } from "@/actions/tasks";
import { TaskSheet } from "@/components/forms/sheets";
import { CheckCircle } from "@/components/ui/controls";
import type { Task } from "@/db/schema";
import { colorVar } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { formatMin, relativeDay } from "@/lib/dates";

export function TodayTasks({ tasks, goals, today }: { tasks: Task[]; goals: GoalOption[]; today: string }) {
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, { id, done }: { id: string; done: boolean }) =>
    state.map((t) => (t.id === id ? { ...t, doneAt: done ? Date.now() : null } : t)),
  );
  const [, start] = useTransition();
  const [editing, setEditing] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);
  const goalById = new Map(goals.map((g) => [g.id, g]));

  return (
    <>
      <div className="card overflow-hidden">
        {optimistic.length === 0 && (
          <div className="px-4 py-5 text-center text-[14px] text-ink-3">Nothing due. Add one thing that matters.</div>
        )}
        {optimistic.map((task) => {
          const goal = task.goalId ? goalById.get(task.goalId) : undefined;
          const done = !!task.doneAt;
          const overdue = !done && task.dueDate && task.dueDate < today;
          return (
            <div key={task.id} className="flex items-center gap-3 px-4 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
              <CheckCircle
                checked={done}
                color={goal ? colorVar(goal.color) : "var(--ink)"}
                onToggle={() =>
                  start(async () => {
                    setOptimistic({ id: task.id, done: !done });
                    await setTaskDone(task.id, !done);
                  })
                }
              />
              <button type="button" onClick={() => setEditing(task)} className="min-w-0 flex-1 text-left">
                <div className={cn("truncate text-[15px] text-ink transition-colors", done && "text-ink-3 line-through")}>{task.title}</div>
                {(goal || task.dueMin != null || overdue) && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-3">
                    {goal && (
                      <>
                        <span className="size-1.5 rounded-full" style={{ background: colorVar(goal.color) }} />
                        <span className="truncate">{goal.title}</span>
                      </>
                    )}
                    {task.dueMin != null && <span>{goal && "· "}{formatMin(task.dueMin)}</span>}
                    {overdue && <span className="font-medium text-bad">{(goal || task.dueMin != null) && "· "}{relativeDay(task.dueDate!, today)}</span>}
                  </div>
                )}
              </button>
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
          Add task
        </button>
      </div>
      <TaskSheet open={adding} onClose={() => setAdding(false)} goals={goals} today={today} />
      {editing && <TaskSheet open onClose={() => setEditing(null)} goals={goals} today={today} task={editing} />}
    </>
  );
}
