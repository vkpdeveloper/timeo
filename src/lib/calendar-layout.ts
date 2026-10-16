// Lays out overlapping calendar items side by side, like Apple Calendar:
// items that overlap share a cluster, and each gets a column inside it.

type Span = { startMin: number; endMin: number };

export type Placed<T> = { item: T; col: number; cols: number };

export function layoutColumns<T extends Span>(items: T[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const p of cluster) p.cols = colEnds.length;
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };

  for (const item of sorted) {
    // Very short items still take visual space; treat them as at least 20 minutes.
    const end = Math.max(item.endMin, item.startMin + 20);
    if (item.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((e) => e <= item.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(end);
    } else colEnds[col] = end;
    cluster.push({ item, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}
