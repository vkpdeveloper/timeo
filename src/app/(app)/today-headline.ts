import type { Block, Task } from "@/db/schema";
import { formatDuration, formatMin } from "@/lib/dates";
import type { TodayTraining } from "@/lib/fitness";
import { coveredMinutes } from "@/lib/schedule";

/** The Today title and the line under it, read from the day itself. */
export type Headline = { title: string; line: string };

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const count = (n: number, noun: string) => `${WORDS[n] ?? n} ${noun}${n === 1 ? "" : "s"}`;

type Span = { startMin: number; endMin: number };

/** The planner day ends at 10 pm unless the user ends it earlier; blocks past it stretch it. */
export const DAY_END_CAP = 22 * 60;

/** Waking window for a day: the user's settings, capped at 10 pm, stretched to fit any block. */
export function dayBounds(dayStartMin: number, dayEndMin: number, spans: Span[]) {
  let start = dayStartMin;
  let end = Math.min(dayEndMin, DAY_END_CAP);
  for (const s of spans) {
    start = Math.min(start, s.startMin);
    end = Math.max(end, s.endMin);
  }
  return { start, end };
}

const clip = (spans: Span[], from: number, to: number) =>
  spans.flatMap((s) => {
    const a = Math.max(s.startMin, from);
    const b = Math.min(s.endMin, to);
    return b > a ? [{ startMin: a, endMin: b }] : [];
  });

/** Unblocked minutes between `from` and `to`. */
export function freeBetween(spans: Span[], from: number, to: number) {
  if (to <= from) return 0;
  return Math.max(0, to - from - coveredMinutes(clip(spans, from, to)));
}

/** Done / still planned / free minutes for one day, from `nowMin` on. */
export function dayCapacity({
  blocks,
  nowMin,
  bounds,
}: {
  blocks: Pick<Block, "startMin" | "endMin" | "doneAt" | "skippedAt">[];
  nowMin: number;
  bounds: { start: number; end: number };
}) {
  const live = blocks.filter((b) => !b.skippedAt);
  const from = Math.max(nowMin, bounds.start);
  const doneMin = coveredMinutes(live.filter((b) => b.doneAt));
  const plannedMin = coveredMinutes(
    clip(
      live.filter((b) => !b.doneAt),
      from,
      24 * 60,
    ),
  );
  const freeMin = freeBetween(live, from, bounds.end);
  return { doneMin, plannedMin, freeMin };
}

export function todayHeadline({
  nowMin,
  blocks,
  tasks,
  training,
}: {
  nowMin: number;
  blocks: Block[];
  tasks: Task[];
  training: TodayTraining;
}): Headline {
  const done = blocks.filter((b) => b.doneAt).length;
  const open = blocks.filter((b) => !b.doneAt && !b.skippedAt);
  const ahead = open.filter((b) => b.endMin > nowMin);
  const tasksLeft = tasks.filter((t) => !t.doneAt).length;
  const evening = nowMin >= 17 * 60;

  // the workout, unless a block still ahead already counts it
  const { scheduled, log } = training;
  const hasWorkoutBlock = ahead.some((b) => b.kind === "workout");
  let workout = "";
  if (log?.status === "in_progress") workout = `${log.name} in progress.`;
  else if (!log && !scheduled.isRest && !hasWorkoutBlock)
    workout =
      scheduled.startMin != null && scheduled.startMin > nowMin
        ? `${scheduled.name} at ${formatMin(scheduled.startMin, true)}.`
        : `${scheduled.name} still to do.`;
  const withWorkout = (s: string) => (workout ? `${s} ${workout}` : s);

  if (!blocks.length) {
    if (tasksLeft)
      return { title: `${count(tasksLeft, "task")}, no blocks yet.`, line: withWorkout("Give the one that matters a slot.") };
    return {
      title: "A clear day.",
      line: withWorkout(evening ? "Nothing planned. Rest counts too." : "Nothing planned yet. Block time for what matters."),
    };
  }

  if (!ahead.length) {
    const left = tasksLeft ? `${count(tasksLeft, "task")} still open.` : "Nothing left on the plan.";
    if (done === blocks.length) return { title: "Every block done.", line: withWorkout(left) };
    return { title: `${done} of ${blocks.length} blocks done.`, line: withWorkout(left) };
  }

  const clearAt = formatMin(Math.max(...ahead.map((b) => b.endMin)), true);
  const started = done > 0 || blocks.some((b) => b.startMin <= nowMin);
  if (!started) {
    const planned = blocks.reduce((sum, b) => sum + b.endMin - b.startMin, 0);
    return {
      title: `${formatDuration(planned)} planned today.`,
      line: withWorkout(`First block at ${formatMin(blocks[0].startMin, true)}, clear by ${clearAt}.`),
    };
  }

  return {
    title: `${count(ahead.length, "block")} left ${evening ? "tonight" : "today"}.`,
    line: withWorkout(done ? `${done} of ${blocks.length} done, clear by ${clearAt}.` : `Clear by ${clearAt}.`),
  };
}
