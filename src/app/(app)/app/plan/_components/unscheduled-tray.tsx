"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { formatDuration, toTimeInput } from "@/lib/dates";
import { usePlan } from "./plan-provider";
import type { GoalInfo, UnscheduledTask } from "./types";

const KEY = "timeo.plan.tray";

export function UnscheduledTray({ date, tasks, goals }: { date: string; tasks: UnscheduledTask[]; goals: GoalInfo[] }) {
  const { openNew } = usePlan();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a per-viewer preference after hydration
      if (localStorage.getItem(KEY) === "closed") setOpen(false);
    } catch {}
  }, []);

  if (tasks.length === 0) return null;
  const goalById = new Map(goals.map((g) => [g.id, g]));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(KEY, next ? "open" : "closed");
    } catch {}
  };

  return (
    <section className="card mt-4 overflow-hidden">
      <button type="button" onClick={toggle} className="tap flex w-full items-center gap-2.5 px-4 py-3 text-left" aria-expanded={open}>
        <span className="text-[14px] font-semibold tracking-tight text-ink">Unscheduled</span>
        <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-sunken px-1.5 text-[11.5px] font-semibold text-ink-2">
          {tasks.length}
        </span>
        <span className="ml-auto text-[12.5px] text-ink-3">{open ? "" : "Give these a time"}</span>
        <ChevronDown className={cn("size-4 text-ink-3 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 34, stiffness: 380 }}
            className="overflow-hidden"
          >
            <ul className="border-t border-line">
              {tasks.map((task) => {
                const goal = task.goalId ? goalById.get(task.goalId) : undefined;
                const minutes = task.estimateMin ?? 60;
                return (
                  <li key={task.id} className="flex items-center gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: goal ? colorVar(goal.color) : "var(--line-strong)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-ink">{task.title}</div>
                      <div className="tnum truncate text-[12px] text-ink-3">
                        {task.overdue && <span className="font-medium text-warn">Overdue, </span>}
                        {formatDuration(minutes)}
                        {task.slot && (
                          <>
                            {", free at "}
                            <span className="mono">{toTimeInput(task.slot.start)}</span>
                          </>
                        )}
                        
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openNew({
                          date,
                          start: task.slot?.start ?? 9 * 60,
                          end: task.slot?.end ?? 9 * 60 + minutes,
                          title: task.title,
                          goalId: task.goalId ?? undefined,
                          taskId: task.id,
                        })
                      }
                      className="tap inline-flex h-11 shrink-0 items-center px-2 text-[13.5px] font-semibold text-accent"
                    >
                      Schedule
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
