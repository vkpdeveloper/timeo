"use client";

import { useHotkeys } from "@tanstack/react-hotkeys";
import { AlertCircle, Check, ChevronDown, Minus, Pause, Play, Plus, Square, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Segmented, Textarea } from "@/components/ui/controls";
import { Countdown, LinearProgress, useNow } from "@/components/ui/live";
import { CountUp, springs } from "@/components/ui/motion";
import { Section, Stat, StatStrip } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { formatDuration, formatMin } from "@/lib/dates";
import { appHotkeys } from "@/lib/hotkeys";
import {
  ENERGY_OPTIONS,
  FOCUS_MAX,
  FOCUS_MIN,
  FOCUS_PRESETS,
  focusQuality,
  formatClock,
  qualityLabel,
  RATING_LABELS,
} from "@/lib/focus";
import { discardFocus, finishFocus, startFocus } from "./actions";
import type { FocusSessionSummary } from "./data";

export type FocusOption = {
  key: string;
  type: "block" | "task" | "goal";
  label: string;
  color: string | null;
  goalId?: string | null;
  taskId?: string | null;
  blockId?: string | null;
  startMin?: number;
  minutes?: number | null;
};

type ActiveRow = {
  id: string;
  label: string;
  goalId: string | null;
  taskId: string | null;
  blockId: string | null;
  startedAt: number;
  plannedMin: number;
  color: string | null;
};

/** Everything needed to resume a session after a reload. */
type Run = {
  v: 1;
  id: string;
  label: string;
  color: string | null;
  goalId: string | null;
  taskId: string | null;
  blockId: string | null;
  plannedMin: number;
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  pauses: number;
  endedAt: number | null;
  /** Ended on its own (time ran out) rather than with End. */
  completed: boolean;
};

type Result = { quality: number; focusedMin: number; sessions: FocusSessionSummary[]; label: string; color: string | null };

const STORE = "timeo.focus.v1";
/** Text on a goal-coloured fill: goal colours are deep in light mode and bright in dark, like the accent. */
const ON_COLOR = "var(--accent-ink)";

function loadRun(): Run | null {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const r = JSON.parse(raw) as Run;
    return r && r.v === 1 && typeof r.id === "string" ? r : null;
  } catch {
    return null;
  }
}
function saveRun(r: Run | null) {
  try {
    if (r) localStorage.setItem(STORE, JSON.stringify(r));
    else localStorage.removeItem(STORE);
  } catch {}
}

/** Focused milliseconds so far, excluding pauses. */
function focusedMs(r: Run, now: number) {
  const end = r.endedAt ?? r.pausedAt ?? now;
  return Math.max(0, end - r.startedAt - r.pausedMs);
}

const clockFmt = new Map<string, Intl.DateTimeFormat>();
/** unix ms -> "21:44" in the user's timezone */
function clockAt(ms: number, timezone: string) {
  let f = clockFmt.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    clockFmt.set(timezone, f);
  }
  return f.format(ms);
}

/** "21:44 → 22:29" (times in Geist Mono, the arrow in Geist so it keeps its size) */
function TimeRange({ from, to, timezone }: { from: number; to: number; timezone: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="mono">{clockAt(from, timezone)}</span>
      <span className="px-1.5 font-sans" aria-label="to">
        →
      </span>
      <span className="mono">{clockAt(to, timezone)}</span>
    </span>
  );
}

/** The bar's track sits on the page background here, so it needs a little more contrast than sunken. */
const TRACK = "[&>div:first-child]:bg-line-strong";

const pausesText = (n: number) => (n > 0 ? `, ${n} ${n === 1 ? "pause" : "pauses"}` : "");

export function FocusApp({
  options,
  initialKey,
  sessions,
  active,
  timezone,
}: {
  options: FocusOption[];
  initialKey: string | null;
  sessions: FocusSessionSummary[];
  active: ActiveRow | null;
  timezone: string;
}) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [run, setRunState] = useState<Run | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const audio = useRef<AudioContext | null>(null);

  const setRun = useCallback((r: Run | null) => {
    setRunState(r);
    saveRun(r);
  }, []);

  // Restore a session in progress: this device's copy if it matches the server, else the server row.
  useEffect(() => {
    const stored = loadRun();
    let next: Run | null = null;
    if (stored && active && stored.id === active.id) next = stored;
    else if (active)
      next = {
        v: 1,
        id: active.id,
        label: active.label,
        color: active.color,
        goalId: active.goalId,
        taskId: active.taskId,
        blockId: active.blockId,
        plannedMin: active.plannedMin,
        startedAt: active.startedAt,
        pausedAt: null,
        pausedMs: 0,
        pauses: 0,
        endedAt: null,
        completed: false,
      };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
    setRunState(next);
    saveRun(next);
    setHydrated(true);
    // only on mount: later server refreshes must not reset the running timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push("/app");
  };

  const ensureAudio = () => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!audio.current && Ctx) audio.current = new Ctx();
      void audio.current?.resume();
    } catch {}
  };

  if (!hydrated) return <div className="flex-1" />;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {result ? (
        <Screen key="result">
          <ResultView
            result={result}
            timezone={timezone}
            onClose={close}
            onAgain={() => {
              setResult(null);
              router.replace("/app/focus");
            }}
          />
        </Screen>
      ) : run && run.endedAt == null ? (
        <Screen key="running" wide>
          <RunningView run={run} setRun={setRun} onClose={close} audio={audio} ensureAudio={ensureAudio} timezone={timezone} />
        </Screen>
      ) : run ? (
        <Screen key="finish">
          <FinishView
            run={run}
            timezone={timezone}
            onSaved={(r) => {
              setRun(null);
              setResult(r);
            }}
            onDiscard={() => setRun(null)}
          />
        </Screen>
      ) : (
        <Screen key="setup">
          <SetupView
            options={options}
            initialKey={initialKey}
            todayMin={sessions.reduce((s, x) => s + x.focusedMin, 0)}
            todayCount={sessions.length}
            timezone={timezone}
            onClose={close}
            onStarted={(r) => {
              ensureAudio();
              setRun(r);
            }}
          />
        </Screen>
      )}
    </AnimatePresence>
  );
}

/** One step of the flow. Forms keep a phone-width column; the timer (`wide`) uses the whole screen. */
function Screen({ wide, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <motion.div
      className={cn("flex flex-1 flex-col", !wide && "mx-auto w-full max-w-[520px]")}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

function TopBar({ onClose, children }: { onClose?: () => void; children?: ReactNode }) {
  return (
    <div className="relative z-10 flex h-12 shrink-0 items-center justify-between">
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap -ml-2 grid size-11 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <X className="size-5" strokeWidth={2} />
        </button>
      ) : (
        <span />
      )}
      {children}
    </div>
  );
}

/** What the session is about: goal dot + title. */
function OnLabel({ label, color, className }: { label: string; color: string; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span className="size-2.5 shrink-0 rounded-full transition-colors duration-500" style={{ background: color }} />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** The big clock. Hours make it a little smaller. */
function Clock({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("focus-clock inline-block text-ink", className)} data-long={value.length > 5 || undefined} role="timer" aria-label={value}>
      {value}
    </span>
  );
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 flex items-start gap-2 text-[13.5px] leading-snug font-medium text-warn" role="alert">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// ─────────────────────────── Setup ───────────────────────────

const clampMin = (m: number) => Math.max(FOCUS_MIN, Math.min(FOCUS_MAX, m));

/** The block running now, else one starting within the hour. */
function blockForNow(options: FocusOption[], timezone: string): FocusOption | null {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(Date.now());
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const nowMin = num("hour") * 60 + num("minute");
  return (
    options.find((o) => o.type === "block" && o.startMin != null && o.startMin + (o.minutes ?? 0) > nowMin && o.startMin - 60 <= nowMin) ?? null
  );
}

function SetupView({
  options,
  initialKey,
  todayMin,
  todayCount,
  timezone,
  onClose,
  onStarted,
}: {
  options: FocusOption[];
  initialKey: string | null;
  todayMin: number;
  todayCount: number;
  timezone: string;
  onClose: () => void;
  onStarted: (r: Run) => void;
}) {
  // nothing asked for: start from the block planned for now, or the next one
  const [initial] = useState(() => options.find((o) => o.key === initialKey) ?? blockForNow(options, timezone));
  const [selected, setSelected] = useState<string | null>(initial?.key ?? null);
  const [custom, setCustom] = useState("");
  const [minutes, setMinutes] = useState(initial?.minutes ? clampMin(initial.minutes) : 50);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const chosen = options.find((o) => o.key === selected) ?? null;
  const label = chosen?.label ?? custom.trim();
  const color = chosen?.color ? colorVar(chosen.color) : "var(--accent)";

  const pick = (o: FocusOption) => {
    setSelected(o.key);
    setCustom("");
    if (o.minutes && o.type !== "goal") setMinutes(clampMin(Math.round(o.minutes / 5) * 5));
    setPicking(false);
  };

  const begin = () => {
    if (!label) return setPicking(true);
    setError(null);
    start(async () => {
      try {
        const res = await startFocus({
          label,
          plannedMin: minutes,
          goalId: chosen?.goalId ?? null,
          taskId: chosen?.taskId ?? null,
          blockId: chosen?.blockId ?? null,
        });
        onStarted({
          v: 1,
          id: res.id,
          label,
          color: chosen?.color ?? null,
          goalId: res.goalId,
          taskId: res.taskId,
          blockId: res.blockId,
          plannedMin: res.plannedMin,
          startedAt: res.startedAt,
          pausedAt: null,
          pausedMs: 0,
          pauses: 0,
          endedAt: null,
          completed: false,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start");
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <TopBar onClose={onClose}>
        {todayCount > 0 && (
          <span className="tnum text-[13px] text-ink-3">
            {formatDuration(todayMin)} today, {todayCount} {todayCount === 1 ? "session" : "sessions"}
          </span>
        )}
      </TopBar>

      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="tap inline-flex h-11 max-w-full items-center gap-2 rounded-full px-4 hover:bg-sunken"
        >
          {label ? (
            <OnLabel label={label} color={color} className="text-[17px] font-semibold tracking-[-0.01em] text-ink" />
          ) : (
            <span className="text-[16px] font-medium text-ink-2">Choose what to focus on</span>
          )}
          <ChevronDown className="size-4 shrink-0 text-ink-3" />
        </button>

        <Clock value={formatClock(minutes * 60)} className="mt-5" />

        <div className="mt-8 w-full max-w-[340px]">
          <LinearProgress value={0} color={color} className={TRACK} />
          <p className="mt-3 text-[13px] text-ink-3">
            <TimeRange from={now} to={now + minutes * 60_000} timezone={timezone} />
          </p>
        </div>

        <div className="mt-8 flex items-center gap-1" role="group" aria-label="Length">
          <StepButton label="5 minutes less" onClick={() => setMinutes((m) => clampMin(m - 5))} disabled={minutes <= FOCUS_MIN}>
            <Minus className="size-4" />
          </StepButton>
          {FOCUS_PRESETS.map((p) => {
            const on = minutes === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setMinutes(p)}
                aria-pressed={on}
                className={cn(
                  "tap tnum relative h-11 min-w-[64px] rounded-full px-3 text-[14px] font-medium transition-colors",
                  on ? "text-bg" : "text-ink-2 hover:text-ink",
                )}
              >
                {on && <motion.span layoutId="focus-preset" className="absolute inset-0 rounded-full bg-ink" transition={springs.snappy} />}
                <span className="relative">{p} min</span>
              </button>
            );
          })}
          <StepButton label="5 minutes more" onClick={() => setMinutes((m) => clampMin(m + 5))} disabled={minutes >= FOCUS_MAX}>
            <Plus className="size-4" />
          </StepButton>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[400px] pt-2 pb-1">
        {error && <ErrorLine>{error}</ErrorLine>}
        <Button variant="accent" size="lg" className="h-14 rounded-[14px] text-[16px]" loading={pending} onClick={begin}>
          <Play className="size-4 fill-current" />
          Start {formatDuration(minutes)}
        </Button>
      </div>

      <FocusPicker
        open={picking}
        onClose={() => setPicking(false)}
        options={options}
        selected={selected}
        custom={custom}
        onPick={pick}
        onCustom={(text) => {
          setCustom(text);
          setSelected(null);
          setPicking(false);
        }}
      />
    </div>
  );
}

function StepButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="tap grid size-11 place-items-center rounded-full border border-line-strong text-ink-2 hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Blocks planned today, tasks due, goals, or something typed. */
function FocusPicker({
  open,
  onClose,
  options,
  selected,
  custom,
  onPick,
  onCustom,
}: {
  open: boolean;
  onClose: () => void;
  options: FocusOption[];
  selected: string | null;
  custom: string;
  onPick: (o: FocusOption) => void;
  onCustom: (text: string) => void;
}) {
  const [text, setText] = useState(custom);
  const blocks = options.filter((o) => o.type === "block");
  const tasks = options.filter((o) => o.type === "task");
  const goals = options.filter((o) => o.type === "goal");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) onCustom(text.trim());
  };

  return (
    <Sheet open={open} onClose={onClose} title="Focus on" tall={options.length > 6}>
      {blocks.length > 0 && (
        <Section title="Planned today" card>
          {blocks.map((o) => (
            <OptionRow
              key={o.key}
              option={o}
              selected={selected === o.key}
              onPick={() => onPick(o)}
              meta={`${formatMin(o.startMin ?? 0, true)} · ${formatDuration(o.minutes ?? 0)}`}
            />
          ))}
        </Section>
      )}
      {tasks.length > 0 && (
        <Section title="Due today" card>
          {tasks.map((o) => (
            <OptionRow key={o.key} option={o} selected={selected === o.key} onPick={() => onPick(o)} meta={o.minutes ? formatDuration(o.minutes) : undefined} />
          ))}
        </Section>
      )}
      {goals.length > 0 && (
        <Section title="Goals">
          <div className="flex flex-wrap gap-2">
            {goals.map((o) => {
              const on = selected === o.key;
              const c = o.color ? colorVar(o.color) : "var(--ink-3)";
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => onPick(o)}
                  aria-pressed={on}
                  className={cn(
                    "tap inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors",
                    on ? "border-transparent bg-ink text-bg" : "border-line-strong bg-surface text-ink-2",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ background: c }} />
                  {o.label}
                </button>
              );
            })}
          </div>
        </Section>
      )}
      <Section title={options.length ? "Something else" : "What are you working on?"}>
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Read chapter 3"
            maxLength={120}
            enterKeyHint="done"
            autoFocus={options.length === 0}
            aria-label="Something else"
          />
          <Button type="submit" variant="secondary" className="h-[46px]" disabled={!text.trim()}>
            Use
          </Button>
        </form>
      </Section>
    </Sheet>
  );
}

function OptionRow({ option, selected, onPick, meta }: { option: FocusOption; selected: boolean; onPick: () => void; meta?: string }) {
  const c = option.color ? colorVar(option.color) : "var(--ink-3)";
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className="tap-row flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left"
    >
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: c }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{option.label}</span>
        {meta && <span className="tnum block text-[12.5px] text-ink-3">{meta}</span>}
      </span>
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border-[1.75px] transition-colors",
          selected ? "border-transparent bg-accent" : "border-line-strong",
        )}
      >
        {selected && <Check className="size-3.5 text-accent-ink" strokeWidth={3} />}
      </span>
    </button>
  );
}

// ─────────────────────────── Running ───────────────────────────

function chime(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    void ctx.resume();
    const t0 = ctx.currentTime + 0.05;
    [523.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const t = t0 + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16 - i * 0.03, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 2.5);
    });
  } catch {}
}

function RunningView({
  run,
  setRun,
  onClose,
  audio,
  ensureAudio,
  timezone,
}: {
  run: Run;
  setRun: (r: Run | null) => void;
  onClose: () => void;
  audio: React.RefObject<AudioContext | null>;
  ensureAudio: () => void;
  timezone: string;
}) {
  // the shared one-second clock that also drives the Countdown and the bar
  const now = useNow();
  const paused = run.pausedAt != null;
  const plannedMs = run.plannedMin * 60_000;
  const remaining = now ? Math.max(0, plannedMs - focusedMs(run, now)) : plannedMs;
  // while running, focus started (pauses excluded) at `from` and ends at `to`
  const from = run.startedAt + run.pausedMs;
  const to = from + plannedMs;
  const goal = run.color ? colorVar(run.color) : "var(--accent)";

  // time is up
  useEffect(() => {
    if (!now || paused || remaining > 0) return;
    const endedAt = run.startedAt + run.pausedMs + plannedMs;
    // only chime when it ends while the screen is open, not when reopening hours later
    if (Date.now() - endedAt < 10_000) {
      chime(audio.current);
      try {
        navigator.vibrate?.([180, 90, 180]);
      } catch {}
    }
    setRun({ ...run, endedAt, completed: true });
  }, [now, remaining, paused, run, plannedMs, setRun, audio]);

  // keep the screen awake while running
  useEffect(() => {
    if (paused || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) void l.release();
        else lock = l;
      } catch {}
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, [paused]);

  // remaining time in the tab title
  const clock = formatClock(remaining / 1000);
  useEffect(() => {
    document.title = `${paused ? "Paused" : clock} · ${run.label}`;
  }, [clock, paused, run.label]);
  useEffect(
    () => () => {
      document.title = "Focus · Timeo";
    },
    [],
  );

  const toggle = () => {
    ensureAudio();
    const t = Date.now();
    if (paused) setRun({ ...run, pausedAt: null, pausedMs: run.pausedMs + (t - run.pausedAt!) });
    else setRun({ ...run, pausedAt: t, pauses: run.pauses + 1 });
  };
  const extend = () => setRun({ ...run, plannedMin: Math.min(FOCUS_MAX + 120, run.plannedMin + 5) });
  const end = () => {
    const t = Date.now();
    const pausedMs = run.pausedAt != null ? run.pausedMs + (t - run.pausedAt) : run.pausedMs;
    setRun({ ...run, pausedAt: null, pausedMs, endedAt: t, completed: false });
  };

  useHotkeys([
    { hotkey: appHotkeys["focus.toggle"], callback: toggle },
    { hotkey: appHotkeys["focus.extend"], callback: extend },
  ]);

  const endsAt = paused ? (now || run.pausedAt!) + remaining : to;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar onClose={onClose}>
        <span className="flex h-8 items-center gap-2 text-[13px] font-medium text-ink-3" aria-live="polite">
          <span className={cn("size-1.5 rounded-full transition-colors", paused ? "bg-ink-3" : "bg-accent")} />
          {paused ? "Paused" : "Focusing"}
        </span>
      </TopBar>

      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        <OnLabel label={run.label} color={goal} className="max-w-[min(30rem,100%)] text-[17px] font-semibold tracking-[-0.01em] text-ink" />

        <div className="mt-5">
          {paused ? (
            <Clock value={clock} className="focus-breathe text-ink-2" />
          ) : (
            <span className="focus-clock inline-block text-ink" data-long={clock.length > 5 || undefined}>
              <Countdown to={to} roll={false} className="tracking-[-0.05em]" />
            </span>
          )}
        </div>

        <div className="mt-8 w-full max-w-[360px]">
          {paused ? (
            <LinearProgress value={1 - remaining / plannedMs} color="var(--ink-3)" className={TRACK} />
          ) : (
            <LinearProgress startAt={from} endAt={to} color={goal} className={TRACK} />
          )}
          <p className="mt-3 text-[13px] text-ink-3">
            <TimeRange from={run.startedAt} to={endsAt} timezone={timezone} />
            {pausesText(run.pauses)}
          </p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[22rem] grid-cols-3 items-center pb-2">
        <QuietAction label="+5 min" onClick={extend}>
          <Plus className="size-[18px]" />
        </QuietAction>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={toggle}
            aria-label={paused ? "Resume" : "Pause"}
            className={cn(
              "tap grid size-20 place-items-center rounded-full transition-colors duration-300",
              paused ? "bg-accent text-accent-ink" : "bg-ink text-bg",
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={paused ? "play" : "pause"}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                {paused ? <Play className="ml-1 size-7 fill-current" /> : <Pause className="size-7 fill-current" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
        <QuietAction label="End" onClick={end}>
          <Square className="size-3.5 fill-current" />
        </QuietAction>
      </div>
    </div>
  );
}

function QuietAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="tap mx-auto flex flex-col items-center gap-1.5 rounded-2xl px-3 py-1.5 text-ink-3 hover:text-ink">
      <span className="grid size-11 place-items-center rounded-full border border-line-strong text-ink-2">{children}</span>
      <span className="text-[12px] font-medium">{label}</span>
    </button>
  );
}

// ─────────────────────────── Finish ───────────────────────────

function FinishView({
  run,
  timezone,
  onSaved,
  onDiscard,
}: {
  run: Run;
  timezone: string;
  onSaved: (r: Result) => void;
  onDiscard: () => void;
}) {
  const focusedMin = Math.round(focusedMs(run, run.endedAt ?? run.startedAt) / 60_000);
  const [rating, setRating] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [blockers, setBlockers] = useState("");
  const [notes, setNotes] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [markDone, setMarkDone] = useState(!!run.blockId && focusedMin >= run.plannedMin * 0.6);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const color = run.color ? colorVar(run.color) : "var(--accent)";
  const preview = focusQuality({ focusedMin, plannedMin: run.plannedMin, rating, pauses: run.pauses });

  const save = () =>
    start(async () => {
      setError(null);
      try {
        const res = await finishFocus({
          id: run.id,
          endedAt: run.endedAt ?? Date.now(),
          plannedMin: run.plannedMin,
          focusedMin,
          pauses: run.pauses,
          rating,
          energy,
          blockers,
          notes,
          markBlockDone: markDone,
        });
        onSaved({ ...res, label: run.label, color: run.color });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });

  const discard = () =>
    start(async () => {
      try {
        await discardFocus(run.id);
      } catch {}
      onDiscard();
    });

  return (
    <div className="flex flex-1 flex-col">
      <TopBar />

      <header className="flex flex-col items-center pt-2 text-center">
        <Completion />
        <h1 className="display mt-5 text-[26px] text-ink">{run.completed ? "Time’s up" : "Session ended"}</h1>
        <OnLabel label={run.label} color={color} className="mt-2 max-w-full text-[15px] font-medium text-ink-2" />
        <p className="mt-1.5 text-[13.5px] text-ink-3">
          <span className="tnum">
            {formatDuration(focusedMin)} of {formatDuration(run.plannedMin)}
          </span>
          {" · "}
          <TimeRange from={run.startedAt} to={run.endedAt ?? run.startedAt} timezone={timezone} />
          {pausesText(run.pauses)}
        </p>
      </header>

      <Section title="How focused were you?" className="mt-8!">
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = rating === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-pressed={on}
                aria-label={`${n}: ${RATING_LABELS[n - 1]}`}
                className={cn(
                  "tap tnum h-12 rounded-[12px] border text-[17px] font-semibold transition-colors",
                  on ? "border-transparent bg-ink text-bg" : "border-line-strong bg-surface text-ink-2",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between px-1 text-[12px] text-ink-3">
          <span>{RATING_LABELS[0]}</span>
          <span className="font-medium text-ink-2">{rating ? RATING_LABELS[rating - 1] : ""}</span>
          <span>{RATING_LABELS[4]}</span>
        </div>
      </Section>

      <Section title="Energy now">
        <Segmented
          size="sm"
          className="[&>button]:h-10 [&>button]:text-[12px]"
          value={energy == null ? "" : String(energy)}
          onChange={(v) => setEnergy(v === String(energy) ? null : Number(v))}
          options={ENERGY_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
        />
      </Section>

      <div className="card mt-5 overflow-hidden">
        {run.blockId && (
          <button
            type="button"
            onClick={() => setMarkDone(!markDone)}
            aria-pressed={markDone}
            className="tap-row flex min-h-[52px] w-full items-center gap-3 border-b border-line px-4 text-left"
          >
            <span
              className={cn("grid size-6 place-items-center rounded-full border-[1.75px] transition-colors", markDone ? "border-transparent" : "border-line-strong")}
              style={markDone ? { background: color } : undefined}
            >
              {markDone && <Check className="size-3.5" style={{ color: ON_COLOR }} strokeWidth={3} />}
            </span>
            <span className="text-[15px] font-medium text-ink">Mark block done</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setNoteOpen(!noteOpen)}
          aria-expanded={noteOpen}
          className="tap-row flex min-h-[52px] w-full items-center gap-3 px-4 text-left"
        >
          <span className="flex-1 text-[15px] font-medium text-ink">Add a note</span>
          <span className="text-[13px] text-ink-3">{blockers || notes ? "Added" : "Optional"}</span>
          <ChevronDown className={cn("size-4 text-ink-3 transition-transform", noteOpen && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {noteOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={springs.smooth}
              className="overflow-hidden"
            >
              <div className="space-y-2 px-3 pb-3">
                <Input value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="What got in the way?" maxLength={300} />
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes" maxLength={1000} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-auto pt-8">
        {error && <ErrorLine>{error}</ErrorLine>}
        <Button
          size="lg"
          className="h-14 rounded-[14px] text-[16px]"
          variant={rating == null ? "secondary" : "accent"}
          disabled={rating == null}
          loading={pending}
          onClick={save}
        >
          {rating == null ? "Rate your focus to save" : `Save · ${preview}% quality`}
        </Button>
        <button
          type="button"
          onClick={discard}
          disabled={pending}
          className="tap mx-auto mt-1 flex h-11 items-center px-4 text-[14px] font-medium text-ink-3 hover:text-ink-2"
        >
          Discard session
        </button>
      </div>
    </div>
  );
}

/** The gentle end: a check draws in. */
function Completion() {
  return (
    <motion.div
      className="grid size-16 place-items-center rounded-full bg-accent-soft"
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springs.gentle}
    >
      <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="var(--accent)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.45, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
  );
}

// ─────────────────────────── Result ───────────────────────────

function ResultView({
  result,
  timezone,
  onClose,
  onAgain,
}: {
  result: Result;
  timezone: string;
  onClose: () => void;
  onAgain: () => void;
}) {
  const color = result.color ? colorVar(result.color) : "var(--accent)";
  const total = result.sessions.reduce((s, x) => s + x.focusedMin, 0);

  return (
    <div className="flex flex-1 flex-col">
      <TopBar onClose={onClose} />

      <div className="flex flex-col items-center pt-4 text-center">
        <div className="eyebrow">Focus quality</div>
        <div className="display tnum-live mt-2 text-[72px] leading-none text-ink">
          <CountUp value={result.quality} />
          <span className="text-[32px] text-ink-3">%</span>
        </div>
        <h1 className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-ink">{qualityLabel(result.quality)}</h1>
        <OnLabel
          label={`${formatDuration(result.focusedMin)} on ${result.label}`}
          color={color}
          className="tnum mt-1.5 max-w-full text-[14.5px] text-ink-2"
        />
        <LinearProgress value={result.quality / 100} color={color} className={cn(TRACK, "mt-6 w-full max-w-[320px]")} />
      </div>

      <StatStrip card className="mt-8">
        <Stat value={formatDuration(total)} label="focused today" />
        <Stat value={result.sessions.length} label={result.sessions.length === 1 ? "session" : "sessions"} />
      </StatStrip>

      {result.sessions.length > 0 && (
        <Section title="Today" card>
          {result.sessions.map((s) => (
            <div key={s.id} className="flex min-h-[48px] items-center gap-3 px-4 py-2.5">
              <span className="mono w-[44px] shrink-0 text-[12.5px] text-ink-3">{clockAt(s.startedAt, timezone)}</span>
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color ? colorVar(s.color) : "var(--ink-3)" }} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{s.label}</span>
              <span className="tnum shrink-0 text-[13px] text-ink-2">{formatDuration(s.focusedMin)}</span>
              {s.quality != null && (
                <span className="tnum w-11 shrink-0 rounded-full bg-sunken py-0.5 text-center text-[12px] font-semibold text-ink-2">{s.quality}%</span>
              )}
            </div>
          ))}
        </Section>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2.5 pt-8">
        <Button variant="secondary" size="lg" onClick={onAgain}>
          Another session
        </Button>
        <Button variant="accent" size="lg" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
