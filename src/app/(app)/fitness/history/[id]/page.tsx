import { asc, eq, inArray } from "drizzle-orm";
import { MessageSquare, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { colorVar } from "@/lib/colors";
import { formatDuration, formatLongDate } from "@/lib/dates";
import { ownWorkout } from "@/lib/fitness";
import { basisLabel, fmtKg, fmtVolume, volumeOf, workingSetCount } from "@/lib/fitness-math";
import { StatusChip } from "../../_components/bits";
import { DeleteWorkoutButton } from "./delete-button";

const FEEL = ["", "Rough", "Meh", "Okay", "Good", "Great"];

export default function SessionPage(props: PageProps<"/fitness/history/[id]">) {
  return (
    <>
      <SubHeader back="/fitness/history" backLabel="History" />
      <Suspense
        fallback={
          <div className="pt-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="mt-6 h-20 rounded-[22px]" />
            <Skeleton className="mt-4 h-60 rounded-[22px]" />
          </div>
        }
      >
        <Session params={props.params} />
      </Suspense>
    </>
  );
}

async function Session({ params }: { params: PageProps<"/fitness/history/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  const log = await ownWorkout(user.id, id).catch(() => null);
  if (!log) notFound();

  const templateIds = [log.templateId, log.plannedTemplateId].filter((x): x is string => !!x);
  const [sets, templates] = await Promise.all([
    db
      .select({
        id: t.setLogs.id,
        exerciseId: t.setLogs.exerciseId,
        exerciseOrder: t.setLogs.exerciseOrder,
        warmup: t.setLogs.warmup,
        reps: t.setLogs.reps,
        weightKg: t.setLogs.weightKg,
        note: t.setLogs.note,
        done: t.setLogs.done,
        name: t.exercises.name,
        weightBasis: t.exercises.weightBasis,
        unilateral: t.exercises.unilateral,
      })
      .from(t.setLogs)
      .innerJoin(t.exercises, eq(t.exercises.id, t.setLogs.exerciseId))
      .where(eq(t.setLogs.workoutLogId, log.id))
      .orderBy(asc(t.setLogs.exerciseOrder), asc(t.setLogs.setIndex)),
    templateIds.length
      ? db
          .select({ id: t.workoutTemplates.id, name: t.workoutTemplates.name, color: t.workoutTemplates.color })
          .from(t.workoutTemplates)
          .where(inArray(t.workoutTemplates.id, templateIds))
      : Promise.resolve([]),
  ]);
  const template = templates.find((x) => x.id === log.templateId);
  const planned = templates.find((x) => x.id === log.plannedTemplateId);
  const swapped = log.status !== "skipped" && !!log.templateId && log.templateId !== log.plannedTemplateId;
  const color = template?.color ?? "slate";

  const blocks: { key: string; exerciseId: string; name: string; basis: string | null; sets: typeof sets }[] = [];
  for (const s of sets) {
    const last = blocks[blocks.length - 1];
    if (last && last.exerciseId === s.exerciseId && last.key === `${s.exerciseOrder}`) last.sets.push(s);
    else
      blocks.push({
        key: `${s.exerciseOrder}`,
        exerciseId: s.exerciseId,
        name: s.name,
        basis: basisLabel(s.weightBasis, s.unilateral),
        sets: [s],
      });
  }
  const duration = log.endedAt ? (log.endedAt - log.startedAt) / 60000 : null;
  const hasDuration = duration != null && duration >= 1 && duration < 600;
  const volume = volumeOf(sets);
  const working = workingSetCount(sets);
  const unknownLoads = sets.filter((s) => !s.warmup && s.done && s.weightKg == null).length;

  return (
    <div className="fade-up pb-6">
      <header className="pt-5 pb-5">
        <div className="eyebrow" style={{ color: colorVar(color) }}>{formatLongDate(log.date)}</div>
        <h1 className="display mt-1.5 text-[38px] text-ink">{log.name}</h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <StatusChip status={log.status} />
          {swapped && (
            <span className="text-[13px] text-ink-3">Planned: {planned?.name ?? "Rest day"}</span>
          )}
        </div>
        {log.status === "skipped" && (
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{log.skipReason ?? "No reason given."}</p>
        )}
      </header>

      {log.status !== "skipped" && (
        <div className="card grid grid-cols-3 divide-x divide-line">
          <Stat label="Working sets" value={log.status === "unlogged" ? "?" : String(working)} />
          <Stat label="Volume" value={volume ? fmtVolume(volume) : "—"} sub={unknownLoads ? `+${unknownLoads} unknown` : undefined} />
          {log.feeling || hasDuration ? (
            <Stat
              label={log.feeling ? "Felt" : "Duration"}
              value={log.feeling ? FEEL[log.feeling] : formatDuration(duration!)}
              sub={log.feeling && hasDuration ? formatDuration(duration!) : undefined}
            />
          ) : (
            <Stat label="Exercises" value={log.status === "unlogged" ? "?" : String(blocks.length)} />
          )}
        </div>
      )}

      {log.notes && (
        <div className="card mt-4 px-4 py-3.5">
          <div className="mb-1 text-[12px] font-medium text-ink-3">Notes</div>
          <p className="text-[14.5px] leading-relaxed whitespace-pre-line text-ink-2">{log.notes}</p>
        </div>
      )}

      {log.status === "unlogged" && (
        <div className="card mt-4 px-4 py-4 text-[14px] leading-relaxed text-ink-2">
          Reported as done. Sets, reps and weights are unknown.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {blocks.map((b) => {
          let n = 0;
          return (
            <section key={b.key + b.exerciseId} className="card overflow-hidden">
              <Link href={`/fitness/exercises/${b.exerciseId}`} className="tap flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2">
                <h2 className="text-[16px] font-semibold tracking-tight text-ink">{b.name}</h2>
                {b.basis && <span className="shrink-0 text-[12px] text-ink-3">{b.basis}</span>}
              </Link>
              <div className="px-4 pb-3">
                {b.sets.map((s) => {
                  if (!s.warmup) n++;
                  return (
                    <div key={s.id} className="border-t border-line py-2 first:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`tnum w-6 text-[13px] font-semibold ${s.warmup ? "text-warn" : "text-ink-3"}`}>
                          {s.warmup ? "W" : n}
                        </span>
                        <span className={`tnum flex-1 text-[15px] ${s.warmup ? "text-ink-3" : "text-ink"}`}>
                          <span className={s.weightKg == null ? "font-semibold text-warn" : "font-semibold"}>{fmtKg(s.weightKg)}</span>
                          <span className="text-ink-3"> kg × </span>
                          <span className="font-semibold">{s.reps ?? "?"}</span>
                        </span>
                        {s.warmup && <span className="text-[11.5px] font-medium text-ink-3">warm-up</span>}
                        {!s.done && <span className="text-[11.5px] font-medium text-ink-3">not done</span>}
                      </div>
                      {s.note && (
                        <p className="mt-1 ml-9 flex gap-1.5 text-[12.5px] leading-snug text-ink-3">
                          <MessageSquare className="mt-0.5 size-3 shrink-0" />
                          {s.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-6 flex gap-2.5">
        {log.status !== "skipped" && (
          <ButtonLink href={`/fitness/workout/${log.id}`} variant="secondary" size="lg" className="flex-1">
            <Pencil className="size-4" /> {log.status === "unlogged" ? "Add sets" : log.status === "in_progress" ? "Open workout" : "Edit sets"}
          </ButtonLink>
        )}
        <DeleteWorkoutButton id={log.id} />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="tnum mt-0.5 truncate text-[20px] font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="tnum truncate text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  );
}
