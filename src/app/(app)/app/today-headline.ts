import type { Block } from "@/db/schema";
import { coveredMinutes } from "@/lib/schedule";

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

/** A block this close to starting takes over the Now hero. */
export const SOON_MIN = 60;

/**
 * The one thing Now shows, read from the day:
 * a running block, a block about to start, free time, or a finished day.
 */
export type Hero =
  | { kind: "now"; block: Block }
  | { kind: "next"; block: Block }
  | { kind: "free"; until: number; freeMin: number; next: Block | null }
  | { kind: "done" };

export function pickHero({
  blocks,
  nowMin,
  bounds,
}: {
  blocks: Block[];
  nowMin: number;
  bounds: { start: number; end: number };
}): Hero {
  const open = blocks.filter((b) => !b.doneAt && !b.skippedAt);
  const running = open.find((b) => b.startMin <= nowMin && b.endMin > nowMin);
  if (running) return { kind: "now", block: running };
  if (nowMin >= bounds.end) return { kind: "done" };
  const next = open.find((b) => b.startMin > nowMin) ?? null;
  if (next && next.startMin - nowMin <= SOON_MIN) return { kind: "next", block: next };
  const from = Math.max(nowMin, bounds.start);
  const until = next ? next.startMin : bounds.end;
  return { kind: "free", until, freeMin: Math.max(0, until - from), next };
}

/** Minute of the day when the hero changes next, so the page can refresh itself. */
export function heroChangesAt(hero: Hero, bounds: { end: number }): number | null {
  if (hero.kind === "now") return hero.block.endMin;
  if (hero.kind === "next") return hero.block.startMin;
  if (hero.kind === "free") return hero.next ? hero.next.startMin - SOON_MIN : bounds.end;
  return null;
}
