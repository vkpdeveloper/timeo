"use client";

import { CalendarCheck, CalendarPlus, Check, Ellipsis, Flag, ListPlus, Pencil, Plus, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { protectTime } from "@/actions/blocks";
import type { GoalOption } from "@/actions/context";
import { setTaskDone } from "@/actions/tasks";
import { TaskSheet } from "@/components/forms/sheets";
import { Button, SubmitButton } from "@/components/ui/button";
import { CheckCircle, Field, Input, Segmented, Textarea } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import type { Goal, Milestone, Task } from "@/db/schema";
import type { CoachRecommendation } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { formatMin, formatMonthDay, relativeDay } from "@/lib/dates";
import {
  addGoalUpdate,
  createMilestone,
  deleteGoal,
  deleteMilestone,
  scheduleStep,
  setGoalComplete,
  setMilestoneDone,
  updateMilestone,
} from "../actions";
import { ErrorNote, GoalSheet, useSubmit } from "../_components/goal-sheets";

type Ctx = { goals: GoalOption[]; today: string };

// ─────────────────────────── Goal menu ───────────────────────────

export function GoalMenu({ goal, endDateLabel }: { goal: Goal; endDateLabel: string }) {
  const [mode, setMode] = useState<null | "menu" | "edit" | "delete">(null);
  const [pending, start] = useTransition();
  const done = goal.completedAt != null;
  const close = () => setMode(null);

  return (
    <>
      <button type="button" onClick={() => setMode("menu")} aria-label="Goal options" className="tap -mr-1.5 grid size-10 place-items-center rounded-full text-accent">
        <Ellipsis className="size-[22px]" strokeWidth={2.2} />
      </button>
      <Sheet open={mode === "menu"} onClose={close} title={goal.title}>
        <div className="card overflow-hidden">
          <MenuItem icon={<Pencil />} onClick={() => setMode("edit")}>Edit goal</MenuItem>
          <MenuItem
            icon={done ? <Undo2 /> : <Check />}
            onClick={() =>
              start(async () => {
                await setGoalComplete(goal.id, !done);
                close();
              })
            }
          >
            {done ? "Reopen goal" : "Mark complete"}
          </MenuItem>
          <MenuItem icon={<Trash2 />} danger onClick={() => setMode("delete")}>Delete goal</MenuItem>
        </div>
        {pending && <p className="mt-3 px-1 text-[13px] text-ink-3">Saving…</p>}
      </Sheet>
      <GoalSheet open={mode === "edit"} onClose={close} goal={goal} endDateLabel={endDateLabel} />
      <Sheet open={mode === "delete"} onClose={close} title="Delete this goal?" description="Its milestones and check-ins go too. Tasks and blocks stay, without a goal.">
        <div className="flex gap-2.5 pt-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" className="flex-1" loading={pending} onClick={() => start(() => deleteGoal(goal.id))}>
            Delete
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium active:bg-sunken [&_svg]:size-[18px] [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line",
        danger ? "text-bad" : "text-ink [&_svg]:text-ink-3",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ─────────────────────────── Coach ───────────────────────────

export function CoachAction({ rec, ctx, goalTitle }: { rec: CoachRecommendation; ctx: Ctx; goalTitle: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sheet, setSheet] = useState<null | "step" | "milestone">(null);

  const icon = {
    protect_time: <ShieldCheck className="size-[18px]" />,
    schedule_step: <CalendarPlus className="size-[18px]" />,
    add_weekly_step: <ListPlus className="size-[18px]" />,
    add_milestone: <Flag className="size-[18px]" />,
  }[rec.kind];

  const run = () => {
    if (rec.kind === "add_weekly_step") return setSheet("step");
    if (rec.kind === "add_milestone") return setSheet("milestone");
    start(async () => {
      const r = rec.kind === "protect_time" ? await protectTime(rec.goalId) : await scheduleStep(rec.taskId!);
      setResult(
        r.ok
          ? { ok: true, text: `Blocked ${relativeDay(r.date, ctx.today).toLowerCase()}, ${formatMin(r.start)}–${formatMin(r.end)}` }
          : { ok: false, text: r.message },
      );
    });
  };

  if (result?.ok)
    return (
      <div className="flex items-center gap-2.5 rounded-2xl bg-ok-soft px-4 py-3 text-[14px] font-medium text-ok">
        <CalendarCheck className="size-[18px] shrink-0" />
        {result.text}
      </div>
    );

  return (
    <>
      <Button variant="tint" size="lg" loading={pending} onClick={run}>
        {icon}
        {rec.label}
      </Button>
      {result && !result.ok && <p className="mt-2 px-1 text-[13px] text-bad">{result.text}</p>}
      <TaskSheet open={sheet === "step"} onClose={() => setSheet(null)} goals={ctx.goals} today={ctx.today} defaults={{ goalId: rec.goalId, weekly: true }} />
      <MilestoneSheet open={sheet === "milestone"} onClose={() => setSheet(null)} goalId={rec.goalId} description={goalTitle} />
    </>
  );
}

// ─────────────────────────── Tasks ───────────────────────────

function TaskRow({ task, today, onOpen }: { task: Task; today: string; onOpen: () => void }) {
  const [done, setDone] = useOptimistic(task.doneAt != null);
  const [, start] = useTransition();
  const overdue = !done && task.dueDate != null && task.dueDate < today;
  return (
    <div className="flex items-center gap-3 px-4 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
      <CheckCircle
        checked={done}
        onToggle={() =>
          start(async () => {
            setDone(!done);
            await setTaskDone(task.id, !done);
          })
        }
      />
      <button type="button" onClick={onOpen} className="tap flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
        <span className={cn("min-w-0 flex-1 text-[15px] leading-snug", done ? "text-ink-3 line-through decoration-line-strong" : "text-ink")}>{task.title}</span>
        {task.dueDate && (
          <span className={cn("tnum shrink-0 text-[12.5px]", overdue ? "font-medium text-bad" : "text-ink-3")}>
            {relativeDay(task.dueDate, today)}
          </span>
        )}
      </button>
    </div>
  );
}

export function TaskList({
  tasks,
  ctx,
  goalId,
  weekly,
  empty,
}: {
  tasks: Task[];
  ctx: Ctx;
  goalId: string;
  weekly?: boolean;
  empty?: string;
}) {
  const [editing, setEditing] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="card overflow-hidden">
        {tasks.length === 0 && empty && <p className="px-4 pt-4 pb-1 text-[14px] text-ink-3">{empty}</p>}
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} today={ctx.today} onOpen={() => setEditing(task)} />
        ))}
        {weekly && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={cn("tap flex w-full items-center gap-2 px-4 py-3.5 text-[14.5px] font-medium text-accent active:bg-sunken", tasks.length > 0 && "border-t border-line")}
          >
            <Plus className="size-4" strokeWidth={2.4} /> Add a step
          </button>
        )}
      </div>
      <TaskSheet open={!!editing} onClose={() => setEditing(null)} goals={ctx.goals} today={ctx.today} task={editing ?? undefined} key={editing?.id ?? "edit"} />
      <TaskSheet open={adding} onClose={() => setAdding(false)} goals={ctx.goals} today={ctx.today} defaults={{ goalId, weekly: true }} />
    </>
  );
}

// ─────────────────────────── Milestones ───────────────────────────

function MilestoneSheet({
  open,
  onClose,
  goalId,
  milestone,
  description,
}: {
  open: boolean;
  onClose: () => void;
  goalId: string;
  milestone?: Milestone;
  description?: string;
}) {
  const { error, action } = useSubmit(milestone ? updateMilestone : createMilestone, onClose);
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onClose={onClose} title={milestone ? "Edit milestone" : "New milestone"} description={description}>
      <form action={action} key={milestone?.id ?? "new"}>
        <input type="hidden" name="goalId" value={goalId} />
        {milestone && <input type="hidden" name="id" value={milestone.id} />}
        <Field>
          <Input name="title" placeholder="e.g. Beta in 10 hands" defaultValue={milestone?.title} autoFocus={!milestone} required />
        </Field>
        <Field label="Date" hint="optional">
          <Input type="date" name="dueDate" defaultValue={milestone?.dueDate ?? ""} />
        </Field>
        <ErrorNote error={error} />
        <div className="flex gap-2.5">
          {milestone && (
            <Button
              type="button"
              variant="danger"
              size="icon"
              className="size-[52px] rounded-2xl"
              loading={pending}
              aria-label="Delete milestone"
              onClick={() =>
                start(async () => {
                  await deleteMilestone(milestone.id);
                  onClose();
                })
              }
            >
              <Trash2 className="size-[18px]" />
            </Button>
          )}
          <SubmitButton size="lg" className="flex-1">{milestone ? "Save" : "Add milestone"}</SubmitButton>
        </div>
      </form>
    </Sheet>
  );
}

function MilestoneRow({ m, today, onOpen }: { m: Milestone; today: string; onOpen: () => void }) {
  const [done, setDone] = useOptimistic(m.doneAt != null);
  const [, start] = useTransition();
  const overdue = !done && m.dueDate != null && m.dueDate < today;
  return (
    <div className="flex items-center gap-3 px-4 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
      <CheckCircle
        checked={done}
        onToggle={() =>
          start(async () => {
            setDone(!done);
            await setMilestoneDone(m.id, !done);
          })
        }
      />
      <button type="button" onClick={onOpen} className="tap flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
        <span className={cn("min-w-0 flex-1 text-[15px] leading-snug", done ? "text-ink-3 line-through decoration-line-strong" : "text-ink")}>{m.title}</span>
        {m.dueDate && (
          <span className={cn("tnum shrink-0 text-[12.5px]", overdue ? "font-medium text-bad" : "text-ink-3")}>
            {overdue ? "Overdue · " : ""}
            {formatMonthDay(m.dueDate)}
          </span>
        )}
      </button>
    </div>
  );
}

export function MilestoneList({ milestones, goalId, today }: { milestones: Milestone[]; goalId: string; today: string }) {
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="card overflow-hidden">
        {milestones.map((m) => (
          <MilestoneRow key={m.id} m={m} today={today} onOpen={() => setEditing(m)} />
        ))}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={cn("tap flex w-full items-center gap-2 px-4 py-3.5 text-[14.5px] font-medium text-accent active:bg-sunken", milestones.length > 0 && "border-t border-line")}
        >
          <Plus className="size-4" strokeWidth={2.4} /> Add milestone
        </button>
      </div>
      <MilestoneSheet open={!!editing} onClose={() => setEditing(null)} goalId={goalId} milestone={editing ?? undefined} key={editing?.id ?? "edit"} />
      <MilestoneSheet open={adding} onClose={() => setAdding(false)} goalId={goalId} />
    </>
  );
}

// ─────────────────────────── Check in ───────────────────────────

const STATUS_OPTIONS = [
  { value: "on_track", label: "On track" },
  { value: "adjust", label: "Adjust" },
  { value: "off_track", label: "Off track" },
] as const;

export function CheckInButton({ goalId, suggested }: { goalId: string; suggested: Goal["status"] }) {
  const [open, setOpen] = useState(false);
  const [confidence, setConfidence] = useState(70);
  const { error, action } = useSubmit(addGoalUpdate, () => setOpen(false));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="tap inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
        <Plus className="size-3.5" strokeWidth={2.6} /> Check in
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Check in" description="An honest read on this goal today.">
        <form action={action}>
          <input type="hidden" name="goalId" value={goalId} />
          <Field label="Status">
            <Segmented name="status" defaultValue={suggested} options={STATUS_OPTIONS.map((o) => ({ ...o }))} />
          </Field>
          <Field label="Confidence" hint="that you hit it this season">
            <div className="flex items-center gap-4 rounded-2xl bg-sunken px-4 py-3">
              <input
                type="range"
                name="confidence"
                min={0}
                max={100}
                step={5}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="h-2 flex-1 accent-[var(--tint)]"
              />
              <span className="tnum w-11 text-right text-[17px] font-semibold text-ink">{confidence}%</span>
            </div>
          </Field>
          <Field label="Note" hint="optional">
            <Textarea name="note" rows={2} placeholder="What changed, what's next" />
          </Field>
          <ErrorNote error={error} />
          <SubmitButton size="lg">Save check-in</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
