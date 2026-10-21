"use client";

import { Check, ChevronLeft, ChevronRight, CircleAlert, Globe, LocateFixed, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Timi, type TimiMood } from "@/components/ai/timi";
import { Button } from "@/components/ui/button";
import { Select, Stepper } from "@/components/ui/controls";
import { springs, useReducedMotion } from "@/components/ui/motion";
import { DatePicker, TimePicker } from "@/components/ui/pickers";
import { DayLine, Meter } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { GUIDE } from "@/lib/ai/guide";
import { startRun } from "@/lib/ai/runs-client";
import { cn } from "@/lib/cn";
import { colorVar, type PaletteColor } from "@/lib/colors";
import {
  addDays,
  formatDuration,
  formatMonthDay,
  formatWeekdayShort,
  isValidISODate,
  nowMinIn,
  parseTime,
  SEASON_DAYS,
  startOfWeek,
  toTimeInput,
  weekDays,
} from "@/lib/dates";
import { useClientValue } from "@/lib/hooks";
import { finishOnboarding } from "./actions";

const STEPS = ["hello", "day", "season", "goals", "week"] as const;
type Step = (typeof STEPS)[number];

type Area = "work" | "health" | "creative" | "learning" | "personal" | "money";
type DraftGoal = { key: string; title: string; area: Area; color: PaletteColor; hours: number };

const MAX_GOALS = 3;
// Goal colours in the order new goals get them; tap a goal's dot to change it.
const COLORS: PaletteColor[] = ["pine", "sky", "sand", "teal", "olive", "sage", "stone"];
const IDEAS: { title: string; area: Area }[] = [
  { title: "Ship a side project", area: "work" },
  { title: "Run a 10k", area: "health" },
  { title: "Read 6 books", area: "learning" },
  { title: "Get stronger", area: "health" },
  { title: "Learn Spanish", area: "learning" },
  { title: "Write every week", area: "creative" },
  { title: "Save for a trip", area: "money" },
  { title: "Sleep before 11", area: "personal" },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const dayLabel = (d: string) => `${formatWeekdayShort(d)} ${formatMonthDay(d)}`;
const zoneLabel = (z: string) => z.replaceAll("_", " ");
const NO_ZONES: string[] = [];
let zoneList: string[] | null = null;
/** Every IANA zone, read once (useSyncExternalStore needs a stable snapshot). */
const readZones = () => {
  if (!zoneList) {
    try {
      zoneList = Intl.supportedValuesOf("timeZone");
    } catch {
      zoneList = NO_ZONES;
    }
  }
  return zoneList;
};
const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
};

export function Onboarding({
  name,
  today,
  timezone: savedZone,
  dayStartMin,
  dayEndMin,
  seasonName,
}: {
  name: string;
  today: string;
  timezone: string;
  dayStartMin: number;
  dayEndMin: number;
  seasonName: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("hello");
  const [dir, setDir] = useState(1);
  const index = STEPS.indexOf(step);

  // Your day
  const device = useClientValue(deviceZone, "");
  const [zone, setZone] = useState<string | null>(null);
  const timezone = zone ?? (savedZone === "UTC" && device ? device : savedZone);
  const [dayStart, setDayStart] = useState(toTimeInput(dayStartMin));
  const [dayEnd, setDayEnd] = useState(toTimeInput(dayEndMin));
  const startMin = parseTime(dayStart);
  const endMin = parseTime(dayEnd);
  const dayOk = startMin != null && endMin != null && endMin - startMin >= 60;

  // Season
  const thisMonday = startOfWeek(today);
  const [seasonStart, setSeasonStart] = useState(thisMonday);
  const start = isValidISODate(seasonStart) ? seasonStart : thisMonday;
  const end = addDays(start, SEASON_DAYS - 1);

  // Goals
  const [goals, setGoals] = useState<DraftGoal[]>([]);
  const totalHours = goals.reduce((s, g) => s + g.hours, 0);

  // Timi reacts for a moment, then settles back to the step's mood
  const [flash, setFlash] = useState<TimiMood | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const react = (mood: TimiMood, ms = 1400) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(mood);
    flashTimer.current = setTimeout(() => setFlash(null), ms);
  };
  useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), []);

  const [pending, startSaving] = useTransition();
  const [saving, setSaving] = useState<"now" | "timi" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = (to: Step) => {
    const d = STEPS.indexOf(to) > index ? 1 : -1;
    setDir(d);
    setStep(to);
    setError(null);
    if (d > 0 && to !== "week") react("happy", 900);
  };
  const next = () => go(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  const back = () => go(STEPS[Math.max(index - 1, 0)]);

  const addGoal = (title: string, area: Area = "work") => {
    const t = title.trim().slice(0, 200);
    if (!t || goals.length >= MAX_GOALS || goals.some((g) => g.title.toLowerCase() === t.toLowerCase())) return;
    const used = new Set(goals.map((g) => g.color));
    const color = COLORS.find((c) => !used.has(c)) ?? COLORS[0];
    setGoals((gs) => [...gs, { key: uid(), title: t, area, color, hours: 3 }]);
    react("happy");
  };
  const patchGoal = (key: string, patch: Partial<DraftGoal>) => setGoals((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  const removeGoal = (key: string) => setGoals((gs) => gs.filter((g) => g.key !== key));

  const finish = (then: "now" | "timi") => {
    setError(null);
    setSaving(then);
    startSaving(async () => {
      try {
        const res = await finishOnboarding({
          timezone,
          dayStart,
          dayEnd,
          seasonName,
          startDate: start,
          capacityHours: Math.max(15, Math.ceil(totalHours)),
          goals: goals.map((g) => ({ title: g.title, area: g.area, color: g.color, weeklyHours: g.hours })),
        });
        if (res?.error) {
          setError(res.error);
          setSaving(null);
          react("error", 1600);
          return;
        }
        if (then === "timi") {
          // The answer arrives through the run toast; Week is where the blocks land.
          await startRun(GUIDE.planWeek).catch(() => {});
          router.push("/app/plan");
        } else router.push("/app");
      } catch {
        setError("Couldn't save. Try again.");
        setSaving(null);
        react("error", 1600);
      }
    });
  };

  const moods: Record<Step, TimiMood> = { hello: "idle", day: "idle", season: "idle", goals: "idle", week: "happy" };
  const mood: TimiMood = pending ? "thinking" : (flash ?? moods[step]);
  const firstName = name.trim().split(/\s+/)[0] || "there";

  const view = (() => {
    switch (step) {
      case "hello":
        return (
          <div className="flex flex-col items-start pt-[6vh] lg:pt-0">
            <Timi size={112} mood={mood} interactive className="-ml-3" />
            <h1 className="mt-6 text-[32px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance text-ink lg:text-[36px]">
              Hi {firstName}. I&apos;m Timi.
            </h1>
            <p className="mt-3 max-w-[40ch] text-[16.5px] leading-relaxed text-pretty text-ink-2">
              I&apos;ll help you point your hours at what matters. Three quick questions, then your first week.
            </p>
          </div>
        );
      case "day":
        return (
          <>
            <StepTitle mood={mood} title="When does your day run?" body="I only plan inside these hours." />
            <div className="grid grid-cols-2 gap-3">
              <TimeCard label="Starts" value={dayStart} onChange={setDayStart} suggestions={["06:00", "07:00", "08:00", "09:00"]} />
              <TimeCard label="Ends" value={dayEnd} onChange={setDayEnd} suggestions={["21:00", "22:00", "23:00", "23:30"]} />
            </div>
            <div className="mt-7">
              <DayLine
                segments={dayOk ? [{ start: startMin!, end: endMin!, state: "done", color: "var(--accent)", label: "Your day" }] : []}
                dayStart={0}
                dayEnd={1440}
                labels={{ start: "00:00", end: "24:00" }}
                marks={dayOk ? [startMin!, endMin!] : []}
                height={12}
              />
              <p className={cn("tnum mt-3 text-[14px]", dayOk ? "text-ink-2" : "flex items-center gap-1.5 font-medium text-warn")}>
                {dayOk ? (
                  `${formatDuration(endMin! - startMin!)} a day to plan in.`
                ) : (
                  <>
                    <CircleAlert className="size-4 shrink-0" strokeWidth={2.2} />
                    End at least an hour after the start.
                  </>
                )}
              </p>
            </div>
            <ZoneRow value={timezone} device={device} onChange={setZone} />
          </>
        );
      case "season":
        return (
          <>
            <StepTitle
              mood={mood}
              title="When does your season start?"
              body="Twelve weeks: long enough to finish something, short enough to stay focused."
            />
            <SeasonStart today={today} value={start} onChange={setSeasonStart} />
            <WeekStrip start={start} end={end} today={today} />
          </>
        );
      case "goals":
        return (
          <>
            <StepTitle mood={mood} title="What do you want to move?" body="Pick up to three. Fewer goals, more done." />
            <GoalPicker goals={goals} onAdd={addGoal} onRemove={removeGoal} onPatch={patchGoal} />
          </>
        );
      case "week":
        return (
          <>
            <StepTitle mood={mood} title="Your first week" body={null} />
            <FirstWeek
              goals={goals}
              today={today}
              start={start}
              timezone={timezone}
              dayStart={startMin ?? dayStartMin}
              dayEnd={endMin ?? dayEndMin}
              seasonEnd={end}
            />
          </>
        );
    }
  })();

  const footer = (() => {
    switch (step) {
      case "hello":
        return (
          <>
            <Button variant="accent" size="lg" className="h-12" onClick={next}>
              Let&apos;s start
            </Button>
            <button
              type="button"
              onClick={() => router.push("/app")}
              className="tap mx-auto mt-2 flex h-11 items-center px-3 text-[14.5px] font-medium text-ink-3 hover:text-ink-2"
            >
              Skip for now
            </button>
          </>
        );
      case "week":
        return (
          <div className="flex flex-col gap-2.5">
            <Button
              variant="accent"
              size="lg"
              className="h-12 disabled:opacity-100"
              onClick={() => finish(goals.length ? "timi" : "now")}
              disabled={pending}
            >
              {pending && saving === (goals.length ? "timi" : "now") ? (
                <Saving />
              ) : goals.length ? (
                <>
                  <span className="-ml-1 grid size-7 place-items-center rounded-full bg-accent-ink/15">
                    <Timi size={24} mood="idle" />
                  </span>
                  Plan my week with Timi
                </>
              ) : (
                "Go to Now"
              )}
            </Button>
            {goals.length > 0 && (
              <Button variant="outline" size="lg" className="h-12 disabled:opacity-100" onClick={() => finish("now")} disabled={pending}>
                {pending && saving === "now" ? <Saving /> : "Go to Now"}
              </Button>
            )}
          </div>
        );
      default:
        return (
          <Button
            variant={step === "goals" && goals.length === 0 ? "secondary" : "accent"}
            size="lg"
            className="h-12"
            onClick={next}
            disabled={step === "day" && !dayOk}
          >
            {step === "goals" && goals.length === 0 ? "Skip goals for now" : "Continue"}
          </Button>
        );
    }
  })();

  return (
    <div className="flex min-h-full flex-col">
      {/* Top: back, progress, step count */}
      <header className="sticky top-0 z-30 bg-bg pt-safe">
        <div className="mx-auto flex h-16 w-full max-w-[560px] items-center gap-3 px-3 lg:h-20">
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            disabled={index === 0 || pending}
            className={cn(
              "tap grid size-11 shrink-0 place-items-center rounded-full text-ink-2 transition-opacity hover:bg-sunken",
              index === 0 && "pointer-events-none opacity-0",
            )}
          >
            <ChevronLeft className="size-[22px]" strokeWidth={2} />
          </button>
          <Progress index={index} count={STEPS.length} />
          <span className="tnum w-11 shrink-0 text-center text-[13px] font-medium text-ink-3">
            {index + 1}/{STEPS.length}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-5 lg:justify-center lg:pb-[8vh]">
        <main className="mx-auto w-full max-w-[520px] flex-1 pt-4 pb-8 lg:flex-none lg:pt-0">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0, transition: springs.smooth }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -28, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
            >
              {view}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="sticky bottom-0 mx-auto w-full max-w-[520px] bg-bg pt-3 pb-[max(16px,var(--safe-bottom))] lg:static lg:pt-4">
          <AnimatePresence initial={false}>
            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden text-[14px] font-medium text-warn"
              >
                <span className="flex items-start gap-2 pb-3">
                  <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2.2} />
                  {error}
                </span>
              </motion.p>
            )}
          </AnimatePresence>
          {footer}
        </footer>
      </div>
    </div>
  );
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function Saving() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      Saving
    </span>
  );
}

function Progress({ index, count }: { index: number; count: number }) {
  return (
    <div
      className="flex flex-1 items-center gap-1.5"
      role="progressbar"
      aria-label={`Step ${index + 1} of ${count}`}
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={index + 1}
    >
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-line-strong">
          <motion.span
            className="absolute inset-0 origin-left rounded-full bg-accent"
            initial={false}
            animate={{ scaleX: i <= index ? 1 : 0 }}
            transition={springs.smooth}
          />
        </span>
      ))}
    </div>
  );
}

function StepTitle({ mood, title, body }: { mood: TimiMood; title: string; body: ReactNode }) {
  return (
    <div className="mb-7">
      <Timi size={52} mood={mood} className="-ml-1.5 mb-4" />
      <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance text-ink lg:text-[30px]">{title}</h1>
      {body && <p className="mt-2.5 max-w-[42ch] text-[15.5px] leading-relaxed text-pretty text-ink-2">{body}</p>}
    </div>
  );
}

/* ─────────────────────────── Your day ─────────────────────────── */

function TimeCard({
  label,
  value,
  onChange,
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) {
  return (
    <div>
      <div className="mb-2 px-0.5 text-[13.5px] font-medium text-ink-2">{label}</div>
      <TimePicker
        value={value}
        onChange={onChange}
        step={900}
        aria-label={`Day ${label.toLowerCase()}`}
        className="h-14 !text-[17px] font-medium"
        suggestions={suggestions.map((s) => ({ value: s, label: s }))}
      />
    </div>
  );
}

function ZoneRow({ value, device, onChange }: { value: string; device: string; onChange: (z: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const zones = useClientValue(readZones, NO_ZONES);
  const options = zones.includes(value) ? zones : [value, ...zones];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className="tap-row mt-7 -mx-2 flex min-h-14 w-[calc(100%+16px)] items-center gap-3 rounded-[12px] px-2 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
          <Globe className="size-[17px]" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-ink">{zoneLabel(value)}</span>
          <span className="block text-[13px] text-ink-3">{device && device === value ? "Timezone, from this device" : "Timezone"}</span>
        </span>
        <span className="text-[14px] font-medium text-ink-2">Change</span>
        <ChevronRight className="size-4 text-ink-3" />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Timezone"
        description="Days start and end here."
        footer={
          <Button
            variant="accent"
            size="lg"
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            Done
          </Button>
        }
      >
        <Select value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Timezone" className="mb-4 h-12">
          {options.map((z) => (
            <option key={z} value={z}>
              {zoneLabel(z)}
            </option>
          ))}
        </Select>
        {device && device !== draft && (
          <Button type="button" variant="secondary" className="mb-2 w-full" onClick={() => setDraft(device)}>
            <LocateFixed className="size-4" />
            Use this device&apos;s timezone
          </Button>
        )}
      </Sheet>
    </>
  );
}

/* ─────────────────────────── Season ─────────────────────────── */

function SeasonStart({ today, value, onChange }: { today: string; value: string; onChange: (d: string) => void }) {
  const thisMonday = startOfWeek(today);
  const nextMonday = addDays(thisMonday, 7);
  const presets = [
    { date: thisMonday, label: "This Monday" },
    ...(today !== thisMonday ? [{ date: today, label: "Today" }] : []),
    { date: nextMonday, label: "Next Monday" },
  ];
  const isPreset = presets.some((p) => p.date === value);
  const [custom, setCustom] = useState(!isPreset);

  return (
    <div role="radiogroup" aria-label="Season start" className="flex flex-col gap-2.5">
      {presets.map((p) => (
        <Choice
          key={p.label}
          selected={!custom && value === p.date}
          onSelect={() => {
            setCustom(false);
            onChange(p.date);
          }}
          title={p.label}
          detail={dayLabel(p.date)}
        />
      ))}
      <Choice selected={custom} onSelect={() => setCustom(true)} title="Another day" detail={custom ? null : "Pick a date"}>
        {custom && (
          <DatePicker
            className="mt-3"
            value={value}
            today={today}
            min={addDays(today, -13)}
            max={addDays(today, 90)}
            onChange={(v) => v && onChange(v)}
            aria-label="Season start date"
          />
        )}
      </Choice>
    </div>
  );
}

function Choice({
  selected,
  onSelect,
  title,
  detail,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[16px] border bg-surface transition-colors duration-150",
        selected ? "border-accent shadow-[inset_0_0_0_1px_var(--accent)]" : "border-line hover:border-line-strong",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className="tap flex min-h-[60px] w-full items-center gap-3 px-4 text-left"
      >
        <span className="min-w-0 flex-1 text-[16px] font-medium text-ink">{title}</span>
        {detail && <span className="tnum text-[14.5px] text-ink-2">{detail}</span>}
        <span
          className={cn(
            "grid size-[22px] shrink-0 place-items-center rounded-full border transition-colors",
            selected ? "border-accent bg-accent text-accent-ink" : "border-line-strong",
          )}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </button>
      {children && <div className="px-4 pb-4 -mt-2">{children}</div>}
    </div>
  );
}

function WeekStrip({ start, end, today }: { start: string; end: string; today: string }) {
  const weeks = Array.from({ length: SEASON_DAYS / 7 }, (_, i) => addDays(start, i * 7));
  return (
    <div className="mt-7">
      <div className="flex gap-1" aria-hidden>
        {weeks.map((w, i) => {
          const current = today >= w && today <= addDays(w, 6);
          return (
            <motion.span
              key={i}
              className={cn("h-9 flex-1 rounded-[6px]", i === 0 ? "bg-accent" : current ? "bg-accent/60" : "bg-sunken")}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.smooth, delay: i * 0.02 }}
            />
          );
        })}
      </div>
      <div className="tnum mt-2.5 flex justify-between text-[13.5px] text-ink-3">
        <span>Week 1 · {dayLabel(start)}</span>
        <span>Ends {dayLabel(end)}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── Goals ─────────────────────────── */

function GoalPicker({
  goals,
  onAdd,
  onRemove,
  onPatch,
}: {
  goals: DraftGoal[];
  onAdd: (title: string, area?: Area) => void;
  onRemove: (key: string) => void;
  onPatch: (key: string, p: Partial<DraftGoal>) => void;
}) {
  const [text, setText] = useState("");
  const full = goals.length >= MAX_GOALS;
  const taken = new Set(goals.map((g) => g.title.toLowerCase()));
  const ideas = IDEAS.filter((i) => !taken.has(i.title.toLowerCase()));

  const cycle = (g: DraftGoal) => {
    const used = new Set(goals.filter((x) => x.key !== g.key).map((x) => x.color));
    const from = COLORS.indexOf(g.color);
    for (let i = 1; i <= COLORS.length; i++) {
      const c = COLORS[(from + i) % COLORS.length];
      if (!used.has(c)) return onPatch(g.key, { color: c });
    }
  };

  return (
    <>
      <motion.ul layout className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {goals.map((g) => (
            <motion.li
              key={g.key}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
              transition={springs.smooth}
              className="rounded-[16px] border border-line bg-surface p-2"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => cycle(g)}
                  aria-label={`Colour for ${g.title}. Tap to change.`}
                  className="tap grid size-11 shrink-0 place-items-center rounded-full"
                >
                  <motion.span
                    key={g.color}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={springs.snappy}
                    className="size-4 rounded-full"
                    style={{ background: colorVar(g.color) }}
                  />
                </button>
                <span className="min-w-0 flex-1 truncate text-[16px] font-medium text-ink">{g.title}</span>
                <button
                  type="button"
                  onClick={() => onRemove(g.key)}
                  aria-label={`Remove ${g.title}`}
                  className="tap grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:text-ink-2"
                >
                  <X className="size-[18px]" strokeWidth={2} />
                </button>
              </div>
              <Stepper
                className="mt-1"
                value={g.hours}
                min={1}
                max={20}
                onChange={(hours) => onPatch(g.key, { hours })}
                format={(v) => (
                  <span>
                    {v}h <span className="font-normal text-ink-3">a week</span>
                  </span>
                )}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {!full && (
        <motion.div layout transition={springs.smooth} className={cn(goals.length > 0 && "mt-5")}>
          <form
            className="focus-shell flex h-14 items-center gap-2 rounded-[16px] border border-line-strong bg-surface pr-1.5 pl-4"
            onSubmit={(e) => {
              e.preventDefault();
              onAdd(text);
              setText("");
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={goals.length ? "Add another" : "Write your own"}
              maxLength={200}
              aria-label="Goal"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
            <Button
              type="submit"
              variant={text.trim() ? "accent" : "secondary"}
              size="icon"
              aria-label="Add goal"
              disabled={!text.trim()}
              className="size-11 disabled:opacity-100 disabled:text-ink-3"
            >
              <Plus className="size-5" strokeWidth={2.2} />
            </Button>
          </form>

          <div className="mt-5 mb-2.5 px-0.5 text-[13.5px] font-medium text-ink-3">Or start from one of these</div>
          <div className="flex flex-wrap gap-2">
            {ideas.map((idea) => (
              <button
                key={idea.title}
                type="button"
                onClick={() => onAdd(idea.title, idea.area)}
                className="tap inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-[14.5px] font-medium text-ink-2 hover:text-ink"
              >
                <Plus className="size-3.5 text-ink-3" strokeWidth={2.4} />
                {idea.title}
              </button>
            ))}
          </div>
        </motion.div>
      )}
      {full && <p className="mt-4 px-0.5 text-[14px] text-ink-3">Three is plenty. You can add more later from Season.</p>}
    </>
  );
}

/* ─────────────────────────── Your first week ─────────────────────────── */

function FirstWeek({
  goals,
  today,
  start,
  timezone,
  dayStart,
  dayEnd,
  seasonEnd,
}: {
  goals: DraftGoal[];
  today: string;
  start: string;
  timezone: string;
  dayStart: number;
  dayEnd: number;
  seasonEnd: string;
}) {
  const nowMin = useClientValue(() => nowMinIn(timezone), dayStart);
  const from = start > today ? start : today;
  const days = weekDays(startOfWeek(from)).filter((d) => d >= from);
  const openMin = days.reduce((sum, d) => sum + Math.max(0, dayEnd - (d === today ? Math.max(dayStart, nowMin) : dayStart)), 0);
  const needMin = goals.reduce((s, g) => s + g.hours * 60, 0);
  const over = needMin > openMin;
  const when = start > today ? `the week of ${dayLabel(startOfWeek(from))}` : "this week";

  if (!goals.length)
    return (
      <div>
        <p className="text-[15.5px] leading-relaxed text-ink-2">
          Your season runs {dayLabel(start)} to {dayLabel(seasonEnd)}. You have{" "}
          <span className="tnum font-medium text-ink">{formatDuration(openMin)}</span> open in your planner {when}. Add goals from Season
          when you&apos;re ready.
        </p>
      </div>
    );

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[56px] leading-none font-semibold tracking-[-0.04em] text-ink">{formatDuration(needMin)}</span>
        <span className="tnum text-[16px] text-ink-2">of {formatDuration(openMin)} open</span>
      </div>
      <p className="mt-2 text-[15px] text-ink-2">What your goals need {when}, against the open time in your planner.</p>

      <Meter
        className="mt-6"
        height={12}
        total={Math.max(openMin, needMin)}
        legend={false}
        segments={goals.map((g) => ({ value: g.hours * 60, color: colorVar(g.color) }))}
      />

      <ul className="mt-6 flex flex-col">
        {goals.map((g) => (
          <li key={g.key} className="flex min-h-12 items-center gap-3 border-b border-line last:border-b-0">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorVar(g.color) }} />
            <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium text-ink">{g.title}</span>
            <span className="tnum text-[14.5px] text-ink-2">{g.hours}h</span>
          </li>
        ))}
      </ul>

      {over ? (
        <p className="mt-5 flex items-start gap-2 text-[14px] font-medium text-warn">
          <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2.2} />
          That is more than your open time. Go back and trim the hours, or start next Monday.
        </p>
      ) : (
        <div className="mt-6 flex items-start gap-3 rounded-[16px] bg-accent-soft px-4 py-3.5">
          <Timi size={28} mood="happy" className="mt-px" />
          <p className="text-[14.5px] leading-relaxed text-ink">
            It fits. I can put {goals.length === 1 ? "it" : "them"} on your calendar as time blocks, about{" "}
            <span className="tnum font-medium">{formatDuration(needMin / Math.max(1, days.length))}</span> a day.
          </p>
        </div>
      )}
    </div>
  );
}
