import type { Block, Task } from "@/db/schema";
import { formatDuration, formatMin } from "@/lib/dates";
import type { TodayTraining } from "@/lib/fitness";

/** The Today title, read from the day itself: `em` is set in italic, then `rest`, then a plain `line`. */
export type Headline = { em: string; rest: string; line: string };

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const count = (n: number, noun: string) => `${WORDS[n] ?? n} ${noun}${n === 1 ? "" : "s"}`;

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
    workout = scheduled.startMin != null && scheduled.startMin > nowMin ? `${scheduled.name} at ${formatMin(scheduled.startMin, true)}.` : `${scheduled.name} still to do.`;
  const withWorkout = (s: string) => (workout ? `${s} ${workout}` : s);

  if (!blocks.length) {
    if (tasksLeft) return { em: count(tasksLeft, "task"), rest: ", no blocks yet.", line: withWorkout("Give the one that matters a slot.") };
    return {
      em: "A clear",
      rest: " day.",
      line: withWorkout(evening ? "Nothing planned. Rest counts too." : "Nothing planned yet. Block time for what matters."),
    };
  }

  if (!ahead.length) {
    const left = tasksLeft ? `${count(tasksLeft, "task")} still open.` : "Nothing left on the plan.";
    if (done === blocks.length) return { em: "Every block", rest: " done.", line: withWorkout(left) };
    return { em: `${done} of ${blocks.length}`, rest: " blocks done.", line: withWorkout(left) };
  }

  const clearAt = formatMin(Math.max(...ahead.map((b) => b.endMin)), true);
  const started = done > 0 || blocks.some((b) => b.startMin <= nowMin);
  if (!started) {
    const planned = blocks.reduce((sum, b) => sum + b.endMin - b.startMin, 0);
    return {
      em: formatDuration(planned),
      rest: " planned today.",
      line: withWorkout(`First block at ${formatMin(blocks[0].startMin, true)}, clear by ${clearAt}.`),
    };
  }

  return {
    em: ahead.length === 1 ? "One block" : count(ahead.length, "block"),
    rest: ` left ${evening ? "tonight" : "today"}.`,
    line: withWorkout(done ? `${done} of ${blocks.length} done, clear by ${clearAt}.` : `Clear by ${clearAt}.`),
  };
}
