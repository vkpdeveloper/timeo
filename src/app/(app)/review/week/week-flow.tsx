"use client";

import { Check, ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Card, StatusPill, SubHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { colorVar, tint } from "@/lib/colors";
import { formatDuration } from "@/lib/dates";
import { saveGoalUpdate, saveWeeklyReflection } from "../actions";
import type { GoalStatus, GoalWeek, WeekStats } from "../data";

type ReflectionFields = {
  wins: string | null;
  slipped: string | null;
  learned: string | null;
  energisers: string | null;
  drainers: string | null;
  next: string | null;
};

type Assessment = { status: GoalStatus; confidence: number; note: string };

type Step = { kind: "intro" } | { kind: "goal"; goal: GoalWeek } | { kind: "week" } | { kind: "energy" } | { kind: "done" };

const STATUS_OPTIONS: { value: GoalStatus; label: ReactNode }[] = [
  { value: "on_track", label: <StatusLabel dot="bg-ok">On track</StatusLabel> },
  { value: "adjust", label: <StatusLabel dot="bg-warn">Adjust</StatusLabel> },
  { value: "off_track", label: <StatusLabel dot="bg-bad">Off track</StatusLabel> },
];

function StatusLabel({ dot, children }: { dot: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", dot)} />
      {children}
    </span>
  );
}

export function WeekFlow({
  weekStart,
  title,
  range,
  isCurrent,
  daysLeft,
  stats,
  goals,
  reflection,
  hints,
}: {
  weekStart: string;
  title: string;
  range: string;
  isCurrent: boolean;
  daysLeft: number;
  stats: WeekStats;
  goals: GoalWeek[];
  reflection: ReflectionFields | null;
  hints: { gave: string[]; drained: string[] };
}) {
  const steps: Step[] = [
    { kind: "intro" },
    ...goals.map((goal) => ({ kind: "goal" as const, goal })),
    { kind: "week" },
    { kind: "energy" },
    { kind: "done" },
  ];
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [assessments, setAssessments] = useState<Record<string, Assessment>>(() =>
    Object.fromEntries(
      goals.map((g) => [
        g.id,
        {
          status: g.update?.status ?? g.previous?.status ?? g.currentStatus,
          confidence: g.update?.confidence ?? g.previous?.confidence ?? 70,
          note: g.update?.note ?? "",
        },
      ]),
    ),
  );
  const [fields, setFields] = useState<ReflectionFields>(
    reflection ?? { wins: null, slipped: null, learned: null, energisers: null, drainers: null, next: null },
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const step = steps[index];
  const go = (delta: number) => {
    setError(null);
    setDir(delta);
    setIndex((i) => Math.max(0, Math.min(steps.length - 1, i + delta)));
    window.scrollTo({ top: 0 });
  };

  const saveAndNext = (save: () => Promise<void>) => {
    setError(null);
    setPending(true);
    save()
      .then(() => go(1))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't save"))
      .finally(() => setPending(false));
  };

  const formFrom = (entries: Record<string, string | number | null | undefined>) => {
    const fd = new FormData();
    fd.set("weekStart", weekStart);
    for (const [k, v] of Object.entries(entries)) fd.set(k, v == null ? "" : String(v));
    return fd;
  };

  const next = () => {
    if (step.kind === "goal") {
      const a = assessments[step.goal.id];
      saveAndNext(() => saveGoalUpdate(formFrom({ goalId: step.goal.id, ...a })));
    } else if (step.kind === "week") {
      saveAndNext(() => saveWeeklyReflection(formFrom({ wins: fields.wins, slipped: fields.slipped, learned: fields.learned })));
    } else if (step.kind === "energy") {
      saveAndNext(() =>
        saveWeeklyReflection(formFrom({ energisers: fields.energisers, drainers: fields.drainers, next: fields.next })),
      );
    } else go(1);
  };

  const setField = (k: keyof ReflectionFields) => (v: string) => setFields((f) => ({ ...f, [k]: v }));
  const progress = steps.length > 1 ? index / (steps.length - 1) : 1;

  return (
    <div>
      <SubHeader
        back="/review"
        backLabel="Review"
        title={`${title} review`}
        action={
          step.kind !== "done" && index > 0 ? (
            <span className="tnum text-[13px] font-medium text-ink-3">
              {index} / {steps.length - 2}
            </span>
          ) : undefined
        }
      />
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunken">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${Math.max(0.04, progress) * 100}%` }}
          transition={{ type: "spring", damping: 30, stiffness: 200 }}
        />
      </div>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={index}
          custom={dir}
          initial={{ opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -24 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="pt-8"
        >
          {step.kind === "intro" && (
            <Intro
              title={title}
              range={range}
              stats={stats}
              goalCount={goals.length}
              isCurrent={isCurrent}
              daysLeft={daysLeft}
              reviewed={!!reflection}
            />
          )}
          {step.kind === "goal" && (
            <GoalStep
              goal={step.goal}
              value={assessments[step.goal.id]}
              onChange={(a) => setAssessments((s) => ({ ...s, [step.goal.id]: a }))}
            />
          )}
          {step.kind === "week" && (
            <Questions eyebrow="The week" title="Looking back">
              <Prompt label="Wins" placeholder="What went well, big or small" value={fields.wins} onChange={setField("wins")} />
              <Prompt label="What slipped" placeholder="And what got in the way" value={fields.slipped} onChange={setField("slipped")} />
              <Prompt label="What I learned" placeholder="One thing to keep" value={fields.learned} onChange={setField("learned")} />
            </Questions>
          )}
          {step.kind === "energy" && (
            <Questions eyebrow="Energy" title="What gave, what took">
              <Prompt
                label="Gave me energy"
                placeholder="Work, people, habits"
                value={fields.energisers}
                onChange={setField("energisers")}
                hints={hints.gave}
              />
              <Prompt
                label="Drained me"
                placeholder="Notice it, then design around it"
                value={fields.drainers}
                onChange={setField("drainers")}
                hints={hints.drained}
              />
              <Prompt
                label="Next week's focus"
                placeholder="The one thing that would make it a good week"
                value={fields.next}
                onChange={setField("next")}
              />
            </Questions>
          )}
          {step.kind === "done" && <Done title={title} goals={goals} assessments={assessments} next={fields.next} />}

          {error && (
            <p className="mt-5 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{error}</p>
          )}

          {step.kind !== "done" && (
            <div className="mt-8 flex gap-2">
              {index > 0 && (
                <Button variant="secondary" size="icon" className="size-[52px] rounded-2xl" onClick={() => go(-1)} aria-label="Back">
                  <ChevronLeft className="size-5" />
                </Button>
              )}
              <Button size="lg" className="flex-1" loading={pending} onClick={next}>
                {step.kind === "intro" ? "Start" : step.kind === "energy" ? "Finish" : "Next"}
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────── Steps ───────────────────────────

function Intro({
  title,
  range,
  stats,
  goalCount,
  isCurrent,
  daysLeft,
  reviewed,
}: {
  title: string;
  range: string;
  stats: WeekStats;
  goalCount: number;
  isCurrent: boolean;
  daysLeft: number;
  reviewed: boolean;
}) {
  return (
    <div>
      <div className="eyebrow">{range}</div>
      <h1 className="display mt-2 text-[44px] text-ink">{title}</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        {reviewed
          ? "Already reviewed. Change anything you like."
          : isCurrent && daysLeft > 2
            ? `${daysLeft} days still to go. A quick check now is fine.`
            : "Five calm minutes. Honest, not perfect."}
      </p>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <Tile label="Focus" value={formatDuration(stats.focusMin)} sub={`${stats.sessions} sessions`} />
        <Tile
          label="Focus quality"
          value={stats.avgQuality != null ? String(stats.avgQuality) : "–"}
          sub={stats.avgQuality != null ? "out of 100" : "no ratings"}
        />
        <Tile label="Blocks done" value={`${stats.blocks.done}/${stats.blocks.planned}`} sub={stats.blocks.skipped ? `${stats.blocks.skipped} skipped` : "none skipped"} />
        <Tile label="Workouts" value={`${stats.workouts.done}/${stats.workouts.scheduled}`} sub="scheduled" />
      </div>

      <p className="mt-7 text-[14px] leading-relaxed text-ink-3">
        {goalCount > 0
          ? `${goalCount === 1 ? "One goal" : `${goalCount} goals`}, one at a time. Then two short questions.`
          : "No open goals this season. Just two short questions."}
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="tnum mt-0.5 text-[22px] font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="text-[12px] text-ink-3">{sub}</div>}
    </Card>
  );
}

function signal(g: GoalWeek): string | null {
  if (g.plannedMin === 0 && g.focusMin === 0) return "No time was planned for this goal.";
  if (g.reschedules >= 3) return "Blocks moved a lot. Is the time slot right?";
  if (g.plannedMin > 0 && g.doneMin / g.plannedMin >= 0.8) return "You showed up for most of the plan.";
  if (g.plannedMin > 0 && g.doneMin / g.plannedMin < 0.5) return "Less than half the planned time happened.";
  return null;
}

function GoalStep({ goal, value, onChange }: { goal: GoalWeek; value: Assessment; onChange: (a: Assessment) => void }) {
  const hint = signal(goal);
  return (
    <div style={tint(goal.color)}>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ background: colorVar(goal.color) }} />
        <span className="eyebrow">{goal.tier} goal</span>
      </div>
      <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-tight text-ink">{goal.title}</h1>
      {goal.outcome && <p className="mt-1 text-[14.5px] text-ink-3">{goal.outcome}</p>}

      <Card className="mt-6 grid grid-cols-2">
        <Num
          label="Planned time done"
          value={goal.plannedMin ? `${formatDuration(goal.doneMin)}` : "–"}
          sub={goal.plannedMin ? `of ${formatDuration(goal.plannedMin)}` : "nothing planned"}
          className="border-r border-b border-line"
        />
        <Num label="Focused" value={goal.focusMin ? formatDuration(goal.focusMin) : "0m"} sub="in sessions" className="border-b border-line" />
        <Num
          label="Weekly steps"
          value={goal.stepsTotal ? `${goal.stepsDone}/${goal.stepsTotal}` : "–"}
          sub={goal.stepsTotal ? "done" : "none set"}
          className="border-r border-line"
        />
        <Num
          label="Moved"
          value={`${goal.reschedules}×`}
          sub={goal.skipped ? `${goal.skipped} skipped` : "none skipped"}
        />
      </Card>
      {hint && <p className="mt-3 px-1 text-[13.5px] text-ink-2">{hint}</p>}

      <div className="mt-7">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <span className="text-[13px] font-medium text-ink-2">How is it going?</span>
          {goal.previous && (
            <span className="text-[12px] text-ink-3">
              Last time: {STATUS_TEXT[goal.previous.status]}
              {goal.previous.confidence != null && ` · ${goal.previous.confidence}%`}
            </span>
          )}
        </div>
        <Segmented options={STATUS_OPTIONS} value={value.status} onChange={(status) => onChange({ ...value, status })} />
      </div>

      <div className="mt-6">
        <div className="mb-1 flex items-baseline justify-between px-1">
          <span className="text-[13px] font-medium text-ink-2">Confidence you&apos;ll hit it</span>
          <span className="tnum text-[17px] font-semibold text-ink">{value.confidence}%</span>
        </div>
        <ConfidenceSlider value={value.confidence} onChange={(confidence) => onChange({ ...value, confidence })} />
        <div className="flex justify-between px-1 text-[11.5px] text-ink-3">
          <span>Unlikely</span>
          <span>Certain</span>
        </div>
      </div>

      <div className="mt-6">
        <label className="mb-1.5 block px-1 text-[13px] font-medium text-ink-2" htmlFor={`note-${goal.id}`}>
          Note
        </label>
        <textarea
          id={`note-${goal.id}`}
          rows={1}
          maxLength={1000}
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder="One line on why"
          className="field field-sizing-content min-h-12"
        />
      </div>
    </div>
  );
}

const STATUS_TEXT: Record<GoalStatus, string> = { on_track: "On track", adjust: "Adjust", off_track: "Off track" };

function Num({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={cn("px-4 py-3.5", className)}>
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="tnum mt-0.5 text-[20px] font-semibold tracking-tight text-ink">{value}</div>
      {sub && <div className="text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}

function ConfidenceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={5}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Confidence"
      className={cn(
        "h-11 w-full cursor-pointer appearance-none bg-transparent",
        "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--tint)_var(--fill),var(--sunken)_var(--fill))]",
        "[&::-webkit-slider-thumb]:-mt-[11px] [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-line [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgb(0_0_0/0.18)]",
        "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-sunken",
        "[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-tint",
        "[&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_2px_8px_rgb(0_0_0/0.18)]",
      )}
      style={
        {
          "--fill": `${value}%`,
        } as React.CSSProperties
      }
    />
  );
}

function Questions({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="display mt-2 text-[40px] text-ink">{title}</h1>
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </div>
  );
}

function Prompt({
  label,
  placeholder,
  value,
  onChange,
  hints,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  onChange: (v: string) => void;
  hints?: string[];
}) {
  const current = value ?? "";
  const unused = (hints ?? []).filter((h) => !current.toLowerCase().includes(h.toLowerCase()));
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-ink-2">{label}</span>
      <textarea
        rows={2}
        maxLength={1000}
        value={current}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field field-sizing-content min-h-[76px]"
      />
      {unused.length > 0 && (
        <span className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[12px] text-ink-3">From your sessions:</span>
          {unused.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onChange(current.trim() ? `${current.trim()}, ${h}` : h)}
              className="tap rounded-full bg-sunken px-2.5 py-1 text-[12.5px] font-medium text-ink-2"
            >
              + {h}
            </button>
          ))}
        </span>
      )}
    </label>
  );
}

function Done({
  title,
  goals,
  assessments,
  next,
}: {
  title: string;
  goals: GoalWeek[];
  assessments: Record<string, Assessment>;
  next: string | null;
}) {
  return (
    <div>
      <div className="grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
        <Check className="size-7" strokeWidth={2.6} />
      </div>
      <h1 className="display mt-5 text-[40px] text-ink">{title} reviewed</h1>
      <p className="mt-2 text-[15px] text-ink-2">That&apos;s the habit. See you next week.</p>

      {goals.length > 0 && (
        <Card className="mt-7">
          {goals.map((g) => {
            const a = assessments[g.id];
            return (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorVar(g.color) }} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{g.title}</span>
                <span className="tnum text-[13px] text-ink-3">{a.confidence}%</span>
                <StatusPill status={a.status} />
              </div>
            );
          })}
        </Card>
      )}

      {next && (
        <Card className="mt-3 px-4 py-3.5">
          <div className="text-[12px] font-medium text-ink-3">Next week&apos;s focus</div>
          <p className="mt-0.5 text-[15px] leading-snug text-ink">{next}</p>
        </Card>
      )}

      <ButtonLink href="/review" size="lg" className="mt-8">
        Done
      </ButtonLink>
    </div>
  );
}
