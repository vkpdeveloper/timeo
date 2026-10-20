import "server-only";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { db, t } from "@/db";

// A block stands for a task through blocks.taskId. Blocks made from a task carry the link; blocks
// the assistant drafts often don't, so we find the task by title ("Venn onboarding UI" is the block
// for "Work on Venn's new onboarding UI") and save the link the first time it's needed.

type BlockRef = { id: string; title: string; date: string; goalId: string | null; taskId: string | null };
type TaskRef = { id: string; title: string; goalId: string | null };

const FILLER = new Set(["a", "an", "the", "and", "or", "of", "on", "for", "to", "in", "at", "with", "my", "new", "work", "working", "do", "finish", "start", "continue", "session"]);

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/['’]s\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w && !FILLER.has(w))
      .map((w) => (w.length > 3 ? w.replace(/s$/, "") : w)),
  );

/** The one task a block title clearly stands for; nothing when it's unclear or ambiguous. */
export function matchTask<T extends TaskRef>(tasks: T[], block: Pick<BlockRef, "title" | "goalId">): T | undefined {
  const bw = words(block.title);
  if (!bw.size) return undefined;
  let best: { task: T; score: number } | undefined;
  let tie = false;
  for (const task of tasks) {
    if (block.goalId && task.goalId && block.goalId !== task.goalId) continue;
    const tw = words(task.title);
    const hits = [...bw].filter((w) => tw.has(w)).length;
    // nearly every block word is in the task, and the block covers most of the task
    // (a one-word block has to match a one-word task exactly)
    if (!hits || hits / bw.size < 0.8 || hits / tw.size < (bw.size === 1 ? 1 : 0.5)) continue;
    const score = hits / bw.size + hits / tw.size;
    if (best && score === best.score) tie = true;
    if (!best || score > best.score) {
      best = { task, score };
      tie = false;
    }
  }
  return tie ? undefined : best?.task;
}

/** Open tasks a block on `date` could stand for: due that day or earlier, or undated. */
export function openTasksBy(userId: string, date: string) {
  return db
    .select({ id: t.tasks.id, title: t.tasks.title, goalId: t.tasks.goalId, dueDate: t.tasks.dueDate })
    .from(t.tasks)
    .where(and(eq(t.tasks.userId, userId), isNull(t.tasks.doneAt), or(isNull(t.tasks.dueDate), lte(t.tasks.dueDate, date))));
}

/**
 * Carries a block's done state to its task. `before` is the block as it was; `doneAt` is its new
 * value. Done closes the task with the same timestamp, so undo reopens it only if this block closed it.
 */
export async function syncBlockTask(userId: string, before: BlockRef & { doneAt: number | null }, doneAt: number | null) {
  if (doneAt != null) {
    let taskId = before.taskId;
    if (!taskId) {
      taskId = matchTask(await openTasksBy(userId, before.date), before)?.id ?? null;
      if (!taskId) return;
      await db.update(t.blocks).set({ taskId }).where(eq(t.blocks.id, before.id));
    }
    await db
      .update(t.tasks)
      .set({ doneAt })
      .where(and(eq(t.tasks.id, taskId), eq(t.tasks.userId, userId), isNull(t.tasks.doneAt)));
  } else if (before.taskId && before.doneAt != null) {
    await db
      .update(t.tasks)
      .set({ doneAt: null })
      .where(and(eq(t.tasks.id, before.taskId), eq(t.tasks.userId, userId), eq(t.tasks.doneAt, before.doneAt)));
  }
}
