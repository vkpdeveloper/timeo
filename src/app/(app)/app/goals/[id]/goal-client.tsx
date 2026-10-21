"use client";

import { CalendarCheck, CalendarPlus, Check, CircleAlert, Ellipsis, Flag, ListPlus, Pencil, Plus, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { protectTime } from "@/actions/blocks";
import type { GoalOption } from "@/actions/context";
import { setTaskDone } from "@/actions/tasks";
import { TaskSheet } from "@/components/forms/sheets";
import { Button, SubmitButton } from "@/components/ui/button";
import { CheckCircle, Field, Input, Segmented, Textarea } from "@/components/ui/controls";
import { DatePicker } from "@/components/ui/pickers";
import { springs } from "@/components/ui/motion";
import { Sheet } from "@/components/ui/sheet";
import type { Goal, Milestone, Task } from "@/db/schema";
import type { CoachRecommendation } from "@/lib/coach";
import { cn } from "@/lib/cn";
import { diffDays, formatMin, formatMonthDay, relativeDay } from "@/lib/dates";
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
import { ConfidenceSlider } from "../_components/confidence-slider";
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
      <button type="button" onClick={() => setMode("menu")} aria-label="Goal options" className="tap -mr-1.5 grid size-11 place-items-center rounded-full text-ink-2 hover:text-ink">
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
        "text-ink [&_svg]:text-ink-3",
        danger && "[&_svg]:text-ink-2",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ─────────────────────────── Coach ───────────────────────────

/** The coach's one next step. Full width accent on the goal page, a quiet chip on overview cards. */
export function CoachAction({
  rec,
  ctx,
  goalTitle,
  compact = false,
}: {
  rec: CoachRecommendation;
  ctx: Ctx;
  goalTitle: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sheet, setSheet] = useState<null | "step" | "milestone">(null);

  const iconCls = compact ? "size-4" : "size-[18px]";
  const icon = {
    protect_time: <ShieldCheck className={iconCls} />,
    schedule_step: <CalendarPlus className={iconCls} />,
    add_weekly_step: <ListPlus className={iconCls} />,
    add_milestone: <Flag className={iconCls} />,
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
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springs.snappy}
        className={cn(
          "flex items-center gap-2 font-medium text-ok",
          compact ? "min-h-9 text-[13px]" : "rounded-[12px] bg-ok-soft px-4 py-3 text-[14px]",
        )}
      >
        <CalendarCheck className={cn(iconCls, "shrink-0")} />
        {result.text}
      </motion.div>
    );

  return (
    <>
      <Button variant={compact ? "outline" : "accent"} size={compact ? "sm" : "lg"} loading={pending} onClick={run}>
        {icon}
        {rec.label}
      </Button>
      {result && !result.ok && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 px-1 text-[13px] font-medium text-warn">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          {result.text}
        </p>
      )}
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
    <div className="flex min-h-[52px] items-center gap-3 px-4 py-1.5">
      <CheckCircle
        checked={done}
        onToggle={() =>
          start(async () => {
            setDone(!done);
            await setTaskDone(task.id, !done);
          })
        }
      />
      <button type="button" onClick={onOpen} className="tap flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className={cn(
            "min-w-0 flex-1 text-[15px] leading-snug transition-colors duration-200",
            done ? "text-ink-3 line-through decoration-line-strong" : "text-ink",
          )}
        >
          {task.title}
        </span>
        {task.dueDate && (
          <span className={cn("tnum shrink-0 text-[12.5px]", overdue ? "font-medium text-warn" : "text-ink-3")}>
            {relativeDay(task.dueDate, today)}
          </span>
        )}
      </button>
    </div>
  );
}

function AddRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-row flex min-h-[52px] w-full items-center gap-3 px-4 text-[14.5px] font-medium text-ink-2 hover:text-ink"
    >
      <span className="grid size-6 place-items-center">
        <Plus className="size-[18px]" strokeWidth={2.4} />
      </span>
      {children}
    </button>
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
      <div className="card card-list overflow-hidden">
        {tasks.length === 0 && empty && <p className="px-4 pt-3.5 pb-1 text-[13.5px] text-ink-3">{empty}</p>}
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} today={ctx.today} onOpen={() => setEditing(task)} />
        ))}
        {weekly && <AddRow onClick={() => setAdding(true)}>Add a step</AddRow>}
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
          <DatePicker name="dueDate" defaultValue={milestone?.dueDate ?? ""} placeholder="No date" clearable aria-label="Milestone date" />
        </Field>
        <ErrorNote error={error} />
        <div className="flex gap-2.5">
          {milestone && (
            <Button
              type="button"
              variant="danger"
              size="icon"
              className="size-12 rounded-[12px]"
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
          <SubmitButton variant="accent" size="lg" className="flex-1">
            {milestone ? "Save" : "Add milestone"}
          </SubmitButton>
        </div>
      </form>
    </Sheet>
  );
}

/** "Oct 28 · in 7 days", "Overdue · Oct 10", "Done". */
function milestoneWhen(m: Milestone, done: boolean, today: string) {
  if (done) return "Done";
  if (!m.dueDate) return "No date";
  if (m.dueDate < today) return `Overdue · ${formatMonthDay(m.dueDate)}`;
  const days = diffDays(m.dueDate, today);
  if (days <= 1) return relativeDay(m.dueDate, today);
  return `${formatMonthDay(m.dueDate)} · ${days < 14 ? `in ${days} days` : `in ${Math.round(days / 7)} weeks`}`;
}

function MilestoneNode({
  m,
  today,
  first,
  last,
  next,
  onOpen,
}: {
  m: Milestone;
  today: string;
  first: boolean;
  last: boolean;
  next: boolean;
  onOpen: () => void;
}) {
  const [done, setDone] = useOptimistic(m.doneAt != null);
  const [, start] = useTransition();
  const overdue = !done && m.dueDate != null && m.dueDate < today;
  return (
    <li className="relative flex min-h-[56px] items-center gap-3 px-4">
      {/* rail: the segment above this node, then below it */}
      {!first && <span className="absolute top-0 left-[27.5px] h-1/2 w-px bg-line-strong" aria-hidden />}
      {!last && (
        <span
          className={cn("absolute bottom-0 left-[27.5px] h-1/2 w-px transition-colors duration-300", done ? "bg-tint" : "bg-line-strong")}
          aria-hidden
        />
      )}
      <span className="relative z-10 rounded-full bg-surface">
        <CheckCircle
          checked={done}
          size={22}
          label={done ? `Reopen ${m.title}` : `Mark ${m.title} done`}
          onToggle={() =>
            start(async () => {
              setDone(!done);
              await setMilestoneDone(m.id, !done);
            })
          }
        />
      </span>
      <button type="button" onClick={onOpen} className="tap flex min-h-11 min-w-0 flex-1 flex-col justify-center py-1.5 text-left">
        <span
          className={cn(
            "text-[15px] leading-snug transition-colors duration-200",
            done ? "text-ink-3 line-through decoration-line-strong" : next ? "font-semibold text-ink" : "text-ink",
          )}
        >
          {m.title}
        </span>
        <span className={cn("tnum mt-0.5 text-[12.5px]", overdue ? "font-medium text-warn" : "text-ink-3")}>
          {next && !overdue && <span className="font-medium text-ink-2">Next · </span>}
          {milestoneWhen(m, done, today)}
        </span>
      </button>
    </li>
  );
}

/** Milestones as a dated timeline; the first open one is marked as next. */
export function MilestoneList({ milestones, goalId, today }: { milestones: Milestone[]; goalId: string; today: string }) {
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [adding, setAdding] = useState(false);
  const nextId = milestones.find((m) => m.doneAt == null)?.id;
  return (
    <>
      <div className="card overflow-hidden">
        {milestones.length > 0 && (
          <ol className="py-1.5">
            {milestones.map((m, i) => (
              <MilestoneNode
                key={m.id}
                m={m}
                today={today}
                first={i === 0}
                last={i === milestones.length - 1}
                next={m.id === nextId}
                onOpen={() => setEditing(m)}
              />
            ))}
          </ol>
        )}
        <div className={cn(milestones.length > 0 && "border-t border-line")}>
          <AddRow onClick={() => setAdding(true)}>Add milestone</AddRow>
        </div>
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
      <button type="button" onClick={() => setOpen(true)} className="tap -my-2 inline-flex h-11 items-center gap-1 px-1 text-[13px] font-medium text-ink-2 hover:text-ink">
        <Plus className="size-3.5" strokeWidth={2.6} /> Check in
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Check in" description="An honest read on this goal today.">
        <form action={action}>
          <input type="hidden" name="goalId" value={goalId} />
          <Field label="Status">
            <Segmented name="status" defaultValue={suggested} options={STATUS_OPTIONS.map((o) => ({ ...o }))} />
          </Field>
          <Field label="Confidence" hint="that you hit it this season">
            <div className="flex items-center gap-4">
              <ConfidenceSlider name="confidence" value={confidence} onChange={setConfidence} className="flex-1" />
              <span className="tnum w-12 text-right text-[17px] font-semibold text-ink">{confidence}%</span>
            </div>
          </Field>
          <Field label="Note" hint="optional">
            <Textarea name="note" rows={2} placeholder="What changed, what's next" />
          </Field>
          <ErrorNote error={error} />
          <SubmitButton variant="accent" size="lg">Save check-in</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
