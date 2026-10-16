"use client";

import { ChevronLeft, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Field, Input, PillPicker, Segmented } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { MUSCLES, muscleLabel, type ExerciseOption, type Muscle } from "@/lib/fitness-math";
import { createExercise } from "../exercises/actions";
import { ErrorNote } from "./day-actions";

/** Searchable exercise library with "create custom exercise". */
export function ExercisePicker({
  open,
  onClose,
  exercises,
  onPick,
  title = "Add exercise",
}: {
  open: boolean;
  onClose: () => void;
  exercises: ExerciseOption[];
  onPick: (ex: ExerciseOption) => void;
  title?: string;
}) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (muscle === "all" || e.muscle === muscle) &&
        (!query || e.name.toLowerCase().includes(query) || (e.equipment ?? "").toLowerCase().includes(query)),
    );
  }, [exercises, q, muscle]);
  const exact = exercises.some((e) => e.name.toLowerCase() === q.trim().toLowerCase());
  const usedMuscles = MUSCLES.filter((m) => exercises.some((e) => e.muscle === m.value));

  const close = () => {
    setCreating(false);
    setQ("");
    setError(null);
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={creating ? "New exercise" : title} tall>
      {creating ? (
        <form
          action={async (fd) => {
            setError(null);
            try {
              const ex = await createExercise(fd);
              onPick(ex);
              close();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not create exercise");
            }
          }}
        >
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="tap mb-3 -ml-1 inline-flex items-center gap-0.5 text-[14px] font-medium text-accent"
          >
            <ChevronLeft className="size-4" /> Library
          </button>
          <Field>
            <Input name="name" defaultValue={q} placeholder="Exercise name" required autoFocus />
          </Field>
          <Field label="Muscle">
            <PillPicker<Muscle>
              name="muscle"
              defaultValue={muscle !== "all" ? (muscle as Muscle) : "chest"}
              options={MUSCLES.map((m) => ({ value: m.value, label: m.label }))}
            />
          </Field>
          <Field label="Equipment" hint="optional">
            <Input name="equipment" placeholder="e.g. Cable, Dumbbells" />
          </Field>
          <Field label="Weight is logged">
            <Segmented
              name="weightBasis"
              defaultValue="total"
              options={[
                { value: "total", label: "Total" },
                { value: "per_hand", label: "Per hand" },
                { value: "per_arm", label: "Per arm" },
              ]}
            />
          </Field>
          <Field label="Type">
            <Segmented
              name="type"
              defaultValue="weight"
              options={[
                { value: "weight", label: "Weights" },
                { value: "bodyweight", label: "Bodyweight" },
                { value: "cardio", label: "Cardio" },
              ]}
            />
          </Field>
          <label className="mb-5 flex h-12 items-center justify-between rounded-2xl bg-surface-2 px-4 text-[15px] text-ink">
            One side at a time
            <input type="checkbox" name="unilateral" className="size-5 accent-[var(--accent)]" />
          </label>
          <ErrorNote error={error} />
          <SubmitButton size="lg">Create and add</SubmitButton>
        </form>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className="pl-10" />
            </div>
            <div className="no-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5">
              {[{ value: "all", label: "All" }, ...usedMuscles].map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMuscle(m.value)}
                  className={
                    "tap h-8 shrink-0 rounded-full px-3 text-[13px] font-medium " +
                    (muscle === m.value ? "bg-ink text-bg" : "bg-sunken text-ink-2")
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {q.trim() && !exact && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="tap mb-2 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 text-left"
            >
              <Plus className="size-4 text-accent" />
              <span className="text-[15px] font-semibold text-ink">Create “{q.trim()}”</span>
            </button>
          )}
          <div className="flex flex-col">
            {list.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  onPick(e);
                  close();
                }}
                className="tap flex min-h-14 items-center gap-3 border-b border-line px-1 py-2.5 text-left last:border-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-ink">{e.name}</span>
                  <span className="block text-[12.5px] text-ink-3">
                    {muscleLabel(e.muscle)}
                    {e.equipment ? ` · ${e.equipment}` : ""}
                    {e.weightBasis === "per_hand" ? " · per hand" : e.weightBasis === "per_arm" ? " · per arm" : ""}
                  </span>
                </span>
                <Plus className="size-4 text-ink-3" />
              </button>
            ))}
            {!list.length && !q.trim() && <p className="py-8 text-center text-[14px] text-ink-3">No exercises here yet.</p>}
          </div>
          {!q.trim() && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="tap mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-sunken text-[14px] font-semibold text-ink-2"
            >
              <Plus className="size-4" /> Custom exercise
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
