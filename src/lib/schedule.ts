type Span = { startMin: number; endMin: number };

/** First gap of `minutes` length between dayStart and dayEnd, on a 15 minute grid. */
export function findFreeSlot(busy: Span[], minutes: number, dayStart: number, dayEnd: number) {
  const sorted = [...busy].sort((a, b) => a.startMin - b.startMin);
  let cursor = Math.ceil(dayStart / 15) * 15;
  for (const b of sorted) {
    if (b.endMin <= cursor) continue;
    if (b.startMin - cursor >= minutes) break;
    cursor = Math.max(cursor, Math.ceil(b.endMin / 15) * 15);
  }
  if (cursor + minutes > dayEnd) return null;
  return { start: cursor, end: cursor + minutes };
}

/** Minutes covered by spans, counting overlaps once. */
export function coveredMinutes(spans: Span[]) {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin);
  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const s of sorted) {
    if (s.startMin > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = s.startMin;
      curEnd = s.endMin;
    } else {
      curEnd = Math.max(curEnd, s.endMin);
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}
