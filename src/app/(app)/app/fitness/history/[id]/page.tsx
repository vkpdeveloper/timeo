import { asc, eq, inArray } from "drizzle-orm";
import { ChevronRight, MessageSquare, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageHeader, Section, Skeleton, Stat, StatStrip, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { colorVar, tint } from "@/lib/colors";
import { formatDuration, formatLongDate } from "@/lib/dates";
import { ownWorkout } from "@/lib/fitness";
import { basisLabel, fmtKg, fmtVolume, volumeOf, workingSetCount } from "@/lib/fitness-math";
import { StatusChip } from "../../_components/bits";
import { DeleteWorkoutButton } from "./delete-button";

const FEEL = ["", "Rough", "Meh", "Okay", "Good", "Great"];

export default function SessionPage(props: PageProps<"/app/fitness/history/[id]">) {
  return (
    <>
      <SubHeader back="/app/fitness/history" backLabel="History" />
      <Suspense
        fallback={
          <div>
            <div className="pt-5 pb-4">
              <Skeleton className="mb-2 h-3 w-32" />
              <Skeleton className="h-9 w-40" />
            </div>
            <Skeleton className="h-12" />
            <Skeleton className="mt-6 h-60 rounded-[16px]" />
          </div>
        }
      >
        <Session params={props.params} />
      </Suspense>
    </>
  );
}

async function Session({ params }: { params: PageProps<"/app/fitness/history/[id]">["params"] }) {
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
  const swapped = log.status !== "skipped" && !!log.templateId && !!log.plannedTemplateId && log.templateId !== log.plannedTemplateId;
  const color = template?.color ?? "stone";

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
    <div style={tint(color)}>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: colorVar(color) }} />
            {formatLongDate(log.date)}
          </span>
        }
        title={log.name}
        action={<StatusChip status={log.status} />}
        subtitle={
          log.status === "skipped"
            ? (log.skipReason ?? "No reason given.")
            : swapped
              ? `Planned: ${planned?.name ?? "Rest day"}`
              : undefined
        }
      />

      {log.status !== "skipped" && (
        <StatStrip>
          <Stat label="working sets" value={log.status === "unlogged" ? "?" : working} />
          <Stat
            label={unknownLoads ? `volume, +${unknownLoads} unknown` : "volume"}
            value={volume ? fmtVolume(volume) : "—"}
          />
          {log.feeling || hasDuration ? (
            <Stat
              label={log.feeling ? (hasDuration ? `felt, ${formatDuration(duration!)}` : "felt") : "time"}
              value={log.feeling ? FEEL[log.feeling] : formatDuration(duration!)}
            />
          ) : (
            <Stat label="exercises" value={log.status === "unlogged" ? "?" : blocks.length} />
          )}
        </StatStrip>
      )}

      {log.notes && (
        <Section title="Notes">
          <Card className="px-4 py-3.5">
            <p className="text-[14.5px] leading-relaxed whitespace-pre-line text-ink-2">{log.notes}</p>
          </Card>
        </Section>
      )}

      {log.status === "unlogged" && (
        <Card className="mt-5 px-4 py-4 text-[14px] leading-relaxed text-ink-2">Reported as done. Sets, reps and weights are unknown.</Card>
      )}

      {blocks.length > 0 && (
        <Section title="Exercises" count={blocks.length} bodyClassName="stagger flex flex-col gap-3">
          {blocks.map((b) => {
            let n = 0;
            return (
              <div key={b.key + b.exerciseId} className="card overflow-hidden">
                <Link
                  href={`/app/fitness/exercises/${b.exerciseId}`}
                  className="tap-row flex min-h-12 items-center justify-between gap-3 px-4 pt-3 pb-1.5"
                >
                  <h3 className="truncate text-[16px] font-semibold tracking-tight text-ink">{b.name}</h3>
                  <span className="flex shrink-0 items-center gap-1 text-[12px] text-ink-3">
                    {b.basis}
                    <ChevronRight className="size-4" />
                  </span>
                </Link>
                <div className="px-4 pb-2.5">
                  {b.sets.map((s) => {
                    if (!s.warmup) n++;
                    return (
                      <div key={s.id} className="border-t border-line py-2 first:border-0">
                        <div className="flex items-center gap-3">
                          <span className={`tnum w-6 text-[13px] font-medium ${s.warmup ? "text-warn" : "text-ink-3"}`}>
                            {s.warmup ? "W" : n}
                          </span>
                          <span className={`tnum flex-1 text-[15px] ${s.warmup ? "text-ink-3" : "text-ink"}`}>
                            <span className={s.weightKg == null ? "font-medium text-warn" : "font-medium"}>{fmtKg(s.weightKg)}</span>
                            <span className="text-ink-3"> kg × </span>
                            <span className="font-medium">{s.reps ?? "?"}</span>
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
              </div>
            );
          })}
        </Section>
      )}

      <div className="mt-6 flex gap-2.5">
        {log.status !== "skipped" && (
          <ButtonLink href={`/app/fitness/workout/${log.id}`} variant="secondary" size="lg" className="flex-1">
            <Pencil className="size-4" /> {log.status === "unlogged" ? "Add sets" : log.status === "in_progress" ? "Open workout" : "Edit sets"}
          </ButtonLink>
        )}
        <DeleteWorkoutButton id={log.id} />
      </div>
    </div>
  );
}
