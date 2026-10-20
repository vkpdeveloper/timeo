"use client";

import { ArrowDown, ArrowUp, LineChart, Repeat, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Segmented, Textarea } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { tint } from "@/lib/colors";
import { formatDuration } from "@/lib/dates";
import { fmtVolume, type ExerciseOption } from "@/lib/fitness-math";
import { discardWorkout, finishWorkout } from "./actions";
import { clearDraft } from "./draft";
import type { LSet } from "./logger";

export { ExercisePicker } from "../../_components/exercise-picker";

export type PR = { name: string; set: string; detail: string };

function MenuItem({
  icon,
  children,
  onClick,
  href,
  danger,
  disabled,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const cls = cn(
    "tap flex h-14 w-full items-center gap-3.5 border-b border-line px-1 text-left text-[16px] font-medium last:border-0 disabled:opacity-35 [&_svg]:size-[19px]",
    danger ? "text-bad" : "text-ink",
  );
  return href ? (
    <Link href={href} className={cls}>
      <span className="text-ink-3">{icon}</span>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      <span className={danger ? "text-bad" : "text-ink-3"}>{icon}</span>
      {children}
    </button>
  );
}

export function ExerciseMenu({
  open,
  onClose,
  exercise,
  canUp,
  canDown,
  onUp,
  onDown,
  onReplace,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  exercise?: ExerciseOption;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const close = () => {
    setConfirm(false);
    onClose();
  };
  const run = (fn: () => void) => () => {
    fn();
    close();
  };
  return (
    <Sheet open={open} onClose={close} title={exercise?.name ?? "Exercise"}>
      <div className="pb-2">
        <MenuItem icon={<Repeat />} onClick={run(onReplace)}>Replace exercise</MenuItem>
        <MenuItem icon={<ArrowUp />} onClick={run(onUp)} disabled={!canUp}>Move up</MenuItem>
        <MenuItem icon={<ArrowDown />} onClick={run(onDown)} disabled={!canDown}>Move down</MenuItem>
        {exercise && (
          <MenuItem icon={<LineChart />} href={`/fitness/exercises/${exercise.id}`}>Progress and history</MenuItem>
        )}
        <MenuItem
          icon={<Trash2 />}
          danger
          onClick={() => (confirm ? run(onRemove)() : setConfirm(true))}
        >
          {confirm ? "Tap again to remove all its sets" : "Remove exercise"}
        </MenuItem>
      </div>
    </Sheet>
  );
}

export function SetMenu({
  open,
  onClose,
  set,
  exerciseName,
  onWarmup,
  onNote,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  set?: LSet;
  exerciseName: string;
  onWarmup: (w: boolean) => void;
  onNote: (note: string) => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={exerciseName} description="Set options">
      {set && (
        <div key={set.id} className="pb-1">
          <Field label="Type">
            <Segmented
              value={set.warmup ? "warmup" : "working"}
              onChange={(v) => onWarmup(v === "warmup")}
              options={[
                { value: "working", label: "Working set" },
                { value: "warmup", label: "Warm-up" },
              ]}
            />
          </Field>
          <Field label="Note">
            <Textarea
              rows={2}
              defaultValue={set.note}
              placeholder="e.g. Last rep with a slight cheat"
              onBlur={(e) => e.target.value !== set.note && onNote(e.target.value)}
            />
          </Field>
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="danger"
              size="icon"
              className="size-[52px] rounded-2xl"
              aria-label="Delete set"
              onClick={onDelete}
            >
              <Trash2 className="size-[18px]" />
            </Button>
            <Button type="button" size="lg" className="flex-1" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

const FEELINGS = [
  { value: "1", label: "Rough" },
  { value: "2", label: "Meh" },
  { value: "3", label: "Okay" },
  { value: "4", label: "Good" },
  { value: "5", label: "Great" },
];

export function FinishSheet({
  open,
  onClose,
  logId,
  editing,
  durationSec,
  workingSets,
  volume,
  undone,
  prs,
  defaultFeeling,
  defaultNotes,
  flush,
  color,
}: {
  color: string;
  open: boolean;
  onClose: () => void;
  logId: string;
  editing: boolean;
  durationSec: number | null;
  workingSets: number;
  volume: number;
  undone: number;
  prs: PR[];
  defaultFeeling: number | null;
  defaultNotes: string | null;
  flush: () => Promise<void>;
}) {
  const [feeling, setFeeling] = useState<string | null>(defaultFeeling ? String(defaultFeeling) : null);
  const [notes, setNotes] = useState(defaultNotes ?? "");
  const [pending, start] = useTransition();
  const [discarding, startDiscard] = useTransition();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = () =>
    start(async () => {
      setError(null);
      try {
        await flush();
        clearDraft(logId);
        await finishWorkout(logId, { feeling: feeling ? Number(feeling) : null, notes });
      } catch (e) {
        if (e && typeof e === "object" && "digest" in e) throw e; // redirect
        setError("Could not save. Check your connection and try again.");
      }
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Save session" : "Finish workout"}
      footer={
        <Button size="lg" variant="tint" loading={pending} onClick={finish} style={tint(color)}>
          {editing ? "Save" : "Finish workout"}
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <SummaryStat label="Duration" value={durationSec == null ? "—" : durationSec < 60 ? "<1m" : formatDuration(durationSec / 60)} />
        <SummaryStat label="Working sets" value={String(workingSets)} />
        <SummaryStat label="Volume" value={volume ? fmtVolume(volume) : "—"} />
      </div>
      <p className="mt-2 px-1 text-[12px] text-ink-3">Volume counts sets with known weight, as logged.</p>

      {prs.length > 0 && (
        <div className="mt-4 rounded-2xl bg-[var(--c-amber-soft)] p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--c-amber)]">
            <Trophy className="size-4" /> {prs.length === 1 ? "New best" : `${prs.length} new bests`}
          </div>
          <ul className="flex flex-col gap-1.5">
            {prs.map((p) => (
              <li key={p.name} className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0 truncate font-medium text-ink">{p.name}</span>
                <span className="tnum shrink-0 text-ink-2">
                  {p.set} <span className="text-[12px] text-ink-3">· {p.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {undone > 0 && (
        <p className="mt-4 rounded-2xl bg-warn-soft px-3.5 py-2.5 text-[13.5px] text-warn">
          {undone} unticked {undone === 1 ? "set" : "sets"} will be dropped. Tick a set to keep it.
        </p>
      )}

      <Field label="How did it feel?" className="mt-5">
        <div className="grid grid-cols-5 gap-1.5">
          {FEELINGS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={feeling === f.value}
              onClick={() => setFeeling(feeling === f.value ? null : f.value)}
              className={cn(
                "tap flex h-14 flex-col items-center justify-center rounded-2xl text-[12px] font-semibold",
                feeling === f.value ? "bg-ink text-bg" : "bg-sunken text-ink-2",
              )}
            >
              <span className="tnum text-[16px]">{f.value}</span>
              {f.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Notes">
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Energy, form, anything to change next time" />
      </Field>
      {error && <p className="mb-3 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{error}</p>}

      <button
        type="button"
        disabled={discarding}
        onClick={() => (confirmDiscard ? startDiscard(() => {
                clearDraft(logId);
                return discardWorkout(logId);
              }) : setConfirmDiscard(true))}
        className="tap mt-1 h-11 w-full rounded-2xl text-[14px] font-semibold text-bad"
      >
        {discarding ? "Discarding…" : confirmDiscard ? "Tap again to delete this workout" : editing ? "Delete session" : "Discard workout"}
      </button>
    </Sheet>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-sunken px-3 py-3">
      <div className="text-[11.5px] font-medium text-ink-3">{label}</div>
      <div className="tnum mt-0.5 text-[19px] font-semibold tracking-tight text-ink">{value}</div>
    </div>
  );
}
