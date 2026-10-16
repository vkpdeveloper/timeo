import { desc, eq, sql } from "drizzle-orm";
import { History } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { colorVar } from "@/lib/colors";
import { addDays, formatDuration, formatMonthDay, formatWeekdayShort, startOfWeek } from "@/lib/dates";
import { fmtVolume } from "@/lib/fitness-math";
import { StatusChip } from "../_components/bits";

export default function HistoryPage() {
  return (
    <>
      <SubHeader back="/fitness" backLabel="Fitness" title="History" />
      <Suspense fallback={<ListSkeleton />}>
        <HistoryList />
      </Suspense>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="pt-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-48 rounded-[22px]" />
      <Skeleton className="mt-8 h-4 w-24" />
      <Skeleton className="mt-3 h-48 rounded-[22px]" />
    </div>
  );
}

function weekTitle(ws: string, thisWeek: string) {
  if (ws === thisWeek) return "This week";
  if (ws === addDays(thisWeek, -7)) return "Last week";
  return `${formatMonthDay(ws)} – ${formatMonthDay(addDays(ws, 6))}`;
}

async function HistoryList() {
  const user = await requireUser();
  const rows = await db
    .select({
      id: t.workoutLogs.id,
      name: t.workoutLogs.name,
      date: t.workoutLogs.date,
      status: t.workoutLogs.status,
      skipReason: t.workoutLogs.skipReason,
      startedAt: t.workoutLogs.startedAt,
      endedAt: t.workoutLogs.endedAt,
      templateId: t.workoutLogs.templateId,
      plannedTemplateId: t.workoutLogs.plannedTemplateId,
      color: t.workoutTemplates.color,
      sets: sql<number>`(select count(*) from ${t.setLogs} s where s.workout_log_id = ${t.workoutLogs.id} and s.warmup = 0 and s.done = 1)`,
      volume: sql<number>`(select coalesce(sum(s.weight_kg * s.reps), 0) from ${t.setLogs} s where s.workout_log_id = ${t.workoutLogs.id} and s.warmup = 0 and s.done = 1 and s.weight_kg is not null)`,
      unknown: sql<number>`(select count(*) from ${t.setLogs} s where s.workout_log_id = ${t.workoutLogs.id} and s.warmup = 0 and s.done = 1 and s.weight_kg is null)`,
    })
    .from(t.workoutLogs)
    .leftJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.workoutLogs.templateId))
    .where(eq(t.workoutLogs.userId, user.id))
    .orderBy(desc(t.workoutLogs.date), desc(t.workoutLogs.startedAt))
    .limit(300);

  if (!rows.length) {
    return (
      <EmptyState
        className="mt-6"
        icon={<History />}
        title="No sessions yet"
        body="Logged, skipped and unlogged sessions show up here, week by week."
        action={<ButtonLink href="/fitness/import" variant="secondary">Import past training</ButtonLink>}
      />
    );
  }

  const thisWeek = startOfWeek(user.today);
  const weeks = new Map<string, typeof rows>();
  for (const r of rows) {
    const w = startOfWeek(r.date);
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w)!.push(r);
  }

  return (
    <div className="fade-up pt-4">
      {[...weeks].map(([ws, logs]) => {
        const sessions = logs.filter((l) => l.status === "completed" || l.status === "unlogged").length;
        const sets = logs.reduce((a, l) => a + Number(l.sets), 0);
        return (
          <section key={ws} className="mt-6 first:mt-2">
            <div className="mb-2.5 flex items-baseline justify-between px-1">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">{weekTitle(ws, thisWeek)}</h2>
              <span className="tnum text-[12.5px] text-ink-3">
                {sessions} {sessions === 1 ? "session" : "sessions"} · {sets} sets
              </span>
            </div>
            <div className="card overflow-hidden">
              {logs.map((l) => {
                const swapped = l.status !== "skipped" && !!l.templateId && l.templateId !== l.plannedTemplateId;
                const dur = l.endedAt ? (l.endedAt - l.startedAt) / 60000 : null;
                const meta =
                  l.status === "skipped"
                    ? (l.skipReason ?? "No reason given")
                    : l.status === "unlogged"
                      ? "Sets not logged"
                      : [
                          `${Number(l.sets)} sets`,
                          Number(l.volume) > 0 ? fmtVolume(Math.round(Number(l.volume))) : null,
                          Number(l.unknown) > 0 ? `${Number(l.unknown)} unknown load` : null,
                          dur != null && dur > 1 && dur < 600 ? formatDuration(dur) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                return (
                  <Link
                    key={l.id}
                    href={`/fitness/history/${l.id}`}
                    className="tap flex items-center gap-3.5 px-4 py-3.5 active:bg-sunken [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line"
                  >
                    <div className="w-9 shrink-0 text-center">
                      <div className="text-[11px] font-semibold text-ink-3 uppercase">{formatWeekdayShort(l.date)}</div>
                      <div className="tnum text-[18px] font-semibold text-ink">{Number(l.date.slice(8))}</div>
                    </div>
                    <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: l.status === "skipped" ? "var(--line-strong)" : colorVar(l.color ?? "slate") }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15.5px] font-semibold text-ink">{l.name}</span>
                        {swapped && <span className="shrink-0 text-[11.5px] font-medium text-ink-3">swap</span>}
                      </div>
                      <div className="tnum mt-0.5 truncate text-[12.5px] text-ink-3">{meta}</div>
                    </div>
                    <StatusChip status={l.status} />
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
