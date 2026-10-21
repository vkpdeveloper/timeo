"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { ColorPicker, Field, Input, PillPicker, Segmented, Stepper, Textarea } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import type { Goal, Season } from "@/db/schema";
import { createGoal, updateGoal, updateSeason } from "../actions";
import { AREAS, TIERS, fmtHours, type Area, type Tier } from "./meta";

/** Runs a form action, closes on success and keeps the error for display. */
export function useSubmit(action: (fd: FormData) => Promise<unknown>, onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  return {
    error,
    action: async (fd: FormData) => {
      setError(null);
      try {
        await action(fd);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't save. Try again.");
      }
    },
  };
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mb-3 flex items-start gap-2 px-1 text-[13.5px] font-medium text-warn">
      <CircleAlert className="mt-px size-4 shrink-0" />
      {error}
    </p>
  );
}

export function GoalSheet({
  open,
  onClose,
  goal,
  endDateLabel,
}: {
  open: boolean;
  onClose: () => void;
  goal?: Goal;
  endDateLabel?: string;
}) {
  const { error, action } = useSubmit(goal ? updateGoal : createGoal, onClose);
  const [hours, setHours] = useState(goal?.weeklyHours ?? 3);
  return (
    <Sheet open={open} onClose={onClose} title={goal ? "Edit goal" : "New goal"} tall>
      <form action={action} key={goal?.id ?? "new"}>
        {goal && <input type="hidden" name="id" value={goal.id} />}
        <Field label="Goal">
          <Input name="title" placeholder="e.g. Ship v2 of the app" defaultValue={goal?.title} required autoFocus={!goal} />
        </Field>
        <Field label={endDateLabel ? `What should have happened by ${endDateLabel}?` : "Outcome"}>
          <Textarea name="outcome" rows={2} placeholder="Concrete and checkable" defaultValue={goal?.outcome ?? ""} />
        </Field>
        <Field label="Why it matters" hint="optional">
          <Textarea name="why" rows={2} placeholder="The real reason" defaultValue={goal?.why ?? ""} />
        </Field>
        <Field label="System" hint="when and where">
          <Input name="system" placeholder="e.g. Mon/Wed/Fri 7am, after coffee" defaultValue={goal?.system ?? ""} />
        </Field>
        <Field label="Tier">
          <Segmented<Tier>
            name="tier"
            defaultValue={goal?.tier ?? "core"}
            options={TIERS.map((t) => ({ value: t.value, label: t.label }))}
          />
        </Field>
        <Field label="Area">
          <PillPicker<Area> name="area" defaultValue={goal?.area ?? "work"} options={AREAS.map((a) => ({ ...a }))} />
        </Field>
        <Field label="Colour">
          <ColorPicker name="color" defaultValue={goal?.color} />
        </Field>
        <Field label="Hours per week">
          <Stepper name="weeklyHours" value={hours} onChange={setHours} step={0.5} min={0} max={40} format={fmtHours} />
        </Field>
        <ErrorNote error={error} />
        <SubmitButton variant="accent" size="lg" className="mt-2">{goal ? "Save" : "Add goal"}</SubmitButton>
      </form>
    </Sheet>
  );
}

export function SeasonSheet({ open, onClose, season }: { open: boolean; onClose: () => void; season: Season }) {
  const { error, action } = useSubmit(updateSeason, onClose);
  const [cap, setCap] = useState(season.weeklyCapacityHours);
  return (
    <Sheet open={open} onClose={onClose} title="Edit season">
      <form action={action}>
        <input type="hidden" name="id" value={season.id} />
        <Field label="Name">
          <Input name="name" defaultValue={season.name} required />
        </Field>
        <Field label="Intention">
          <Textarea name="intention" rows={2} defaultValue={season.intention ?? ""} placeholder="What this season is about" />
        </Field>
        <Field label="Weekly capacity" hint="hours you can really give">
          <Stepper name="capacity" value={cap} onChange={setCap} min={1} max={100} format={(v) => `${v}h`} />
        </Field>
        <ErrorNote error={error} />
        <SubmitButton variant="accent" size="lg" className="mt-2">Save</SubmitButton>
      </form>
    </Sheet>
  );
}
