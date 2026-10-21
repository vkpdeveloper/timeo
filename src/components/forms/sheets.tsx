"use client";

import { Trash2 } from "lucide-react";
import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { createBlock, deleteBlock, updateBlock } from "@/actions/blocks";
import type { GoalOption } from "@/actions/context";
import { logBodyMetric, logMeal } from "@/actions/health";
import { createTask, deleteTask, updateTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Field, Input, PillPicker, Segmented, Select, Textarea } from "@/components/ui/controls";
import { DatePicker, TimePicker } from "@/components/ui/pickers";
import { Sheet } from "@/components/ui/sheet";
import type { Block, Task } from "@/db/schema";
import { colorVar } from "@/lib/colors";
import { addDays, formatDuration, parseTime, toTimeInput } from "@/lib/dates";

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

/** Submits the sheet's form in a transition; the footer button reads `pending` and targets `formId`. */
function useSubmit(action: (fd: FormData) => Promise<unknown>, onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formId = useId();
  return {
    error,
    pending,
    formId,
    onSubmit: (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      setError(null);
      start(async () => {
        try {
          await action(fd);
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      });
    },
  };
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mb-4 animate-pop rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">
      {error}
    </p>
  );
}

/** One primary action at the bottom of a sheet, with an optional delete beside it. */
function SheetFooter({
  formId,
  pending,
  children,
  onDelete,
  deleting,
  deleteLabel,
}: {
  formId: string;
  pending: boolean;
  children: ReactNode;
  onDelete?: () => void;
  deleting?: boolean;
  deleteLabel?: string;
}) {
  return (
    <div className="flex gap-2.5">
      {onDelete && (
        <Button
          type="button"
          variant="danger"
          size="icon"
          className="size-12 rounded-2xl"
          loading={deleting}
          disabled={pending}
          aria-label={deleteLabel}
          onClick={onDelete}
        >
          <Trash2 className="size-[18px]" />
        </Button>
      )}
      <Button type="submit" form={formId} variant="accent" size="lg" className="flex-1" loading={pending} disabled={deleting}>
        {children}
      </Button>
    </div>
  );
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
  const { error, pending: saving, formId, onSubmit } = useSubmit(task ? updateTask : createTask, onClose);
  const [due, setDue] = useState<string>(task?.dueDate ?? defaults?.dueDate ?? today);
  const [pending, start] = useTransition();
  const tomorrow = addDays(today, 1);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      footer={
        <SheetFooter
          formId={formId}
          pending={saving}
          onDelete={task ? () => start(async () => { await deleteTask(task.id); onClose(); }) : undefined}
          deleting={pending}
          deleteLabel="Delete task"
        >
          {task ? "Save" : "Add task"}
        </SheetFooter>
      }
    >
      <form id={formId} onSubmit={onSubmit} key={task?.id ?? "new"}>
        {task && <input type="hidden" name="id" value={task.id} />}
        {defaults?.weekly && <input type="hidden" name="weekly" value="1" />}
        {defaults?.milestoneId && <input type="hidden" name="milestoneId" value={defaults.milestoneId} />}
        <Field>
          <Input name="title" placeholder="What needs doing?" aria-label="Task" defaultValue={task?.title} autoFocus required className="text-[17px] font-medium" />
        </Field>
        <Field label="Goal">
          <GoalSelect goals={goals} defaultValue={task?.goalId ?? defaults?.goalId} />
        </Field>
        <Field label="When">
          <PillPicker<"today" | "tomorrow" | "none" | "other">
            value={due === today ? "today" : due === tomorrow ? "tomorrow" : due ? "other" : "none"}
            onChange={(v) => setDue(v === "today" ? today : v === "tomorrow" ? tomorrow : "")}
            options={[
              { value: "today", label: "Today" },
              { value: "tomorrow", label: "Tomorrow" },
              { value: "none", label: "Someday" },
            ]}
          />
          <DatePicker name="dueDate" className="mt-2.5" value={due} onChange={setDue} today={today} placeholder="Another day" clearable aria-label="Due date" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time" hint="optional">
            <TimePicker name="dueTime" defaultValue={toTimeInput(task?.dueMin)} placeholder="Any time" clearable aria-label="Due time" />
          </Field>
          <Field label="Estimate" hint="min">
            <Input type="number" name="estimateMin" inputMode="numeric" min={5} step={5} placeholder="30" defaultValue={task?.estimateMin ?? ""} />
          </Field>
        </div>
        <Field label="Notes" className="mb-1">
          <Textarea name="notes" rows={2} placeholder="Anything useful" defaultValue={task?.notes ?? ""} />
        </Field>
        <ErrorNote error={error} />
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
  const { error, pending: saving, formId, onSubmit } = useSubmit(block ? updateBlock : createBlock, onClose);
  const [pending, start] = useTransition();
  const startMin = block?.startMin ?? defaults?.start ?? 9 * 60;
  const endMin = block?.endMin ?? defaults?.end ?? startMin + 60;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={block ? "Edit block" : "Block time"}
      description={block ? undefined : "Give a goal a place on your calendar."}
      footer={
        <SheetFooter
          formId={formId}
          pending={saving}
          onDelete={block ? () => start(async () => { await deleteBlock(block.id); onClose(); }) : undefined}
          deleting={pending}
          deleteLabel="Delete block"
        >
          {block ? "Save" : "Add to calendar"}
        </SheetFooter>
      }
    >
      <form id={formId} onSubmit={onSubmit} key={block?.id ?? "new"}>
        {block && <input type="hidden" name="id" value={block.id} />}
        {defaults?.taskId && <input type="hidden" name="taskId" value={defaults.taskId} />}
        <Field>
          <Input
            name="title"
            placeholder="e.g. Deep work: ship v2"
            aria-label="Block"
            defaultValue={block?.title ?? defaults?.title}
            autoFocus={!block}
            required
            className="text-[17px] font-medium"
          />
        </Field>
        <Field label="Type">
          <PillPicker name="kind" defaultValue={block?.kind ?? defaults?.kind ?? "focus"} options={KINDS.map((k) => ({ ...k }))} />
        </Field>
        <Field label="Goal">
          <GoalSelect goals={goals} defaultValue={block?.goalId ?? defaults?.goalId} />
        </Field>
        <Field label="Day">
          <DatePicker name="date" defaultValue={block?.date ?? defaults?.date ?? today} today={today} aria-label="Day" />
        </Field>
        <BlockTimes startMin={startMin} endMin={Math.min(endMin, 23 * 60 + 59)} />
        {block && block.rescheduleCount > 0 && (
          <p className="mb-4 px-1 text-[13px] text-ink-3">Moved {block.rescheduleCount}× so far. The coach watches for blocks that keep slipping.</p>
        )}
        <ErrorNote error={error} />
      </form>
    </Sheet>
  );
}

// ─────────────────────────── Meal ───────────────────────────

const DURATIONS = [15, 30, 45, 60, 90, 120];

/** Start and end; moving the start keeps the length, and End offers one-tap lengths. */
function BlockTimes({ startMin, endMin }: { startMin: number; endMin: number }) {
  const [start, setStart] = useState(toTimeInput(startMin));
  const [end, setEnd] = useState(toTimeInput(endMin));
  // the length the user wants; kept when the start moves (late starts may clip it at midnight)
  const [length, setLength] = useState(endMin > startMin ? endMin - startMin : 60);
  const s = parseTime(start) ?? startMin;
  const e = parseTime(end) ?? endMin;
  const last = 23 * 60 + 55;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Start">
        <TimePicker
          name="start"
          value={start}
          onChange={(v) => {
            const next = parseTime(v);
            if (next == null) return;
            setStart(v);
            setEnd(toTimeInput(Math.min(next + length, last)));
          }}
          aria-label="Start time"
        />
      </Field>
      <Field label="End" hint={e > s ? formatDuration(e - s) : undefined}>
        <TimePicker
          name="end"
          value={end}
          onChange={(v) => {
            setEnd(v);
            const next = parseTime(v);
            if (next != null && next > s) setLength(next - s);
          }}
          suggestions={DURATIONS.filter((d) => s + d <= last).map((d) => ({ label: formatDuration(d), value: toTimeInput(s + d) }))}
          aria-label="End time"
        />
      </Field>
    </div>
  );
}

export function MealSheet({ open, onClose, today }: BaseProps & { today: string }) {
  const { error, pending, formId, onSubmit } = useSubmit(logMeal, onClose);
  return (
    <Sheet open={open} onClose={onClose} title="Log a meal" footer={<SheetFooter formId={formId} pending={pending}>Log meal</SheetFooter>}>
      <form id={formId} onSubmit={onSubmit}>
        <input type="hidden" name="date" value={today} />
        <Field>
          <Input name="name" placeholder="e.g. Chicken rice bowl" aria-label="Meal" autoFocus required className="text-[17px] font-medium" />
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
      </form>
    </Sheet>
  );
}

// ─────────────────────────── Weigh-in ───────────────────────────

export function WeighInSheet({ open, onClose, today, lastWeight }: BaseProps & { today: string; lastWeight?: number | null }) {
  const { error, pending, formId, onSubmit } = useSubmit(logBodyMetric, onClose);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [value, setValue] = useState<string>(lastWeight ? String(lastWeight) : "");
  const kg = value ? (unit === "kg" ? Number(value) : Math.round((Number(value) / 2.20462) * 10) / 10) : "";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Weigh-in"
      description="Same time, same conditions works best."
      footer={<SheetFooter formId={formId} pending={pending}>Save</SheetFooter>}
    >
      <form id={formId} onSubmit={onSubmit}>
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
      </form>
    </Sheet>
  );
}

export const goalColor = (g?: { color: string } | null) => (g ? colorVar(g.color) : "var(--ink-3)");
