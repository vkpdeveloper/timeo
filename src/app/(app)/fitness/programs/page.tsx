import { asc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { Section, Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { sameSplit, snapshotProgram } from "@/lib/gym-program";
import { GYM_PRESETS, type ProgramData } from "@/lib/gym-presets";
import { ProgramCard, SaveCurrentButton, type ProgramView } from "./client";

export default function ProgramsPage() {
  return (
    <>
      <SubHeader back="/fitness" backLabel="Fitness" title="Programs" />
      <Suspense
        fallback={
          <div className="pt-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="mt-6 h-48 rounded-[22px]" />
            <Skeleton className="mt-4 h-48 rounded-[22px]" />
          </div>
        }
      >
        <Programs />
      </Suspense>
    </>
  );
}

function view(data: ProgramData): Pick<ProgramView, "days" | "routines"> {
  const colorOf = new Map(data.routines.map((r) => [r.name.toLowerCase(), r.color]));
  return {
    days: Array.from({ length: 7 }, (_, wd) => {
      const d = data.schedule.find((x) => x.weekday === wd);
      const name = d?.routine ?? null;
      return { name: name ?? d?.label ?? "Rest", color: name ? (colorOf.get(name.toLowerCase()) ?? "slate") : null };
    }),
    routines: data.routines.map((r) => ({
      name: r.name,
      focus: r.focus,
      color: r.color,
      exercises: r.exercises.map((e) => `${e.name} · ${e.sets}×${e.reps[0] === e.reps[1] ? e.reps[0] : `${e.reps[0]}–${e.reps[1]}`}`),
    })),
  };
}

async function Programs() {
  const user = await requireUser();
  const [saved, current] = await Promise.all([
    db.select().from(t.gymPrograms).where(eq(t.gymPrograms.userId, user.id)).orderBy(asc(t.gymPrograms.createdAt)),
    snapshotProgram(user.id),
  ]);

  const savedViews: ProgramView[] = saved.map((p) => ({
    kind: "saved",
    id: p.id,
    name: p.name,
    description: p.description,
    meta: `${p.data.schedule.filter((d) => d.routine).length} days a week · ${p.data.routines.length} routines`,
    current: sameSplit(current, p.data),
    ...view(p.data),
  }));
  const presetViews: ProgramView[] = GYM_PRESETS.map((p) => ({
    kind: "preset",
    id: p.slug,
    name: p.name,
    description: p.description,
    meta: `${p.daysPerWeek} days a week · ${p.level}`,
    current: sameSplit(current, p),
    ...view(p),
  }));
  const anyCurrent = [...savedViews, ...presetViews].some((p) => p.current);

  return (
    <div className="fade-up pb-8">
      <header className="pt-5 pb-5">
        <h1 className="display text-[38px] text-ink">Programs</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
          Load a whole split in one tap. Your logs and history always stay.
        </p>
      </header>

      <Section title="My programs">
        <div className="flex flex-col gap-3">
          {savedViews.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
          {!savedViews.length && (
            <p className="px-1 text-[13.5px] leading-relaxed text-ink-3">
              Save your current routines and split to switch back to them later.
            </p>
          )}
          <SaveCurrentButton suggestedName={anyCurrent ? "" : "My split"} />
        </div>
      </Section>

      <Section title="Presets">
        <div className="flex flex-col gap-3">
          {presetViews.map((p) => (
            <ProgramCard key={p.id} program={p} />
          ))}
        </div>
      </Section>
    </div>
  );
}
