"use client";

import { ChevronDown, ChevronRight, ChevronUp, Play, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useOptimistic, useState, useTransition } from "react";
import { Button, SubmitButton } from "@/components/ui/button";
import { ColorPicker, Field, Input, Stepper, Textarea } from "@/components/ui/controls";
import { springs } from "@/components/ui/motion";
import { Section } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import type { WorkoutTemplate } from "@/db/schema";
import { cn } from "@/lib/cn";
import { colorVar, tint } from "@/lib/colors";
import { repsLabel } from "@/lib/fitness-library";
import { fmtRest, type ExerciseOption } from "@/lib/fitness-math";
import { startWorkout } from "../../actions";
import { ErrorNote } from "../../_components/day-actions";
import { ExercisePicker } from "../../_components/exercise-picker";
import {
  addRoutineExercise,
  deleteRoutine,
  moveRoutineExercise,
  removeRoutineExercise,
  updateRoutine,
  updateRoutineExercise,
} from "../actions";
import { listText } from "@/lib/text";

type Item = {
  id: string;
  exerciseId: string;
  name: string;
  weightBasis: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  reps: string;
  restSec: number;
  notes: string | null;
  provisional: boolean;
};

type Op = { type: "move"; id: string; dir: -1 | 1 } | { type: "remove"; id: string } | { type: "add"; item: Item };

function reduce(items: Item[], op: Op): Item[] {
  if (op.type === "add") return [...items, op.item];
  if (op.type === "remove") return items.filter((i) => i.id !== op.id);
  const i = items.findIndex((x) => x.id === op.id);
  const j = i + op.dir;
  if (i < 0 || j < 0 || j >= items.length) return items;
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function RoutineEditor({
  routine,
  items,
  exercises,
  days,
  isNew,
}: {
  routine: WorkoutTemplate;
  items: Item[];
  exercises: ExerciseOption[];
  days: string[];
  isNew: boolean;
}) {
  const [list, apply] = useOptimistic(items, reduce);
  const [, start] = useTransition();
  const [details, setDetails] = useState(isNew);
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [starting, startTransition] = useTransition();
  const totalSets = list.reduce((a, i) => a + i.sets, 0);

  const run = (op: Op, fn: () => Promise<unknown>) =>
    start(async () => {
      apply(op);
      await fn();
    });

  return (
    <div className="pb-2" style={tint(routine.color)}>
      <header className="pt-5 pb-4 lg:pt-10 lg:pb-5">
        <button type="button" onClick={() => setDetails(true)} className="tap block w-full text-left">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink-3">
            <span className="size-2 rounded-full" style={{ background: colorVar(routine.color) }} />
            {days.length ? days.join(", ") : "Not scheduled"}
          </div>
          <h1 className="display mt-1.5 text-[28px] text-ink">{routine.name}</h1>
          {routine.focus && <p className="mt-1 text-[15px] text-ink-2">{listText(routine.focus)}</p>}
          <p className="tnum mt-2 text-[13px] text-ink-3">
            {list.length} exercises, {totalSets} sets, about {routine.estimatedMin} min.{" "}
            <span className="font-medium text-ink underline decoration-line-strong underline-offset-4">Edit</span>
          </p>
        </button>
        {routine.notes && <p className="mt-3 text-[14px] leading-relaxed whitespace-pre-line text-ink-2">{routine.notes}</p>}
        <Button
          variant="accent"
          size="lg"
          className="mt-5 h-[52px] text-[16.5px]"
          loading={starting}
          disabled={!list.length}
          onClick={() => startTransition(() => startWorkout(routine.id))}
        >
          <Play className="size-4 fill-current" /> Start workout
        </Button>
      </header>

      <Section title="Exercises" hint="Tap one to change its sets, reps and rest." card>
        {list.map((it, i) => (
          <motion.div key={it.id} layout transition={springs.smooth} className="flex items-center">
            <button type="button" onClick={() => setEditing(it)} className="tap-row flex min-h-[60px] min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left">
              <span className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="tnum w-4 shrink-0 text-[12.5px] font-medium text-ink-3">{i + 1}</span>
                <span className="truncate text-[15.5px] font-medium text-ink">{it.name}</span>
                {it.provisional && (
                  <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">Provisional</span>
                )}
              </div>
              <div className="tnum mt-0.5 pl-6 text-[13px] text-ink-2">
                {it.sets} × {repsLabel(it.repsMin, it.repsMax, it.reps)}
                <span className="text-ink-3"> · rest {fmtRest(it.restSec)}</span>
              </div>
              {it.notes && <div className="mt-0.5 truncate pl-6 text-[12.5px] text-ink-3">{it.notes}</div>}
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-3" />
            </button>
          </motion.div>
        ))}
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="tap-row flex h-[52px] w-full items-center justify-center gap-1.5 text-[14.5px] font-medium text-ink-2"
        >
          <Plus className="size-4" /> Add exercise
        </button>
      </Section>

      <DeleteRoutine id={routine.id} />

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        exercises={exercises}
        onPick={(ex) =>
          run(
            {
              type: "add",
              item: {
                id: `tmp-${ex.id}`,
                exerciseId: ex.id,
                name: ex.name,
                weightBasis: ex.weightBasis,
                sets: 3,
                repsMin: 8,
                repsMax: 12,
                reps: "8–12",
                restSec: 90,
                notes: null,
                provisional: false,
              },
            },
            () => addRoutineExercise(routine.id, ex.id),
          )
        }
      />

      <DetailsSheet open={details} onClose={() => setDetails(false)} routine={routine} />
      <ItemSheet
        item={editing}
        onClose={() => setEditing(null)}
        onRemove={(id) => run({ type: "remove", id }, () => removeRoutineExercise(id))}
        canUp={!!editing && list.findIndex((x) => x.id === editing.id) > 0}
        canDown={!!editing && list.findIndex((x) => x.id === editing.id) < list.length - 1}
        onMove={(id, dir) => run({ type: "move", id, dir }, () => moveRoutineExercise(id, dir))}
      />
    </div>
  );
}

function useFormAction(fn: (fd: FormData) => Promise<unknown>, done: () => void) {
  const [error, setError] = useState<string | null>(null);
  return {
    error,
    action: async (fd: FormData) => {
      setError(null);
      try {
        await fn(fd);
        done();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't save. Try again.");
      }
    },
  };
}

function DetailsSheet({ open, onClose, routine }: { open: boolean; onClose: () => void; routine: WorkoutTemplate }) {
  const { error, action } = useFormAction(updateRoutine, onClose);
  return (
    <Sheet open={open} onClose={onClose} title="Routine">
      <form action={action} key={routine.id + routine.name}>
        <input type="hidden" name="id" value={routine.id} />
        <Field label="Name">
          <Input name="name" defaultValue={routine.name === "New routine" ? "" : routine.name} placeholder="e.g. Push A" required />
        </Field>
        <Field label="Focus" hint="optional">
          <Input name="focus" defaultValue={routine.focus ?? ""} placeholder="e.g. Chest, shoulders, triceps" />
        </Field>
        <Field label="Colour">
          <ColorPicker name="color" defaultValue={routine.color} />
        </Field>
        <Field label="Estimated time" hint="minutes">
          <Input name="estimatedMin" type="number" inputMode="numeric" min={5} max={300} defaultValue={routine.estimatedMin} />
        </Field>
        <Field label="Notes" hint="optional">
          <Textarea name="notes" rows={2} defaultValue={routine.notes ?? ""} placeholder="e.g. 15 working sets" />
        </Field>
        <ErrorNote error={error} />
        <SubmitButton variant="accent" size="lg">Save</SubmitButton>
      </form>
    </Sheet>
  );
}

const RESTS = [45, 60, 75, 90, 120, 150, 180];

function ItemSheet({
  item,
  onClose,
  onRemove,
  canUp,
  canDown,
  onMove,
}: {
  item: Item | null;
  onClose: () => void;
  onRemove: (id: string) => void;
  canUp: boolean;
  canDown: boolean;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const { error, action } = useFormAction(updateRoutineExercise, onClose);
  const [sets, setSets] = useState(3);
  const [rest, setRest] = useState(90);
  const [lastId, setLastId] = useState<string | null>(null);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setSets(item.sets);
    setRest(item.restSec);
  }
  const temp = item?.id.startsWith("tmp-");
  return (
    <Sheet open={!!item} onClose={onClose} title={item?.name} description={temp ? "Saving…" : "Prescription"}>
      {item && (
        <form action={action} key={item.id}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="restSec" value={rest} />
          <input type="hidden" name="reps" value={item.reps} />
          <Field label="Working sets">
            <Stepper name="sets" value={sets} onChange={setSets} min={1} max={20} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reps from">
              <Input name="repsMin" type="number" inputMode="numeric" min={1} defaultValue={item.repsMin ?? ""} placeholder="8" />
            </Field>
            <Field label="to">
              <Input name="repsMax" type="number" inputMode="numeric" min={1} defaultValue={item.repsMax ?? ""} placeholder="12" />
            </Field>
          </div>
          <Field label="Rest">
            <div className="flex flex-wrap gap-1.5">
              {RESTS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRest(r)}
                  className={cn(
                    "tap tnum h-10 rounded-full px-3.5 text-[14px] font-medium",
                    rest === r ? "bg-ink text-bg" : "bg-sunken text-ink-2",
                  )}
                >
                  {fmtRest(r)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notes" hint="optional">
            <Input name="notes" defaultValue={item.notes ?? ""} placeholder="e.g. Or cable pushdown. Choose one." />
          </Field>
          <label className="mb-5 flex min-h-12 items-center justify-between gap-3 rounded-[12px] border border-line-strong px-4 py-2 text-[15px] text-ink">
            <span>
              Provisional <span className="text-[13px] text-ink-3">· still testing this prescription</span>
            </span>
            <input type="checkbox" name="provisional" defaultChecked={item.provisional} className="size-5 accent-[var(--accent)]" />
          </label>
          <ErrorNote error={error} />
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="danger"
              size="icon"
              className="size-12 rounded-[12px]"
              aria-label="Remove from routine"
              disabled={temp}
              onClick={() => {
                onRemove(item.id);
                onClose();
              }}
            >
              <Trash2 className="size-[18px]" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12 rounded-[12px]"
              aria-label="Move up"
              disabled={temp || !canUp}
              onClick={() => onMove(item.id, -1)}
            >
              <ChevronUp className="size-[18px]" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12 rounded-[12px]"
              aria-label="Move down"
              disabled={temp || !canDown}
              onClick={() => onMove(item.id, 1)}
            >
              <ChevronDown className="size-[18px]" />
            </Button>
            <SubmitButton variant="accent" size="lg" className="flex-1" disabled={temp}>
              Save
            </SubmitButton>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function DeleteRoutine({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (confirm ? start(() => deleteRoutine(id)) : setConfirm(true))}
      className="tap mt-6 h-11 w-full rounded-[12px] text-[14px] font-medium text-ink-2 hover:text-ink"
    >
      {pending ? "Deleting…" : confirm ? "Tap again to delete. Past sessions are kept." : "Delete routine"}
    </button>
  );
}
