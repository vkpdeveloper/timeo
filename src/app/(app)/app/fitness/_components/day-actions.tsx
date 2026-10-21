"use client";

import { ChevronRight, CircleAlert, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, SubmitButton } from "@/components/ui/button";
import { Field, PillPicker, Textarea } from "@/components/ui/controls";
import { CardList, Row, RowIcon } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { clearDayMark, markDay, startWorkout } from "../actions";
import { listText } from "@/lib/text";

export type RoutineOption = { id: string; name: string; focus: string | null; color: string; exerciseCount: number };

const REASONS = ["Tired", "Busy", "Sick", "Sore", "Travel"];

function useAction(fn: (fd: FormData) => Promise<unknown>, done: () => void) {
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

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mb-3 flex items-start gap-2 text-[13.5px] leading-snug font-medium text-bad">
      <CircleAlert className="mt-px size-4 shrink-0" />
      {error}
    </p>
  );
}

/** "Skipped" and "Done, not logged" quick marks for a day. */
export function MarkDayButtons({
  date,
  routines,
  scheduledId,
  className,
}: {
  date: string;
  routines: RoutineOption[];
  scheduledId: string | null;
  className?: string;
}) {
  const [mode, setMode] = useState<null | "skipped" | "unlogged">(null);
  return (
    <>
      <div className={cn("flex items-center gap-0.5", className)}>
        <button
          type="button"
          onClick={() => setMode("skipped")}
          className="tap h-11 rounded-[12px] px-2.5 text-[14px] font-medium text-ink-3 hover:bg-sunken hover:text-ink"
        >
          Skipped
        </button>
        <button
          type="button"
          onClick={() => setMode("unlogged")}
          className="tap h-11 rounded-[12px] px-2.5 text-[14px] font-medium text-ink-3 hover:bg-sunken hover:text-ink"
        >
          Done, not logged
        </button>
      </div>
      <MarkDaySheet
        mode={mode}
        onClose={() => setMode(null)}
        date={date}
        routines={routines}
        scheduledId={scheduledId}
      />
    </>
  );
}

export function MarkDaySheet({
  mode,
  onClose,
  date,
  routines,
  scheduledId,
}: {
  mode: null | "skipped" | "unlogged";
  onClose: () => void;
  date: string;
  routines: RoutineOption[];
  scheduledId: string | null;
}) {
  const { error, action } = useAction(markDay, onClose);
  const [reason, setReason] = useState("");
  const [templateId, setTemplateId] = useState<string>(scheduledId ?? routines[0]?.id ?? "");
  return (
    <Sheet
      open={mode != null}
      onClose={onClose}
      title={mode === "skipped" ? "Skipped" : "Done, not logged"}
      description={mode === "skipped" ? "A short reason helps spot patterns." : "Counts the session without sets."}
    >
      <form action={action} key={mode ?? "none"}>
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="status" value={mode ?? "skipped"} />
        {mode === "skipped" ? (
          <>
            <Field>
              <PillPicker
                value={REASONS.includes(reason) ? reason : undefined}
                onChange={setReason}
                options={REASONS.map((r) => ({ value: r, label: r }))}
              />
            </Field>
            <Field label="Reason">
              <Textarea
                name="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Very tired after office"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Which session?">
              <input type="hidden" name="templateId" value={templateId} />
              <div className="flex flex-col gap-1.5">
                {routines.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setTemplateId(r.id)}
                    className={cn(
                      "tap flex h-12 items-center gap-3 rounded-[12px] border px-3.5 text-left text-[15px] font-medium",
                      templateId === r.id ? "border-ink bg-surface text-ink" : "border-line-strong bg-surface text-ink-2",
                    )}
                  >
                    <span className="size-2.5 rounded-full" style={{ background: colorVar(r.color) }} />
                    <span className="flex-1">{r.name}</span>
                    {r.id === scheduledId && <span className="text-[12px] text-ink-3">Planned</span>}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Notes" hint="optional">
              <Textarea name="notes" rows={2} placeholder="Anything worth remembering" />
            </Field>
          </>
        )}
        <ErrorNote error={error} />
        <SubmitButton variant="accent" size="lg">Save</SubmitButton>
      </form>
    </Sheet>
  );
}

export function UndoMarkButton({ logId }: { logId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() => start(() => clearDayMark(logId))}
    >
      Undo
    </Button>
  );
}

/** Start any routine, or an empty workout. */
export function StartOtherButton({ routines, date, label = "Other routine" }: { routines: RoutineOption[]; date?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  const go = (id: string | null) => {
    setWhich(id ?? "empty");
    start(() => startWorkout(id, date));
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap inline-flex h-11 items-center gap-0.5 rounded-[12px] px-2 text-[14px] font-medium text-ink-2 hover:bg-sunken hover:text-ink"
      >
        {label}
        <ChevronRight className="size-4" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Start a workout" description="Pick a routine, or start empty and add exercises as you go.">
        <div className="pb-2">
          <CardList className="stagger">
            {routines.map((r) => (
              <Row
                key={r.id}
                onClick={pending ? undefined : () => go(r.id)}
                icon={
                  <RowIcon>
                    <span className="size-2.5 rounded-full" style={{ background: colorVar(r.color) }} />
                  </RowIcon>
                }
                title={r.name}
                subtitle={`${r.focus ? `${listText(r.focus)}. ` : ""}${r.exerciseCount} exercises`}
                value={pending && which === r.id ? "Starting…" : undefined}
                chevron={!(pending && which === r.id)}
              />
            ))}
          </CardList>
          <Button variant="outline" size="lg" className="mt-3" disabled={pending} onClick={() => go(null)}>
            <Plus className="size-4" />
            {pending && which === "empty" ? "Starting…" : "Empty workout"}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
