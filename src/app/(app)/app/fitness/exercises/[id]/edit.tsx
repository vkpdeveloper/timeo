"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Field, Input, PillPicker, Segmented, Textarea } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import type { Exercise } from "@/db/schema";
import { MUSCLES, type Muscle } from "@/lib/fitness-math";
import { ErrorNote } from "../../_components/day-actions";
import { updateExercise } from "../actions";

export function EditExerciseButton({ exercise: ex }: { exercise: Exercise }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap mt-4 h-11 shrink-0 rounded-[12px] bg-sunken px-4 text-[14px] font-medium text-ink-2"
      >
        Edit
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Edit exercise">
        <form
          action={async (fd) => {
            setError(null);
            try {
              await updateExercise(fd);
              setOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "That didn't save. Try again.");
            }
          }}
        >
          <input type="hidden" name="id" value={ex.id} />
          <Field label="Name">
            <Input name="name" defaultValue={ex.name} required />
          </Field>
          <Field label="Muscle">
            <PillPicker<Muscle> name="muscle" defaultValue={ex.muscle} options={MUSCLES.map((m) => ({ value: m.value, label: m.label }))} />
          </Field>
          <Field label="Equipment">
            <Input name="equipment" defaultValue={ex.equipment ?? ""} />
          </Field>
          <Field label="Weight is logged">
            <Segmented
              name="weightBasis"
              defaultValue={ex.weightBasis}
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
              defaultValue={ex.type}
              options={[
                { value: "weight", label: "Weights" },
                { value: "bodyweight", label: "Bodyweight" },
                { value: "cardio", label: "Cardio" },
              ]}
            />
          </Field>
          <label className="mb-4 flex h-12 items-center justify-between rounded-[12px] bg-surface-2 px-4 text-[15px] text-ink">
            One side at a time
            <input type="checkbox" name="unilateral" defaultChecked={ex.unilateral} className="size-5 accent-[var(--accent)]" />
          </label>
          <Field label="Cues" hint="optional">
            <Textarea name="cues" rows={2} defaultValue={ex.cues ?? ""} placeholder="e.g. Elbows to back pockets" />
          </Field>
          <ErrorNote error={error} />
          <SubmitButton size="lg">Save</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
