"use client";

import { ChevronRight, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Field, Input, Segmented, Textarea } from "@/components/ui/controls";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { formatMin, toTimeInput, WEEKDAY_NAMES } from "@/lib/dates";
import type { ScheduleDay } from "@/lib/fitness";
import { ErrorNote, type RoutineOption } from "../_components/day-actions";
import { saveScheduleDay, saveTrainingNotes } from "./actions";

export function ScheduleEditor({
  schedule,
  routines,
  trainingNotes,
  todayWeekday,
}: {
  schedule: ScheduleDay[];
  routines: RoutineOption[];
  trainingNotes: string;
  todayWeekday: number;
}) {
  const [editing, setEditing] = useState<ScheduleDay | null>(null);
  const trainingDays = schedule.filter((d) => d.routine).length;
  return (
    <div className="fade-up pb-8">
      <header className="pt-5 pb-5">
        <h1 className="display text-[38px] text-ink">Weekly split</h1>
        <p className="mt-1 text-[15px] text-ink-2">
          {trainingDays} training {trainingDays === 1 ? "day" : "days"}, {7 - trainingDays} rest
        </p>
      </header>

      <div className="card overflow-hidden">
        {schedule.map((d) => (
          <button
            key={d.weekday}
            type="button"
            onClick={() => setEditing(d)}
            className="tap flex w-full items-center gap-3.5 border-b border-line px-4 py-3.5 text-left last:border-0 active:bg-sunken"
          >
            <div className="w-10 shrink-0">
              <div className={cn("text-[13px] font-semibold", d.weekday === todayWeekday ? "text-accent" : "text-ink-3")}>
                {WEEKDAY_NAMES[d.weekday].slice(0, 3)}
              </div>
            </div>
            <span
              className="h-9 w-[3px] shrink-0 rounded-full"
              style={{ background: d.routine ? colorVar(d.routine.color) : "var(--line-strong)" }}
            />
            <div className="min-w-0 flex-1">
              <div className={cn("truncate text-[15.5px] font-semibold", d.routine ? "text-ink" : "text-ink-2")}>
                {d.routine?.name ?? d.label ?? "Rest"}
              </div>
              <div className="truncate text-[12.5px] text-ink-3">
                {[d.startMin != null ? formatMin(d.startMin) : null, d.routine?.focus, d.notes].filter(Boolean).join(" · ") ||
                  (d.routine ? `${d.routine.exerciseCount} exercises` : "Recovery")}
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-3" />
          </button>
        ))}
      </div>

      <Link href="/fitness/programs" className="card tap mt-3 flex items-center gap-3 px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--c-teal-soft)] text-[var(--c-teal)]">
          <LayoutGrid className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-ink">Programs</span>
          <span className="block text-[12.5px] text-ink-3">Switch to a preset or a saved split</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-3" />
      </Link>

      <NotesCard notes={trainingNotes} />

      <DaySheet day={editing} routines={routines} onClose={() => setEditing(null)} />
    </div>
  );
}

function NotesCard({ notes }: { notes: string }) {
  const [value, setValue] = useState(notes);
  const [saved, setSaved] = useState(false);
  const dirty = value !== notes && !saved;
  return (
    <section className="mt-8">
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Program notes</h2>
        <span className="text-[12.5px] text-ink-3">Shown to you and the coach</span>
      </div>
      <form
        action={async (fd) => {
          await saveTrainingNotes(fd);
          setSaved(true);
        }}
        className="card p-3"
      >
        <Textarea
          name="trainingNotes"
          rows={7}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Aim for about 2 reps in reserve."
          className="border-0 bg-transparent px-1.5 focus:bg-transparent focus:shadow-none"
        />
        <div className="flex items-center justify-end gap-3 px-1 pt-2">
          {saved && <span className="text-[12.5px] text-ink-3">Saved</span>}
          <SubmitButton size="sm" variant={dirty ? "primary" : "secondary"} disabled={!dirty}>
            Save notes
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

function DaySheet({ day, routines, onClose }: { day: ScheduleDay | null; routines: RoutineOption[]; onClose: () => void }) {
  const [kind, setKind] = useState<"routine" | "rest">("routine");
  const [templateId, setTemplateId] = useState<string>("");
  const [lastDay, setLastDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (day && day.weekday !== lastDay) {
    setLastDay(day.weekday);
    setKind(day.routine ? "routine" : "rest");
    setTemplateId(day.templateId ?? routines[0]?.id ?? "");
    setError(null);
  }
  return (
    <Sheet open={!!day} onClose={onClose} title={day ? WEEKDAY_NAMES[day.weekday] : ""}>
      {day && (
        <form
          key={day.weekday}
          action={async (fd) => {
            setError(null);
            try {
              await saveScheduleDay(fd);
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong");
            }
          }}
        >
          <input type="hidden" name="weekday" value={day.weekday} />
          <Field>
            <Segmented
              name="kind"
              value={kind}
              onChange={setKind}
              options={[
                { value: "routine", label: "Training" },
                { value: "rest", label: "Rest or other" },
              ]}
            />
          </Field>
          {kind === "routine" ? (
            <Field label="Routine">
              <input type="hidden" name="templateId" value={templateId} />
              <div className="flex flex-col gap-1.5">
                {routines.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setTemplateId(r.id)}
                    className={cn(
                      "tap flex h-12 items-center gap-3 rounded-2xl border px-3.5 text-left",
                      templateId === r.id ? "border-ink bg-surface" : "border-line bg-surface-2",
                    )}
                  >
                    <span className="size-2.5 rounded-full" style={{ background: colorVar(r.color) }} />
                    <span className="flex-1 text-[15px] font-medium text-ink">{r.name}</span>
                    <span className="truncate text-[12.5px] text-ink-3">{r.focus}</span>
                  </button>
                ))}
              </div>
            </Field>
          ) : (
            <Field label="Label">
              <Input name="label" defaultValue={day.routine ? "Rest" : (day.label ?? "Rest")} placeholder="e.g. Easy cardio or full rest" />
            </Field>
          )}
          <Field label="Time" hint="optional">
            <Input type="time" name="start" step={300} defaultValue={toTimeInput(day.startMin)} />
          </Field>
          <Field label="Notes" hint="optional">
            <Textarea
              name="notes"
              rows={2}
              defaultValue={day.notes ?? ""}
              placeholder="e.g. Walking, cycling or full rest · 20–40 min"
            />
          </Field>
          <ErrorNote error={error} />
          <SubmitButton size="lg">Save</SubmitButton>
        </form>
      )}
    </Sheet>
  );
}
