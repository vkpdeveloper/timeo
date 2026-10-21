import { and, asc, desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card, EmptyState, Section, Skeleton, Stat, StatStrip, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { catalogEntry } from "@/lib/exercise-catalog-server";
import { formatMonthDay, formatWeekdayShort } from "@/lib/dates";
import { basisLabel, bestSet, epley, fmtKg, fmtSet, muscleLabel } from "@/lib/fitness-math";
import { ExerciseFrames } from "../../_components/exercise-photo";
import { HowTo } from "../../_components/how-to";
import { LineChart } from "../../_components/line-chart";
import { EditExerciseButton } from "./edit";
import { LinkLibrary } from "./link";

export default function ExercisePage(props: PageProps<"/app/fitness/exercises/[id]">) {
  return (
    <>
      <SubHeader back="/app/fitness/exercises" backLabel="Exercises" />
      <Suspense
        fallback={
          <div className="pt-6">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="mt-6 h-24 rounded-[22px]" />
            <Skeleton className="mt-4 h-56 rounded-[22px]" />
          </div>
        }
      >
        <Exercise params={props.params} />
      </Suspense>
    </>
  );
}

async function Exercise({ params }: { params: PageProps<"/app/fitness/exercises/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const [ex, rows] = await Promise.all([
    db
      .select()
      .from(t.exercises)
      .where(and(eq(t.exercises.id, id), eq(t.exercises.userId, user.id)))
      .get(),
    db
      .select({
        logId: t.workoutLogs.id,
        date: t.workoutLogs.date,
        name: t.workoutLogs.name,
        startedAt: t.workoutLogs.startedAt,
        warmup: t.setLogs.warmup,
        reps: t.setLogs.reps,
        weightKg: t.setLogs.weightKg,
        note: t.setLogs.note,
        done: t.setLogs.done,
      })
      .from(t.setLogs)
      .innerJoin(t.workoutLogs, eq(t.workoutLogs.id, t.setLogs.workoutLogId))
      .where(
        and(
          eq(t.setLogs.exerciseId, id),
          eq(t.workoutLogs.userId, user.id),
          ne(t.workoutLogs.status, "in_progress"),
          eq(t.setLogs.done, true),
        ),
      )
      .orderBy(desc(t.workoutLogs.date), desc(t.workoutLogs.startedAt), asc(t.setLogs.setIndex)),
  ]);
  if (!ex) notFound();

  // group into sessions (newest first)
  const sessions: { logId: string; date: string; name: string; sets: typeof rows }[] = [];
  for (const r of rows) {
    const s = sessions[sessions.length - 1];
    if (s && s.logId === r.logId) s.sets.push(r);
    else sessions.push({ logId: r.logId, date: r.date, name: r.name, sets: [r] });
  }
  const trend = sessions
    .map((s) => {
      const b = bestSet(s.sets);
      const e = b ? epley(b.weightKg, b.reps) : null;
      return e != null ? { date: s.date, value: Math.round(e * 10) / 10 } : null;
    })
    .filter((p): p is { date: string; value: number } => !!p)
    .reverse();
  const all = rows.filter((r) => !r.warmup);
  const best = bestSet(all);
  const bestE1rm = best ? epley(best.weightKg, best.reps) : null;
  const heaviest = all.reduce<number | null>((m, r) => (r.weightKg != null && (m == null || r.weightKg > m) ? r.weightKg : m), null);
  const basis = basisLabel(ex.weightBasis, ex.unilateral);
  const entry = catalogEntry(ex.catalogId);

  return (
    <div className="pb-2">
      <header className="flex items-start justify-between gap-3 pt-5 pb-4 lg:pt-10 lg:pb-5">
        <div className="min-w-0">
          <div className="eyebrow">{[muscleLabel(ex.muscle), ex.equipment].filter(Boolean).join(" · ")}</div>
          <h1 className="display mt-1 text-[32px] lg:text-[40px] text-ink">{ex.name}</h1>
          {basis && <p className="mt-1 text-[14px] text-ink-2">Weight logged {basis.replace("kg ", "")}</p>}
          {ex.cues && <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{ex.cues}</p>}
        </div>
        <EditExerciseButton exercise={ex} />
      </header>

      <section className="mb-2">
        {entry && entry.images > 0 && <ExerciseFrames catalogId={entry.id} name={entry.name} images={entry.images} />}
        <LinkLibrary exerciseId={ex.id} name={ex.name} linked={entry ? { id: entry.id, name: entry.name } : null} />
      </section>

      {sessions.length === 0 ? (
        <EmptyState className="mt-6" title="No sets logged yet" body="Progress shows up here after your first session with this exercise." />
      ) : (
        <>
          <StatStrip className="mt-6">
            <Stat label="best set" value={best ? fmtSet(best) : "—"} />
            <Stat
              label="estimated 1RM"
              value={bestE1rm != null ? fmtKg(Math.round(bestE1rm * 10) / 10) : "—"}
              unit={bestE1rm != null ? "kg" : undefined}
            />
            <Stat label="heaviest" value={heaviest != null ? fmtKg(heaviest) : "—"} unit={heaviest != null ? "kg" : undefined} />
          </StatStrip>

          {trend.length >= 2 && (
            <Section title="Estimated 1RM" hint="Best working set per session (Epley).">
              <Card className="px-2 pt-3 pb-2">
                <LineChart points={trend} unit=" kg" color="var(--c-violet)" label={`Estimated one-rep max trend for ${ex.name}`} />
              </Card>
            </Section>
          )}

          <Section title="Recent sessions" count={sessions.length}>
            <div className="card card-list stagger overflow-hidden">
              {sessions.slice(0, 20).map((s) => {
                const working = s.sets.filter((x) => !x.warmup);
                const warm = s.sets.length - working.length;
                const notes = s.sets.filter((x) => x.note).map((x) => x.note);
                return (
                  <Link
                    key={s.logId}
                    href={`/app/fitness/history/${s.logId}`}
                    className="tap-row block px-4 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-semibold text-ink-2">
                        {formatWeekdayShort(s.date)}, {formatMonthDay(s.date)}
                      </span>
                      <span className="truncate text-[12px] text-ink-3">{s.name}</span>
                    </div>
                    <div className="tnum mt-1 text-[15px] text-ink">
                      {working.map(fmtSet).join(", ") || "Warm-ups only"}
                      {warm > 0 && <span className="text-[12.5px] text-ink-3"> · {warm} warm-up</span>}
                    </div>
                    {notes.length > 0 && <div className="mt-0.5 truncate text-[12.5px] text-ink-3">{notes.join(" · ")}</div>}
                  </Link>
                );
              })}
            </div>
          </Section>
        </>
      )}

      {entry && <HowTo entry={entry} />}
    </div>
  );
}
