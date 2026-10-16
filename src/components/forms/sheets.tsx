"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createBlock, deleteBlock, updateBlock } from "@/actions/blocks";
import type { GoalOption } from "@/actions/context";
import { logBodyMetric, logMeal } from "@/actions/health";
import { createTask, deleteTask, updateTask } from "@/actions/tasks";
import { Button, SubmitButton } from "@/components/ui/button";
import { Field, Input, PillPicker, Segmented, Select, Textarea } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import type { Block, Task } from "@/db/schema";
import { colorVar } from "@/lib/colors";
import { addDays, toTimeInput } from "@/lib/dates";

type BaseProps = { open: boolean; onClose: () => void };

function GoalSelect({ goals, defaultValue }: { goals: GoalOption[]; defaultValue?: string | null }) {
  return (
    <Select name="goalId" defaultValue={defaultValue ?? ""}>
      <option value="">No goal</option>
      {goals.map((g) => (
        <option key={g.id} value={g.id}>
          {g.title}
        </option>
      ))}
    </Select>
  );
}

function useSubmit(action: (fd: FormData) => Promise<unknown>, onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  return {
    error,
    action: async (fd: FormData) => {
      setError(null);
      try {
        await action(fd);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    },
  };
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mb-3 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{error}</p>;
}

// ─────────────────────────── Task ───────────────────────────

export function TaskSheet({
  open,
  onClose,
  goals,
  today,
  task,
  defaults,
}: BaseProps & {
  goals: GoalOption[];
  today: string;
  task?: Task;
  defaults?: { goalId?: string; dueDate?: string | null; weekly?: boolean; milestoneId?: string };
}) {
  const { error, action } = useSubmit(task ? updateTask : createTask, onClose);
  const [due, setDue] = useState<string>(task?.dueDate ?? defaults?.dueDate ?? today);
  const [pending, start] = useTransition();
  const tomorrow = addDays(today, 1);

  return (
    <Sheet open={open} onClose={onClose} title={task ? "Edit task" : "New task"}>
      <form action={action} key={task?.id ?? "new"}>
        {task && <input type="hidden" name="id" value={task.id} />}
        {defaults?.weekly && <input type="hidden" name="weekly" value="1" />}
        {defaults?.milestoneId && <input type="hidden" name="milestoneId" value={defaults.milestoneId} />}
        <Field>
          <Input name="title" placeholder="What needs doing?" defaultValue={task?.title} autoFocus required />
        </Field>
        <Field label="Goal">
          <GoalSelect goals={goals} defaultValue={task?.goalId ?? defaults?.goalId} />
        </Field>
        <Field label="When">
          <PillPicker
            value={due === today ? "today" : due === tomorrow ? "tomorrow" : due ? "date" : "none"}
            onChange={(v) => setDue(v === "today" ? today : v === "tomorrow" ? tomorrow : v === "none" ? "" : due || today)}
            options={[
              { value: "today", label: "Today" },
              { value: "tomorrow", label: "Tomorrow" },
              { value: "date", label: "Pick date" },
              { value: "none", label: "Someday" },
            ]}
          />
          {due && due !== today && due !== tomorrow && (
            <Input type="date" className="mt-2.5" value={due} onChange={(e) => setDue(e.target.value)} />
          )}
          <input type="hidden" name="dueDate" value={due} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time" hint="optional">
            <Input type="time" name="dueTime" defaultValue={toTimeInput(task?.dueMin)} />
          </Field>
          <Field label="Estimate" hint="min">
            <Input type="number" name="estimateMin" inputMode="numeric" min={5} step={5} placeholder="30" defaultValue={task?.estimateMin ?? ""} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea name="notes" rows={2} placeholder="Anything useful" defaultValue={task?.notes ?? ""} />
        </Field>
        <ErrorNote error={error} />
        <div className="flex gap-2.5">
          {task && (
            <Button
              type="button"
              variant="danger"
              size="icon"
              className="size-[52px] rounded-2xl"
              loading={pending}
              aria-label="Delete task"
              onClick={() => start(async () => { await deleteTask(task.id); onClose(); })}
            >
              <Trash2 className="size-[18px]" />
            </Button>
          )}
          <SubmitButton size="lg" className="flex-1">{task ? "Save" : "Add task"}</SubmitButton>
        </div>
      </form>
    </Sheet>
  );
}

// ─────────────────────────── Time block ───────────────────────────

const KINDS = [
  { value: "focus", label: "Focus" },
  { value: "meeting", label: "Meeting" },
  { value: "workout", label: "Workout" },
  { value: "meal", label: "Meal" },
  { value: "life", label: "Life" },
  { value: "admin", label: "Admin" },
] as const;

export function BlockSheet({
  open,
  onClose,
  goals,
  today,
  block,
  defaults,
}: BaseProps & {
  goals: GoalOption[];
  today: string;
  block?: Block;
  defaults?: { date?: string; start?: number; end?: number; goalId?: string; kind?: Block["kind"]; title?: string; taskId?: string };
}) {
  const { error, action } = useSubmit(block ? updateBlock : createBlock, onClose);
  const [pending, start] = useTransition();
  const startMin = block?.startMin ?? defaults?.start ?? 9 * 60;
  const endMin = block?.endMin ?? defaults?.end ?? startMin + 60;

  return (
    <Sheet open={open} onClose={onClose} title={block ? "Edit block" : "Block time"} description={block ? undefined : "Give your goals a place on the calendar."}>
      <form action={action} key={block?.id ?? "new"}>
        {block && <input type="hidden" name="id" value={block.id} />}
        {defaults?.taskId && <input type="hidden" name="taskId" value={defaults.taskId} />}
        <Field>
          <Input name="title" placeholder="e.g. Deep work: ship v2" defaultValue={block?.title ?? defaults?.title} autoFocus={!block} required />
        </Field>
        <Field label="Type">
          <PillPicker name="kind" defaultValue={block?.kind ?? defaults?.kind ?? "focus"} options={KINDS.map((k) => ({ ...k }))} />
        </Field>
        <Field label="Goal">
          <GoalSelect goals={goals} defaultValue={block?.goalId ?? defaults?.goalId} />
        </Field>
        <Field label="Day">
          <Input type="date" name="date" defaultValue={block?.date ?? defaults?.date ?? today} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input type="time" name="start" step={300} defaultValue={toTimeInput(startMin)} required />
          </Field>
          <Field label="End">
            <Input type="time" name="end" step={300} defaultValue={toTimeInput(Math.min(endMin, 23 * 60 + 59))} required />
          </Field>
        </div>
        {block && block.rescheduleCount > 0 && (
          <p className="mb-4 px-1 text-[13px] text-ink-3">Moved {block.rescheduleCount}× so far. The coach watches for blocks that keep slipping.</p>
        )}
        <ErrorNote error={error} />
        <div className="flex gap-2.5">
          {block && (
            <Button
              type="button"
              variant="danger"
              size="icon"
              className="size-[52px] rounded-2xl"
              loading={pending}
              aria-label="Delete block"
              onClick={() => start(async () => { await deleteBlock(block.id); onClose(); })}
            >
              <Trash2 className="size-[18px]" />
            </Button>
          )}
          <SubmitButton size="lg" className="flex-1">{block ? "Save" : "Add to calendar"}</SubmitButton>
        </div>
      </form>
    </Sheet>
  );
}

// ─────────────────────────── Meal ───────────────────────────

export function MealSheet({ open, onClose, today }: BaseProps & { today: string }) {
  const { error, action } = useSubmit(logMeal, onClose);
  return (
    <Sheet open={open} onClose={onClose} title="Log a meal">
      <form action={action}>
        <input type="hidden" name="date" value={today} />
        <Field>
          <Input name="name" placeholder="e.g. Chicken rice bowl" autoFocus required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories" hint="kcal">
            <Input type="number" inputMode="numeric" name="calories" placeholder="0" min={0} />
          </Field>
          <Field label="Protein" hint="g">
            <Input type="number" inputMode="numeric" name="protein" placeholder="0" min={0} />
          </Field>
          <Field label="Carbs" hint="g">
            <Input type="number" inputMode="numeric" name="carbs" placeholder="0" min={0} />
          </Field>
          <Field label="Fat" hint="g">
            <Input type="number" inputMode="numeric" name="fat" placeholder="0" min={0} />
          </Field>
        </div>
        <ErrorNote error={error} />
        <SubmitButton size="lg">Log meal</SubmitButton>
      </form>
    </Sheet>
  );
}

// ─────────────────────────── Weigh-in ───────────────────────────

export function WeighInSheet({ open, onClose, today, lastWeight }: BaseProps & { today: string; lastWeight?: number | null }) {
  const { error, action } = useSubmit(logBodyMetric, onClose);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [value, setValue] = useState<string>(lastWeight ? String(lastWeight) : "");
  const kg = value ? (unit === "kg" ? Number(value) : Math.round((Number(value) / 2.20462) * 10) / 10) : "";
  return (
    <Sheet open={open} onClose={onClose} title="Weigh-in" description="Same time, same conditions works best.">
      <form action={action}>
        <input type="hidden" name="date" value={today} />
        <input type="hidden" name="weightKg" value={kg} />
        <div className="mb-4 flex items-center gap-3">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="0.0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="tnum flex-1 text-center !text-[28px] font-semibold"
            autoFocus
          />
          <Segmented
            className="w-28"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "kg", label: "kg" },
              { value: "lb", label: "lb" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Body fat" hint="%">
            <Input type="number" inputMode="decimal" step="0.1" name="bodyFatPct" placeholder="optional" />
          </Field>
          <Field label="Waist" hint="cm">
            <Input type="number" inputMode="decimal" step="0.5" name="waistCm" placeholder="optional" />
          </Field>
        </div>
        <ErrorNote error={error} />
        <SubmitButton size="lg">Save</SubmitButton>
      </form>
    </Sheet>
  );
}

export const goalColor = (g?: { color: string } | null) => (g ? colorVar(g.color) : "var(--ink-3)");
