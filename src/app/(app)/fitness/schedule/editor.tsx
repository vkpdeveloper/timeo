"use client";

import { LayoutGrid } from "lucide-react";
import { useState } from "react";
import { SubmitButton } from "@/components/ui/button";
import { Field, Input, Segmented, Textarea } from "@/components/ui/controls";
import { TimePicker } from "@/components/ui/pickers";
import { PageHeader, Row, RowIcon, Section, Stat, StatStrip } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { formatDuration, formatMin, toTimeInput, WEEKDAY_NAMES } from "@/lib/dates";
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
  const minutes = schedule.reduce((a, d) => a + (d.routine?.estimatedMin ?? 0), 0);
  return (
    <div>
      <PageHeader title="Weekly split" subtitle="Tap a day to change what you train." />
      <StatStrip>
        <Stat value={trainingDays} label={`training ${trainingDays === 1 ? "day" : "days"}`} />
        <Stat value={7 - trainingDays} label={`rest ${7 - trainingDays === 1 ? "day" : "days"}`} />
        <Stat value={formatDuration(minutes)} label="planned a week" />
      </StatStrip>

      <Section card stagger>
        {schedule.map((d) => (
          <Row
            key={d.weekday}
            onClick={() => setEditing(d)}
            icon={
              <RowIcon className="bg-transparent!">
                <span className={cn("text-[13px] font-semibold", d.weekday === todayWeekday ? "text-accent" : "text-ink-3")}>
                  {WEEKDAY_NAMES[d.weekday].slice(0, 3)}
                </span>
              </RowIcon>
            }
            title={
              <span className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: d.routine ? colorVar(d.routine.color) : "var(--line-strong)" }}
                />
                <span className={cn("truncate", !d.routine && "text-ink-2")}>{d.routine?.name ?? d.label ?? "Rest"}</span>
              </span>
            }
            subtitle={
              [d.startMin != null ? formatMin(d.startMin) : null, d.routine?.focus, d.notes].filter(Boolean).join(" · ") ||
              (d.routine ? `${d.routine.exerciseCount} exercises` : "Recovery")
            }
            value={d.routine ? `~${d.routine.estimatedMin}m` : undefined}
          />
        ))}
      </Section>

      <Section card>
        <Row
          href="/fitness/programs"
          icon={<LayoutGrid />}
          iconColor="teal"
          title="Programs"
          subtitle="Switch to a preset or a saved split"
        />
      </Section>

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
    <Section title="Program notes" hint="Shown to you and to Timi.">
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
    </Section>
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
            <TimePicker name="start" defaultValue={toTimeInput(day.startMin)} placeholder="Any time" clearable aria-label="Workout time" />
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
          <SubmitButton variant="accent" size="lg">Save</SubmitButton>
        </form>
      )}
    </Sheet>
  );
}
