"use client";

import { Check, CircleAlert, FileUp } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { formatMonthDay, formatWeekdayShort, WEEKDAY_SHORT } from "@/lib/dates";
import type { ImportReport } from "@/lib/fitness-import";
import { runImport } from "./actions";

const STATUS: Record<string, string> = { completed: "Done", skipped: "Skipped", unlogged: "Done, not logged" };

const EXAMPLE = `{
  "schedule": {
    "notes": ["Aim for about 2 reps in reserve."],
    "Monday": { "session": "Pull A", "exercises": [
      { "name": "Lat pulldown", "sets": 3, "reps": [8, 12] }
    ] },
    "Wednesday": { "session": "Rest / easy walking", "exercises": [] }
  },
  "log": { "days": [
    { "date": "2026-10-13", "session": "Push A", "status": "completed",
      "exercises": [{ "name": "Incline dumbbell press", "weight_basis": "per_hand",
        "warmup_sets": [{ "weight_kg": 15, "reps": 10 }],
        "working_sets": [{ "weight_kg": 20, "reps": 10 }] }] },
    { "date": "2026-10-12", "status": "skipped", "reason": "Very tired" }
  ] }
}`;

export function Importer() {
  const [json, setJson] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"preview" | "import" | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const go = (dryRun: boolean) => {
    setMode(dryRun ? "preview" : "import");
    start(async () => {
      setError(null);
      const res = await runImport(json, dryRun);
      if (!res.ok) {
        setError(res.error);
        setReport(null);
        return;
      }
      setReport(res.report);
      setApplied(res.applied);
    });
  };

  return (
    <div>
      <div className="card p-3">
        <Textarea
          rows={10}
          value={json}
          onChange={(e) => {
            setJson(e.target.value);
            setReport(null);
            setApplied(false);
          }}
          placeholder="Paste JSON here"
          spellCheck={false}
          className="border-0 bg-transparent px-1.5 !text-[14px] leading-relaxed focus:bg-transparent focus:shadow-none"
        />
        <div className="flex items-center justify-between gap-2 border-t border-line px-1 pt-3">
          <button
            type="button"
            onClick={() => file.current?.click()}
            className="tap inline-flex h-11 items-center gap-1.5 rounded-[12px] bg-sunken px-3.5 text-[14px] font-medium text-ink-2"
          >
            <FileUp className="size-4" /> Choose file
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json,.txt"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setJson(await f.text());
              setReport(null);
              setApplied(false);
            }}
          />
          <span className="tnum text-[12px] text-ink-3">{json.length ? `${json.length.toLocaleString("en-US")} chars` : ""}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-[14px] leading-snug font-medium text-bad">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {!applied && (
        <div className="mt-4 flex gap-2.5">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={!json.trim()}
            loading={pending && mode === "preview"}
            onClick={() => go(true)}
          >
            Preview
          </Button>
          <Button size="lg" className="flex-1" disabled={!json.trim() || !report} loading={pending && mode === "import"} onClick={() => go(false)}>
            Import
          </Button>
        </div>
      )}

      {report && <Report report={report} applied={applied} />}

      {applied && (
        <div className="mt-4 flex gap-2.5">
          <ButtonLink href="/app/fitness/history" size="lg" className="flex-1">
            Open history
          </ButtonLink>
          <ButtonLink href="/app/fitness/schedule" variant="secondary" size="lg" className="flex-1">
            Weekly split
          </ButtonLink>
        </div>
      )}

      {!json && (
        <details className="mt-8 px-1">
          <summary className="cursor-pointer text-[14px] font-medium text-ink-2">Format</summary>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
            Weekdays under <code className="font-sans font-medium text-ink">schedule</code> become your split; days with exercises become routines (matched by
            name). In <code className="font-sans font-medium text-ink">log.days</code>, <code className="font-sans font-medium text-ink">completed</code> days are imported with their sets (or as done
            without sets when <code className="font-sans font-medium text-ink">exercises</code> is null), <code className="font-sans font-medium text-ink">skipped</code> days keep their reason, and
            unreported or future days are left out. A <code className="font-sans font-medium text-ink">null</code> weight stays unknown.
          </p>
          <pre className="mt-3 overflow-x-auto font-sans rounded-[12px] bg-sunken p-3 text-[11.5px] leading-relaxed text-ink-2">{EXAMPLE}</pre>
        </details>
      )}
    </div>
  );
}

function Report({ report, applied }: { report: ImportReport; applied: boolean }) {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-[12px] px-4 py-3 text-[14px] font-medium",
          applied ? "bg-ok-soft text-ok" : "bg-sunken text-ink-2",
        )}
      >
        {applied && <Check className="size-4" strokeWidth={3} />}
        {applied ? "Imported." : "Preview. Nothing has been saved yet."}
      </div>

      {report.routines.length > 0 && (
        <Group title="Routines">
          {report.routines.map((r) => (
            <Line key={r.name} left={r.name} right={`${r.exercises} exercises · ${r.action === "create" ? "new" : "updated"}`} />
          ))}
        </Group>
      )}

      {report.schedule.length > 0 && (
        <Group title="Weekly split">
          {report.schedule.map((d) => (
            <Line key={d.weekday} left={`${WEEKDAY_SHORT[d.weekday]} · ${d.name}`} right={d.routine ? "Training" : "Rest"} muted={!d.routine} />
          ))}
        </Group>
      )}

      {report.logs.length > 0 && (
        <Group title="Sessions">
          {report.logs.map((l) => (
            <Line
              key={l.date + l.name}
              left={`${formatWeekdayShort(l.date)}, ${formatMonthDay(l.date)} · ${l.name}`}
              right={`${STATUS[l.status]}${l.sets ? ` · ${l.sets} sets` : ""}${l.action === "update" ? " · updated" : ""}`}
            />
          ))}
        </Group>
      )}

      {report.ignoredDays.length > 0 && (
        <Group title="Left out" note="Unreported days are not counted as done or skipped.">
          {report.ignoredDays.map((d) => (
            <Line key={d.date} left={`${formatWeekdayShort(d.date)}, ${formatMonthDay(d.date)}`} right={d.why} muted />
          ))}
        </Group>
      )}

      {(report.exercisesCreated.length > 0 || report.trainingNotes || report.warnings.length > 0) && (
        <div className="px-1 text-[13px] leading-relaxed text-ink-3">
          {report.exercisesCreated.length > 0 && <p>New exercises: {report.exercisesCreated.join(", ")}.</p>}
          {report.trainingNotes && <p>Program notes are replaced with the imported notes.</p>}
          {report.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      <div className="card overflow-hidden">{children}</div>
      {note && <p className="mt-2 px-1 text-[12.5px] text-ink-3">{note}</p>}
    </section>
  );
}

function Line({ left, right, muted }: { left: string; right: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0">
      <span className={cn("min-w-0 truncate text-[14px]", muted ? "text-ink-2" : "font-medium text-ink")}>{left}</span>
      <span className="shrink-0 text-right text-[12.5px] text-ink-3">{right}</span>
    </div>
  );
}
