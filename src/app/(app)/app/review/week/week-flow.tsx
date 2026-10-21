"use client";

import { Check, ChevronLeft, CircleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { springs, useReducedMotion } from "@/components/ui/motion";
import { Card, Meter, Row, Section, Stat, StatStrip, StatusPill, SubHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { colorVar, tint } from "@/lib/colors";
import { formatDuration } from "@/lib/dates";
import { ConfidenceSlider } from "../../goals/_components/confidence-slider";
import { tierLabel } from "../../goals/_components/meta";
import { saveGoalUpdate, saveWeeklyReflection } from "../actions";
import { roundedTime } from "../shared";
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
      .catch(() => setError("Couldn't save. Try again."))
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

  const reduce = useReducedMotion();
  // From Season (this week) back goes to Season; past weeks open from Review.
  const back = isCurrent ? { href: "/app/goals", label: "Season" } : { href: "/app/review", label: "Review" };
  const total = steps.length - 1; // the done screen is not a step
  const isLast = step.kind === "energy";

  return (
    <div>
      <SubHeader
        back={back.href}
        backLabel={back.label}
        title={`${title} review`}
        action={
          step.kind !== "done" ? (
            <span className="tnum text-[13px] font-medium text-ink-3">
              {index + 1} of {total}
            </span>
          ) : undefined
        }
      />
      <div
        className="flex items-center justify-center gap-1.5 pt-2"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={Math.min(index + 1, total)}
        aria-label={`Step ${Math.min(index + 1, total)} of ${total}`}
      >
        {steps.slice(0, total).map((s, i) => (
          <motion.span
            key={i}
            className={cn("h-1.5 rounded-full", i <= index ? "bg-accent" : "bg-line-strong")}
            initial={false}
            animate={{ width: i === index ? 20 : 6, opacity: i < index ? 0.45 : 1 }}
            transition={springs.smooth}
          />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={index}
          custom={dir}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 32 }}
          animate={{ opacity: 1, x: 0, transition: springs.smooth }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -32, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
          className={cn("pt-5", step.kind !== "done" && "pb-32")}
        >
          {step.kind === "intro" && (
            <Intro
              title={title}
              range={range}
              stats={stats}
              goals={goals}
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
          {step.kind === "done" && <Done title={title} goals={goals} assessments={assessments} next={fields.next} doneHref={back.href} />}
        </motion.div>
      </AnimatePresence>

      {step.kind !== "done" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg pt-3 lg:left-[84px]">
          <div className="pb-[max(16px,var(--safe-bottom))]">
            <div className="mx-auto w-full max-w-[640px] px-4 sm:px-6 lg:max-w-[760px]">
              {error && (
                <p role="alert" className="mb-2 flex items-start gap-2 px-1 text-[13.5px] font-medium text-warn">
                  <CircleAlert className="mt-px size-4 shrink-0" />
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                {index > 0 && (
                  <Button variant="secondary" size="icon" className="size-12 rounded-[12px]" onClick={() => go(-1)} aria-label="Back">
                    <ChevronLeft className="size-5" />
                  </Button>
                )}
                <Button variant="accent" size="lg" className="flex-1" loading={pending} onClick={next}>
                  {step.kind === "intro" ? "Start" : isLast ? "Finish" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Steps ───────────────────────────

function Intro({
  title,
  range,
  stats,
  goals,
  isCurrent,
  daysLeft,
  reviewed,
}: {
  title: string;
  range: string;
  stats: WeekStats;
  goals: GoalWeek[];
  isCurrent: boolean;
  daysLeft: number;
  reviewed: boolean;
}) {
  const { dueMin, doneMin } = stats.blocks;
  const summary =
    dueMin > 0
      ? `You protected ${roundedTime(doneMin)} of ${roundedTime(dueMin)} planned${isCurrent && daysLeft > 0 ? " so far" : ""}.`
      : stats.focusMin > 0
        ? `${roundedTime(stats.focusMin)} of focus this week.`
        : "Nothing was planned this week.";
  return (
    <div>
      <div className="eyebrow">{range}</div>
      <h1 className="display mt-1 text-[28px] text-ink">{title}</h1>
      <p className="mt-1.5 text-[15px] leading-snug text-ink">{summary}</p>
      <p className="mt-0.5 text-[14px] text-ink-3">
        {reviewed
          ? "Already reviewed. Change anything you like."
          : isCurrent && daysLeft > 2
            ? `${daysLeft} days still to go. A quick check now is fine.`
            : "Five calm minutes. Honest, not perfect."}
      </p>

      <StatStrip card className="mt-5">
        <Stat value={formatDuration(stats.focusMin)} label="focus" sub={`${stats.sessions} ${stats.sessions === 1 ? "session" : "sessions"}`} />
        <Stat value={stats.blocks.done} unit={`of ${stats.blocks.planned}`} label="blocks done" />
        <Stat value={stats.workouts.done} unit={`of ${stats.workouts.scheduled}`} label="workouts" />
      </StatStrip>

      {goals.length > 0 ? (
        <Section title="One check per goal" count={goals.length} hint="Then two short questions." card>
          {goals.map((g) => (
            <Row
              key={g.id}
              title={<GoalName title={g.title} color={g.color} />}
              subtitle={<span className="pl-[18px]">{`${roundedTime(Math.max(g.doneMin, g.focusMin))} of ${roundedTime(g.plannedMin)} planned`}</span>}
            >
              <StatusPill status={g.update?.status ?? g.currentStatus} />
            </Row>
          ))}
        </Section>
      ) : (
        <p className="mt-6 px-1 text-[14px] text-ink-3">No open goals this season. Just two short questions.</p>
      )}
    </div>
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
        <span className="eyebrow">{tierLabel(goal.tier)} goal</span>
      </div>
      <h1 className="display mt-1 text-[26px] text-balance text-ink">{goal.title}</h1>
      {goal.outcome && <p className="mt-1 text-[14px] leading-snug text-ink-3">{goal.outcome}</p>}

      <Card className="mt-5 p-4">
        <div className="tnum flex items-baseline justify-between gap-3">
          <span className="text-[13.5px] text-ink-3">
            <span className="text-[20px] font-semibold tracking-tight text-ink">{roundedTime(goal.doneMin)}</span> of{" "}
            {roundedTime(goal.plannedMin)} planned
          </span>
          <span className="text-[13px] text-ink-3">{goal.focusMin ? `${roundedTime(goal.focusMin)} focus` : "no focus"}</span>
        </div>
        <Meter
          className="mt-2.5"
          height={6}
          legend={false}
          total={Math.max(goal.plannedMin, goal.doneMin, 1)}
          segments={[
            { kind: "done", value: goal.doneMin },
            { kind: "planned", value: Math.max(0, goal.plannedMin - goal.doneMin) },
          ]}
        />
        <p className="tnum mt-2 text-[12.5px] text-ink-3">
          {[
            goal.stepsTotal ? `${goal.stepsDone} of ${goal.stepsTotal} ${goal.stepsTotal === 1 ? "step" : "steps"} done` : "No weekly step",
            goal.reschedules ? `moved ${goal.reschedules}×` : null,
            goal.skipped ? `${goal.skipped} skipped` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {hint && <p className="mt-2.5 border-t border-line pt-2.5 text-[13.5px] text-ink-2">{hint}</p>}
      </Card>

      <div className="mt-6">
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

      <div className="mt-5">
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

      <div className="mt-4">
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

/** Goal colour dot + title, for list rows. */
function GoalName({ title, color }: { title: string; color: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="size-2 shrink-0 rounded-full" style={{ background: colorVar(color) }} />
      <span className="truncate">{title}</span>
    </span>
  );
}

const STATUS_TEXT: Record<GoalStatus, string> = { on_track: "On track", adjust: "Adjust", off_track: "Off track" };

function Questions({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="display mt-1 text-[26px] text-ink">{title}</h1>
      <div className="mt-5 flex flex-col gap-4">{children}</div>
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
              className="tap inline-flex min-h-8 items-center rounded-full bg-sunken px-3 text-[12.5px] font-medium text-ink-2"
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
  doneHref,
}: {
  title: string;
  goals: GoalWeek[];
  assessments: Record<string, Assessment>;
  next: string | null;
  doneHref: string;
}) {
  return (
    <div>
      <motion.div
        className="grid size-14 place-items-center rounded-full bg-ok-soft text-ok"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springs.snappy}
      >
        <Check className="size-7" strokeWidth={2.6} />
      </motion.div>
      <h1 className="display mt-4 text-[28px] text-ink">{title} reviewed</h1>
      <p className="mt-1 text-[15px] text-ink-2">That&apos;s the habit. See you next week.</p>

      {goals.length > 0 && (
        <Section title="Where each goal stands" card stagger>
          {goals.map((g) => {
            const a = assessments[g.id];
            return (
              <Row
                key={g.id}
                title={<GoalName title={g.title} color={g.color} />}
                value={`${a.confidence}%`}
              >
                <StatusPill status={a.status} className="ml-auto" />
              </Row>
            );
          })}
        </Section>
      )}

      {next && (
        <Card className="mt-3 px-4 py-3">
          <div className="text-[12.5px] font-medium text-ink-3">Next week&apos;s focus</div>
          <p className="mt-0.5 text-[15px] leading-snug text-ink">{next}</p>
        </Card>
      )}

      <ButtonLink href={doneHref} variant="accent" size="lg" className="mt-6">
        Done
      </ButtonLink>
    </div>
  );
}
