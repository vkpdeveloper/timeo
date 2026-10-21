import { desc, eq, sql } from "drizzle-orm";
import { History } from "lucide-react";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, Row, RowIcon, Section, Skeleton, Stat, StatStrip, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { colorVar } from "@/lib/colors";
import { addDays, formatDuration, formatMonthDay, formatWeekdayShort, startOfWeek } from "@/lib/dates";
import { fmtVolume } from "@/lib/fitness-math";
import { StatusChip } from "../_components/bits";

export default function HistoryPage() {
  return (
    <>
      <SubHeader back="/app/fitness" backLabel="Body" />
      <Suspense fallback={<ListSkeleton />}>
        <HistoryList />
      </Suspense>
    </>
  );
}

function ListSkeleton() {
  return (
    <div>
      <div className="pt-5 pb-4">
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-12" />
      <Skeleton className="mt-6 h-4 w-24" />
      <Skeleton className="mt-3 h-48 rounded-[16px]" />
      <Skeleton className="mt-6 h-4 w-24" />
      <Skeleton className="mt-3 h-48 rounded-[16px]" />
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
      sets: sql<number>`(select count(*) from ${t.setLogs} s where s.workout_log_id = "workout_logs"."id" and s.warmup = 0 and s.done = 1)`,
      volume: sql<number>`(select coalesce(sum(s.weight_kg * s.reps), 0) from ${t.setLogs} s where s.workout_log_id = "workout_logs"."id" and s.warmup = 0 and s.done = 1 and s.weight_kg is not null)`,
      unknown: sql<number>`(select count(*) from ${t.setLogs} s where s.workout_log_id = "workout_logs"."id" and s.warmup = 0 and s.done = 1 and s.weight_kg is null)`,
    })
    .from(t.workoutLogs)
    .leftJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.workoutLogs.templateId))
    .where(eq(t.workoutLogs.userId, user.id))
    .orderBy(desc(t.workoutLogs.date), desc(t.workoutLogs.startedAt))
    .limit(300);

  if (!rows.length) {
    return (
      <EmptyState
        className="mt-5"
        icon={<History />}
        title="No sessions yet"
        body="Logged, skipped and unlogged sessions show up here, week by week."
        action={<ButtonLink href="/app/fitness/import" variant="secondary">Import past training</ButtonLink>}
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
  const counts = (l: (typeof rows)[number]) => l.status === "completed" || l.status === "unlogged";
  const since4 = addDays(thisWeek, -21);
  const last4 = rows.filter((r) => r.date >= since4 && counts(r)).length;
  const done = rows.filter(counts).length;

  return (
    <div>
      <PageHeader title="History" subtitle="Every session, week by week." />
      <StatStrip>
        <Stat value={(weeks.get(thisWeek) ?? []).filter(counts).length} label="this week" />
        <Stat value={Math.round((last4 / 4) * 10) / 10} label="weekly average" />
        <Stat value={done} label="sessions in all" />
      </StatStrip>
      {[...weeks].map(([ws, logs], wi) => {
        const sessions = logs.filter(counts).length;
        const sets = logs.reduce((a, l) => a + Number(l.sets), 0);
        return (
          <Section
            key={ws}
            title={weekTitle(ws, thisWeek)}
            count={`${sessions} ${sessions === 1 ? "session" : "sessions"} · ${sets} sets`}
            card
            stagger={wi < 3}
          >
            {logs.map((l) => {
              const swapped = l.status !== "skipped" && !!l.templateId && !!l.plannedTemplateId && l.templateId !== l.plannedTemplateId;
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
                <Row
                  key={l.id}
                  href={`/app/fitness/history/${l.id}`}
                  icon={
                    <RowIcon className="h-auto! flex-col bg-transparent! leading-none">
                      <span className="text-[11px] font-medium text-ink-3">{formatWeekdayShort(l.date)}</span>
                      <span className="tnum mt-1 text-[17px] font-semibold text-ink">{Number(l.date.slice(8))}</span>
                    </RowIcon>
                  }
                  title={
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: l.status === "skipped" ? "var(--line-strong)" : colorVar(l.color ?? "stone") }}
                      />
                      <span className="truncate">{l.name}</span>
                      {swapped && <span className="shrink-0 text-[11.5px] font-medium text-ink-3">swap</span>}
                    </span>
                  }
                  subtitle={meta}
                  chevron={false}
                >
                  {l.status !== "completed" && <StatusChip status={l.status} />}
                </Row>
              );
            })}
          </Section>
        );
      })}
    </div>
  );
}
