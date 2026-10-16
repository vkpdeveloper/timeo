// Fuzzy name matching for tool arguments ("incline press" → "Incline dumbbell press").

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function bestMatch<T extends { name: string }>(rows: T[], query: string): T | undefined {
  const q = norm(query);
  if (!q) return undefined;
  const exact = rows.find((r) => norm(r.name) === q);
  if (exact) return exact;
  const qWords = new Set(q.split(" "));
  let best: { row: T; score: number } | undefined;
  for (const r of rows) {
    const words = norm(r.name).split(" ");
    const hits = words.filter((w) => qWords.has(w) || qWords.has(w.replace(/s$/, ""))).length;
    const score = hits / Math.max(words.length, qWords.size);
    if (score > (best?.score ?? 0)) best = { row: r, score };
  }
  return best && best.score >= 0.5 ? best.row : undefined;
}

