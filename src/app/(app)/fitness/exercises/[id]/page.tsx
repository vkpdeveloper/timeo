import { and, asc, desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState, Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatMonthDay, formatWeekdayShort } from "@/lib/dates";
import { basisLabel, bestSet, epley, fmtKg, fmtSet, muscleLabel } from "@/lib/fitness-math";
import { LineChart } from "../../_components/line-chart";
import { EditExerciseButton } from "./edit";

export default function ExercisePage(props: PageProps<"/fitness/exercises/[id]">) {
  return (
    <>
      <SubHeader back="/fitness/exercises" backLabel="Exercises" />
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

async function Exercise({ params }: { params: PageProps<"/fitness/exercises/[id]">["params"] }) {
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

  return (
    <div className="fade-up pb-8">
      <header className="flex items-start justify-between gap-3 pt-5 pb-5">
        <div className="min-w-0">
          <div className="eyebrow">{[muscleLabel(ex.muscle), ex.equipment].filter(Boolean).join(" · ")}</div>
          <h1 className="display mt-1.5 text-[36px] text-ink">{ex.name}</h1>
          {basis && <p className="mt-1 text-[14px] text-ink-2">Weight logged {basis.replace("kg ", "")}</p>}
          {ex.cues && <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{ex.cues}</p>}
        </div>
        <EditExerciseButton exercise={ex} />
      </header>

      {sessions.length === 0 ? (
        <EmptyState title="No sets logged yet" body="Progress shows up here after your first session with this exercise." />
      ) : (
        <>
          <div className="card grid grid-cols-3 divide-x divide-line">
            <Stat label="Best set" value={best ? fmtSet(best) : "—"} />
            <Stat label="Est. 1RM" value={bestE1rm != null ? `${fmtKg(Math.round(bestE1rm * 10) / 10)}` : "—"} unit="kg" />
            <Stat label="Heaviest" value={heaviest != null ? fmtKg(heaviest) : "—"} unit="kg" />
          </div>

          {trend.length >= 2 && (
            <section className="mt-8">
              <div className="mb-2.5 flex items-baseline justify-between px-1">
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">Estimated 1RM</h2>
                <span className="text-[12px] text-ink-3">Best working set per session · Epley</span>
              </div>
              <div className="card px-2 pt-3 pb-2">
                <LineChart points={trend} unit=" kg" color="var(--c-violet)" label={`Estimated one-rep max trend for ${ex.name}`} />
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-2.5 px-1 text-[15px] font-semibold tracking-tight text-ink">Recent sessions</h2>
            <div className="card overflow-hidden">
              {sessions.slice(0, 20).map((s) => {
                const working = s.sets.filter((x) => !x.warmup);
                const warm = s.sets.length - working.length;
                const notes = s.sets.filter((x) => x.note).map((x) => x.note);
                return (
                  <Link
                    key={s.logId}
                    href={`/fitness/history/${s.logId}`}
                    className="tap block border-b border-line px-4 py-3 last:border-0 active:bg-sunken"
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
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="tnum truncate text-[19px] font-semibold tracking-tight text-ink">{value}</span>
        {unit && value !== "—" && <span className="text-[11.5px] text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}
