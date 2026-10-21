"use client";

import { AlertTriangle, Check, ChevronLeft, Flag, Plus, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { springs } from "@/components/ui/motion";
import { Field, Input, Label, PillPicker, Segmented, Stepper, Textarea } from "@/components/ui/controls";
import { DatePicker } from "@/components/ui/pickers";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { PALETTE, colorVar } from "@/lib/colors";
import { addDays, formatMonthDay, isValidISODate, SEASON_DAYS } from "@/lib/dates";
import { createSeason, type SeasonDraft } from "../actions";
import { AREAS, TIERS, fmtHours, type Area, type Tier } from "../_components/meta";

type DraftMilestone = { key: string; title: string; dueDate: string | null };
type DraftGoal = {
  key: string;
  title: string;
  outcome: string;
  tier: Tier;
  area: Area;
  color: string;
  weeklyHours: number;
  system: string;
  milestones: DraftMilestone[];
};

const STEPS = ["season", "time", "dump", "goals", "details", "capacity", "milestones"] as const;
type Step = (typeof STEPS)[number];

const uid = () => Math.random().toString(36).slice(2, 10);
const HOURS_BY_TIER: Record<Tier, number> = { core: 4, secondary: 2, support: 1 };

/** Lines from the brain dump, cleaned of bullets and numbering. */
function dumpIdeas(dump: string) {
  const seen = new Set<string>();
  return dump
    .split(/\n|;/)
    .map((l) => l.replace(/^\s*([-*•·]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 1 && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
}

export function SeasonWizard({ today, currentSeason }: { today: string; currentSeason: string | null }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("season");
  const [dir, setDir] = useState(1);
  const [goalIdx, setGoalIdx] = useState(0);

  const [name, setName] = useState("");
  const [intention, setIntention] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [capacity, setCapacity] = useState(15);
  const [dump, setDump] = useState("");
  const [goals, setGoals] = useState<DraftGoal[]>([]);

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const start_ = isValidISODate(startDate) ? startDate : today;
  const endDate = addDays(start_, SEASON_DAYS - 1);
  const stepIndex = STEPS.indexOf(step);

  const addGoal = (title: string) => {
    const t = title.trim();
    if (!t || goals.some((g) => g.title.toLowerCase() === t.toLowerCase())) return;
    setGoals((gs) => {
      const i = gs.length;
      const tier: Tier = i < 2 ? "core" : i < 4 ? "secondary" : "support";
      return [
        ...gs,
        {
          key: uid(),
          title: t.slice(0, 200),
          outcome: "",
          tier,
          area: "work",
          color: PALETTE[i % PALETTE.length],
          weeklyHours: HOURS_BY_TIER[tier],
          system: "",
          milestones: [],
        },
      ];
    });
  };
  const patchGoal = (key: string, patch: Partial<DraftGoal>) =>
    setGoals((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  const removeGoal = (key: string) => setGoals((gs) => gs.filter((g) => g.key !== key));

  const go = (next: Step, d: number) => {
    setDir(d);
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const back = () => {
    if (step === "details" && goalIdx > 0) {
      setDir(-1);
      setGoalIdx(goalIdx - 1);
      window.scrollTo({ top: 0 });
      return;
    }
    if (step === "capacity") setGoalIdx(Math.max(0, goals.length - 1));
    go(STEPS[stepIndex - 1], -1);
  };

  const finish = () => {
    setError(null);
    const draft: SeasonDraft = {
      name,
      intention,
      startDate: start_,
      capacityHours: capacity,
      brainDump: dump,
      goals: goals.map((g) => ({
        title: g.title,
        outcome: g.outcome,
        tier: g.tier,
        area: g.area,
        color: g.color,
        weeklyHours: g.weeklyHours,
        system: g.system,
        milestones: g.milestones.map((m) => ({ title: m.title, dueDate: m.dueDate })),
      })),
    };
    start(async () => {
      try {
        await createSeason(draft);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the season");
      }
    });
  };

  const next = () => {
    if (step === "details" && goalIdx < goals.length - 1) {
      setDir(1);
      setGoalIdx(goalIdx + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    if (step === "goals") setGoalIdx(0);
    if (step === "milestones") return finish();
    go(STEPS[stepIndex + 1], 1);
  };

  const canNext =
    step === "season" ? name.trim().length > 0 : step === "goals" || step === "details" ? goals.length > 0 : true;

  const primaryLabel =
    step === "dump"
      ? dump.trim()
        ? "Continue"
        : "Skip for now"
      : step === "details" && goalIdx < goals.length - 1
        ? "Next goal"
        : step === "milestones"
          ? "Start season"
          : "Continue";

  const viewKey = step === "details" ? `details-${goalIdx}` : step;

  return (
    <div className="relative -mx-4 min-h-dvh px-4 sm:-mx-6 sm:px-6">
      {/* Top bar */}
      <div className="fixed inset-x-0 top-0 z-40 border-b border-line bg-bg pt-safe lg:left-[84px]">
        <div className="mx-auto flex h-14 w-full max-w-[640px] items-center gap-3 px-4 sm:px-6 lg:max-w-[760px]">
          {stepIndex === 0 ? (
            <Link href="/app/goals" aria-label="Close" className="tap grid size-10 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
              <X className="size-[18px]" strokeWidth={2.2} />
            </Link>
          ) : (
            <button type="button" onClick={back} aria-label="Back" className="tap grid size-10 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
              <ChevronLeft className="size-5" strokeWidth={2.2} />
            </button>
          )}
          <div
            className="flex flex-1 items-center justify-center gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={stepIndex + 1}
            aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
          >
            {STEPS.map((s, i) => (
              <motion.span
                key={s}
                className={cn("h-2 rounded-full", i <= stepIndex ? "bg-accent" : "bg-line-strong")}
                initial={false}
                animate={{ width: i === stepIndex ? 22 : 8, opacity: i < stepIndex ? 0.45 : 1 }}
                transition={springs.smooth}
              />
            ))}
          </div>
          <div className="tnum w-10 shrink-0 text-right text-[13px] font-medium text-ink-3">
            {stepIndex + 1} of {STEPS.length}
          </div>
        </div>
      </div>

      <div className="pt-[calc(var(--safe-top)+80px)] pb-40">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={viewKey}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 32 }}
            animate={{ opacity: 1, x: 0, transition: springs.smooth }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -32, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
          >
            {step === "season" && (
              <>
                <StepTitle title="Name your season" body="Twelve weeks to move what matters. A name makes it real." />
                <Field label="Season name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Autumn build" maxLength={80} autoFocus className="!py-3.5 !text-[18px] font-medium" />
                </Field>
                <Field label="Intention" hint="optional, one sentence">
                  <Textarea value={intention} onChange={(e) => setIntention(e.target.value)} rows={2} placeholder="e.g. Ship the thing, get strong, stay calm" />
                </Field>
                {currentSeason && (
                  <p className="mt-2 rounded-[12px] border border-line bg-surface-2 px-4 py-3 text-[13.5px] text-ink-2">
                    {currentSeason} will be archived when you finish.
                  </p>
                )}
              </>
            )}

            {step === "time" && (
              <>
                <StepTitle title="How much time a week?" body="Only the hours left after work, sleep and life. Most people have 10 to 20." />
                <div className="card mb-5 px-5 pt-5 pb-4 text-center">
                  <div className="display tnum text-[52px] leading-none text-ink">{capacity}h</div>
                  <p className="mt-1.5 text-[13.5px] text-ink-3">a week for goals · {capacity * 12}h this season</p>
                  <Stepper className="mt-4" value={capacity} onChange={setCapacity} min={1} max={80} format={(v) => `${v} hours`} />
                </div>
                <Field label="Starts">
                  <DatePicker value={startDate} onChange={(v) => v && setStartDate(v)} aria-label="Season start" />
                </Field>
                <p className="tnum -mt-1 px-1 text-[13px] text-ink-3">Ends {formatMonthDay(endDate)}, twelve weeks later.</p>
              </>
            )}

            {step === "dump" && (
              <>
                <StepTitle title="What do you want?" body="Everything for the next 12 weeks, one per line. No filtering yet." />
                <Textarea
                  value={dump}
                  onChange={(e) => setDump(e.target.value)}
                  rows={12}
                  autoFocus
                  placeholder={"Launch the new site\nRun a 10k\nRead 6 books\nSave for the trip\n…"}
                  className="min-h-[40dvh] !text-[17px] !leading-[1.7]"
                />
                <p className="mt-2 px-1 text-[13px] text-ink-3">{dumpIdeas(dump).length || "No"} ideas so far</p>
              </>
            )}

            {step === "goals" && <GoalsStep dump={dump} goals={goals} onAdd={addGoal} onRemove={removeGoal} />}

            {step === "details" && goals[goalIdx] && (
              <DetailsStep
                goal={goals[goalIdx]}
                index={goalIdx}
                count={goals.length}
                endLabel={formatMonthDay(endDate)}
                onChange={(p) => patchGoal(goals[goalIdx].key, p)}
              />
            )}

            {step === "capacity" && <CapacityStep goals={goals} capacity={capacity} onChange={patchGoal} />}

            {step === "milestones" && (
              <MilestonesStep goals={goals} startDate={start_} endDate={endDate} onChange={patchGoal} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg pt-3 lg:left-[84px]">
        <div className="pb-[max(16px,var(--safe-bottom))]">
          <div className="mx-auto w-full max-w-[640px] px-4 sm:px-6 lg:max-w-[760px]">
            {error && (
              <p role="alert" className="mb-2 flex items-start gap-2 px-1 text-[13.5px] font-medium text-warn">
                <AlertTriangle className="mt-px size-4 shrink-0" />
                {error}
              </p>
            )}
            <Button size="lg" variant={canNext ? "accent" : "secondary"} className="disabled:text-ink-3 disabled:opacity-100" onClick={next} disabled={!canNext} loading={pending}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepTitle({ title, body, eyebrow }: { title: ReactNode; body?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6">
      {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
      <h1 className="display text-[26px] text-balance text-ink lg:text-[28px]">{title}</h1>
      {body && <p className="mt-1.5 max-w-[38ch] text-[15px] leading-snug text-ink-2">{body}</p>}
    </div>
  );
}

// ─────────────────────────── Step 3: goals ───────────────────────────

function GoalsStep({
  dump,
  goals,
  onAdd,
  onRemove,
}: {
  dump: string;
  goals: DraftGoal[];
  onAdd: (title: string) => void;
  onRemove: (key: string) => void;
}) {
  const [text, setText] = useState("");
  const taken = new Set(goals.map((g) => g.title.toLowerCase()));
  const ideas = dumpIdeas(dump).filter((i) => !taken.has(i.toLowerCase()));

  return (
    <>
      <StepTitle title="Pick your goals" body="Tap an idea to make it a goal, or write one. Three is plenty." />

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(text);
          setText("");
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a goal" maxLength={200} />
        <Button type="submit" variant="secondary" size="icon" className="size-[50px] rounded-[12px]" aria-label="Add goal" disabled={!text.trim()}>
          <Plus className="size-5" strokeWidth={2.4} />
        </Button>
      </form>

      {ideas.length > 0 && (
        <div className="mb-7">
          <Label>From your dump</Label>
          <div className="flex flex-wrap gap-2">
            {ideas.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => onAdd(idea)}
                className="tap inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-surface-2 px-4 py-2 text-left text-[14.5px] font-medium text-ink-2"
              >
                <Plus className="size-3.5 shrink-0 text-ink-3" strokeWidth={2.4} />
                {idea}
              </button>
            ))}
          </div>
        </div>
      )}

      <Label hint={goals.length ? `${goals.length} ${goals.length === 1 ? "goal" : "goals"}` : undefined}>Your goals</Label>
      {goals.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-line-strong px-5 py-8 text-center text-[14px] text-ink-3">
          Nothing yet. Pick one or two to start.
        </div>
      ) : (
        <motion.ul layout className="card overflow-hidden">
          <AnimatePresence initial={false}>
            {goals.map((g, i) => (
              <motion.li
                key={g.key}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-line"
              >
                <div className="flex items-center gap-3 py-2 pr-2 pl-4">
                  <span className="tnum grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-accent-ink" style={{ background: colorVar(g.color) }}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 py-1.5 text-[15.5px] font-medium text-ink">{g.title}</span>
                  <button type="button" onClick={() => onRemove(g.key)} aria-label={`Remove ${g.title}`} className="tap grid size-10 shrink-0 place-items-center rounded-full text-ink-3">
                    <X className="size-4" strokeWidth={2.2} />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
      {goals.length > 5 && <p className="mt-3 px-1 text-[13px] text-warn">That is a lot for 12 weeks. Fewer goals, more done.</p>}
    </>
  );
}

// ─────────────────────────── Step 4: details ───────────────────────────

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="grid grid-cols-7">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className="tap grid h-11 place-items-center"
        >
          <span
            className={cn("grid size-8 place-items-center rounded-full transition-shadow", value === c && "ring-2 ring-ink ring-offset-2 ring-offset-bg")}
            style={{ background: colorVar(c) }}
          >
            {value === c && <Check className="size-4 text-accent-ink" strokeWidth={3} />}
          </span>
        </button>
      ))}
    </div>
  );
}

function DetailsStep({
  goal,
  index,
  count,
  endLabel,
  onChange,
}: {
  goal: DraftGoal;
  index: number;
  count: number;
  endLabel: string;
  onChange: (p: Partial<DraftGoal>) => void;
}) {
  return (
    <>
      <div className="mb-6">
        <div className="eyebrow mb-1.5 flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: colorVar(goal.color) }} />
          Goal {index + 1} of {count}
        </div>
        <h1 className="display text-[26px] text-balance text-ink lg:text-[28px]">{goal.title}</h1>
      </div>

      <Field label={`What should have happened by ${endLabel}?`}>
        <Textarea
          value={goal.outcome}
          onChange={(e) => onChange({ outcome: e.target.value })}
          rows={2}
          placeholder="e.g. v2 live with 100 paying users"
          className="!text-[17px]"
        />
      </Field>
      <Field label="System" hint="when and where">
        <Input value={goal.system} onChange={(e) => onChange({ system: e.target.value })} placeholder="e.g. Mon/Wed/Fri 7am, after coffee" />
      </Field>
      <Field label="Area">
        <PillPicker<Area> value={goal.area} onChange={(area) => onChange({ area })} options={AREAS.map((a) => ({ ...a }))} />
      </Field>
      <Field label="Colour">
        <ColorRow value={goal.color} onChange={(color) => onChange({ color })} />
      </Field>
    </>
  );
}

// ─────────────────────────── Step 5: capacity ───────────────────────────

function CapacityStep({
  goals,
  capacity,
  onChange,
}: {
  goals: DraftGoal[];
  capacity: number;
  onChange: (key: string, p: Partial<DraftGoal>) => void;
}) {
  const total = goals.reduce((s, g) => s + g.weeklyHours, 0);
  const core = goals.filter((g) => g.tier === "core").length;
  const over = total - capacity;
  const pct = Math.min(1, total / Math.max(1, capacity));

  return (
    <>
      <StepTitle title="Does it fit?" body="The plan has to fit the time you really have." />

      <div className="card mb-4 px-5 pt-5 pb-4">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className={cn("display tnum text-[48px] leading-none", over > 0 ? "text-bad" : "text-ink")}>{fmtHours(total)}</span>
            <span className="text-[15px] text-ink-3">of {capacity}h a week</span>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken">
          <motion.div
            className={cn("h-full rounded-full", over > 0 ? "bg-bad" : "bg-ok")}
            initial={false}
            animate={{ width: `${pct * 100}%` }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
          />
        </div>
        <p className={cn("mt-3 text-[14px] font-medium", over > 0 ? "text-bad" : "text-ok")}>
          {over > 0 ? `${fmtHours(over)} over. Trim hours or drop a goal.` : over === 0 ? "Exactly at capacity." : `Fits, with ${fmtHours(-over)} to spare.`}
        </p>
      </div>

      {core > 3 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[12px] bg-warn-soft px-4 py-3 text-[14px] font-medium text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {core} core goals. Keep it to 3 or fewer.
        </div>
      )}
      {core === 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-[12px] bg-warn-soft px-4 py-3 text-[14px] font-medium text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Pick one core goal to lead the season.
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {goals.map((g) => (
          <div key={g.key} className="card px-4 pt-3.5 pb-3">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorVar(g.color) }} />
              <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold tracking-tight text-ink">{g.title}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Segmented<Tier>
                size="sm"
                className="flex-1"
                value={g.tier}
                onChange={(tier) => onChange(g.key, { tier })}
                options={TIERS.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
            <Stepper
              className="mt-2.5"
              value={g.weeklyHours}
              onChange={(weeklyHours) => onChange(g.key, { weeklyHours })}
              step={0.5}
              min={0}
              max={40}
              format={(v) => `${fmtHours(v)} / week`}
            />
          </div>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────── Step 6: milestones ───────────────────────────

function MilestonesStep({
  goals,
  startDate,
  endDate,
  onChange,
}: {
  goals: DraftGoal[];
  startDate: string;
  endDate: string;
  onChange: (key: string, p: Partial<DraftGoal>) => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const goal = goals.find((g) => g.key === adding);

  return (
    <>
      <StepTitle title="Add checkpoints" body="A dated milestone or two per goal keeps you honest. Optional." />
      <div className="flex flex-col gap-3">
        {goals.map((g) => (
          <div key={g.key} className="card overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorVar(g.color) }} />
              <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold tracking-tight text-ink">{g.title}</span>
            </div>
            {g.milestones.length > 0 && (
              <ul className="px-4">
                {[...g.milestones]
                  .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
                  .map((m) => (
                    <li key={m.key} className="flex items-center gap-3 border-b border-line py-2">
                      <Flag className="size-3.5 shrink-0 text-ink-3" />
                      <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">{m.title}</span>
                      {m.dueDate && <span className="tnum shrink-0 text-[13px] text-ink-3">{formatMonthDay(m.dueDate)}</span>}
                      <button
                        type="button"
                        aria-label={`Remove ${m.title}`}
                        onClick={() => onChange(g.key, { milestones: g.milestones.filter((x) => x.key !== m.key) })}
                        className="tap -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-ink-3"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setAdding(g.key)}
              className="tap flex min-h-[52px] w-full items-center gap-2 px-4 py-3.5 text-[14.5px] font-medium text-ink-2 active:bg-sunken"
            >
              <Plus className="size-4" strokeWidth={2.4} /> Add milestone
            </button>
          </div>
        ))}
      </div>
      <MilestoneDraftSheet
        key={adding ?? "none"}
        open={!!goal}
        goalTitle={goal?.title ?? ""}
        startDate={startDate}
        endDate={endDate}
        onClose={() => setAdding(null)}
        onAdd={(m) => goal && onChange(goal.key, { milestones: [...goal.milestones, { key: uid(), ...m }] })}
      />
    </>
  );
}

function MilestoneDraftSheet({
  open,
  goalTitle,
  startDate,
  endDate,
  onClose,
  onAdd,
}: {
  open: boolean;
  goalTitle: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onAdd: (m: { title: string; dueDate: string | null }) => void;
}) {
  const weekEnd = (n: number) => addDays(startDate, n * 7 - 1);
  const presets = [
    { value: "w4", label: `Week 4 · ${formatMonthDay(weekEnd(4))}`, date: weekEnd(4) },
    { value: "w8", label: `Week 8 · ${formatMonthDay(weekEnd(8))}`, date: weekEnd(8) },
    { value: "w12", label: `End · ${formatMonthDay(endDate)}`, date: endDate },
  ];
  const [title, setTitle] = useState("");
  const [choice, setChoice] = useState<string>("w4");
  const [custom, setCustom] = useState(weekEnd(6));
  const dueDate = choice === "none" ? null : choice === "date" ? (isValidISODate(custom) ? custom : null) : presets.find((p) => p.value === choice)!.date;

  const submit = (more: boolean) => {
    if (!title.trim()) return;
    onAdd({ title: title.trim().slice(0, 200), dueDate });
    setTitle("");
    if (!more) onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="New milestone" description={goalTitle}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <Field>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Beta in 10 hands" autoFocus maxLength={200} />
        </Field>
        <Field label="By when">
          <PillPicker
            value={choice}
            onChange={setChoice}
            options={[...presets.map(({ value, label }) => ({ value, label })), { value: "date", label: "Pick date" }, { value: "none", label: "No date" }]}
          />
          {choice === "date" && <DatePicker className="mt-2.5" value={custom} min={startDate} max={endDate} onChange={setCustom} aria-label="Milestone date" />}
        </Field>
        <div className="flex gap-2.5">
          <Button type="button" variant="secondary" size="lg" className="flex-1" disabled={!title.trim()} onClick={() => submit(true)}>
            Add another
          </Button>
          <Button type="submit" variant="accent" size="lg" className="flex-1" disabled={!title.trim()}>
            Add
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
