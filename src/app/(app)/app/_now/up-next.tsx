"use client";

import { ChevronDown, Plus } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useOptimistic, useState, useTransition } from "react";
import type { GoalOption } from "@/actions/context";
import { setTaskDone } from "@/actions/tasks";
import { BlockSheet, TaskSheet } from "@/components/forms/sheets";
import { CheckCircle } from "@/components/ui/controls";
import { springs, useReducedMotion } from "@/components/ui/motion";
import type { Block, Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { formatDuration, relativeDay, toTimeInput } from "@/lib/dates";

type Goal = { title: string; color: string };

type Item =
  | { key: string; type: "block"; min: number; block: Block; goal?: Goal; state: "open" | "done" | "skipped" | "missed" }
  | { key: string; type: "task"; min: number | null; task: Task; goal?: Goal; state: "open" | "done" };

const KIND_NAME: Record<Block["kind"], string> = {
  focus: "Focus",
  meeting: "Meeting",
  workout: "Workout",
  meal: "Meal",
  life: "Life",
  admin: "Admin",
};

/**
 * The rest of today in one list: blocks and tasks by time, tasks without a
 * time last. Checked tasks slide into the collapsed "done" group.
 */
export function UpNext({
  blocks,
  tasks,
  goals,
  today,
  nowMin,
  heroId,
}: {
  blocks: Block[];
  tasks: Task[];
  goals: GoalOption[];
  today: string;
  nowMin: number;
  /** The block shown in the hero; it is not repeated here. */
  heroId?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, { id, done }: { id: string; done: boolean }) =>
    state.map((t) => (t.id === id ? { ...t, doneAt: done ? Date.now() : null } : t)),
  );
  const [, start] = useTransition();
  const [showDone, setShowDone] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [adding, setAdding] = useState(false);
  const reduce = useReducedMotion();

  const goalById = new Map(goals.map((g) => [g.id, g]));
  const goalOf = (id: string | null) => (id ? goalById.get(id) : undefined);

  const items: Item[] = [
    ...blocks
      .filter((b) => b.id !== heroId)
      .map((b): Item => ({
        key: `b${b.id}`,
        type: "block",
        min: b.startMin,
        block: b,
        goal: goalOf(b.goalId),
        state: b.doneAt ? "done" : b.skippedAt ? "skipped" : b.endMin <= nowMin ? "missed" : "open",
      })),
    ...optimistic.map((task): Item => ({
      key: `t${task.id}`,
      type: "task",
      min: task.dueMin,
      task,
      goal: goalOf(task.goalId),
      state: task.doneAt ? "done" : "open",
    })),
  ];
  // timed by minute, untimed after in the server's order (Array.sort is stable)
  const byTime = (a: Item, b: Item) => (a.min ?? 1e6) - (b.min ?? 1e6);
  const open = items.filter((i) => i.state === "open").sort(byTime);
  const past = items.filter((i) => i.state !== "open").sort(byTime);
  const timed = open.filter((i) => i.min != null);
  const anytime = open.filter((i) => i.min == null);
  const doneCount = past.filter((i) => i.state === "done").length;
  const missedCount = past.length - doneCount;

  const toggle = (task: Task) => {
    const done = !task.doneAt;
    start(async () => {
      setOptimistic({ id: task.id, done });
      await setTaskDone(task.id, done);
    });
  };

  const row = (item: Item, i: number) => (
    <motion.div
      key={item.key}
      layout="position"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ ...springs.smooth, delay: reduce ? 0 : Math.min(i, 10) * 0.035 }}
    >
      <ItemRow
        item={item}
        today={today}
        nowMin={nowMin}
        onToggle={item.type === "task" ? () => toggle(item.task) : undefined}
        onOpen={() => (item.type === "task" ? setEditingTask(item.task) : setEditingBlock(item.block))}
      />
    </motion.div>
  );

  return (
    <section className="mt-12">
      <h2 className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight text-ink">
        Up next
        {open.length > 0 && <span className="tnum text-[13px] font-medium text-ink-3">{open.length}</span>}
      </h2>
      <LayoutGroup>
        <div className="mt-2">
          <AnimatePresence initial={!reduce} mode="popLayout">
            {timed.map((item, i) => row(item, i))}
            {anytime.length > 0 && timed.length > 0 && (
              <motion.div key="anytime" layout="position" className="eyebrow pt-4 pb-1">
                Anytime
              </motion.div>
            )}
            {anytime.map((item, i) => row(item, timed.length + i))}
          </AnimatePresence>
          {open.length === 0 && (
            <p className="py-3 text-[15px] text-ink-3">Nothing else today.</p>
          )}

          <motion.button
            layout="position"
            type="button"
            onClick={() => setAdding(true)}
            className="tap-row -mx-2 flex min-h-12 w-[calc(100%+16px)] items-center gap-3.5 rounded-[12px] px-2 text-[14.5px] font-medium text-ink-3"
          >
            <span className="grid size-[22px] place-items-center rounded-full bg-sunken">
              <Plus className="size-3.5" strokeWidth={2.6} />
            </span>
            Add task
          </motion.button>

          {past.length > 0 && (
            <motion.div layout="position" className="mt-1">
              <button
                type="button"
                aria-expanded={showDone}
                onClick={() => setShowDone((v) => !v)}
                className="tap -mx-2 flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13.5px] font-medium text-ink-3"
              >
                <span className="tnum">
                  {doneCount} done{missedCount > 0 && ` · ${missedCount} missed`}
                </span>
                <ChevronDown className={cn("size-4 transition-transform duration-200", showDone && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {showDone && (
                  <motion.div
                    key="done"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={springs.smooth}
                    className="overflow-hidden"
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {past.map((item) => row(item, 0))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </LayoutGroup>

      <TaskSheet open={adding} onClose={() => setAdding(false)} goals={goals} today={today} />
      {editingTask && (
        <TaskSheet open onClose={() => setEditingTask(null)} goals={goals} today={today} task={editingTask} />
      )}
      {editingBlock && (
        <BlockSheet open onClose={() => setEditingBlock(null)} goals={goals} today={today} block={editingBlock} />
      )}
    </section>
  );
}

function ItemRow({
  item,
  today,
  nowMin,
  onToggle,
  onOpen,
}: {
  item: Item;
  today: string;
  nowMin: number;
  onToggle?: () => void;
  onOpen: () => void;
}) {
  const quiet = item.state !== "open";
  const color = item.goal ? colorVar(item.goal.color) : undefined;
  const late = item.type === "task" && item.state === "open" && item.min != null && item.min < nowMin;
  const overdue = item.type === "task" && item.state === "open" && item.task.dueDate != null && item.task.dueDate < today;
  const title = item.type === "task" ? item.task.title : item.block.title;

  const meta: React.ReactNode[] = [];
  if (item.type === "block") {
    meta.push(formatDuration(item.block.endMin - item.block.startMin));
    meta.push(item.goal?.title ?? KIND_NAME[item.block.kind]);
  } else {
    if (item.goal) meta.push(item.goal.title);
    if (overdue)
      meta.push(
        <span key="due" className="font-medium text-warn">
          {relativeDay(item.task.dueDate!, today)}
        </span>,
      );
  }

  return (
    <div className="-mx-2 flex min-h-[56px] items-center gap-3.5 rounded-[12px] px-2">
      <span className="grid w-[22px] shrink-0 place-items-center">
        {item.type === "task" ? (
          <CheckCircle
            checked={item.state === "done"}
            size={22}
            color={color ?? "var(--ink-2)"}
            label={item.state === "done" ? `Mark ${title} as not done` : `Mark ${title} as done`}
            onToggle={onToggle}
          />
        ) : (
          <span
            className={cn("h-7 w-[3px] rounded-full", quiet && "opacity-50")}
            style={{ background: color ?? "var(--line-strong)" }}
          />
        )}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="tap-row -my-1 flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[10px] py-1 pr-1 text-left"
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[15.5px] transition-colors duration-200",
              quiet ? "text-ink-3" : "text-ink",
              (item.state === "skipped" || (item.type === "task" && item.state === "done")) && "line-through decoration-ink-3",
            )}
          >
            {title}
          </span>
          {meta.length > 0 && (
            <span className={cn("tnum mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-3", quiet && "opacity-70")}>
              {item.type === "task" && color && <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />}
              <span className="truncate">
                {meta.map((m, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    {m}
                  </span>
                ))}
              </span>
            </span>
          )}
        </span>
        {item.type === "block" && (item.state === "skipped" || item.state === "missed") ? (
          <span className="shrink-0 text-[12.5px] text-ink-3">{item.state === "skipped" ? "Skipped" : "Missed"}</span>
        ) : (
          item.min != null && (
            <span className={cn("mono shrink-0 text-[13px]", late ? "text-warn" : "text-ink-3", quiet && "opacity-60")}>
              {toTimeInput(item.min % 1440)}
            </span>
          )
        )}
      </button>
    </div>
  );
}
