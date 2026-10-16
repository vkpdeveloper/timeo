"use client";

import { Check, Pause, Play, Plus, Square, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Stepper, Textarea } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { colorVar } from "@/lib/colors";
import { formatDuration, formatMin } from "@/lib/dates";
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
    else router.push("/");
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
              router.replace("/focus");
            }}
          />
        </Screen>
      ) : run && run.endedAt == null ? (
        <Screen key="running">
          <RunningView run={run} setRun={setRun} onClose={close} audio={audio} ensureAudio={ensureAudio} />
        </Screen>
      ) : run ? (
        <Screen key="finish">
          <FinishView
            run={run}
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

function Screen({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

function TopBar({ onClose, children }: { onClose?: () => void; children?: ReactNode }) {
  return (
    <div className="flex h-12 items-center justify-between">
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap -ml-1 grid size-10 place-items-center rounded-full bg-sunken text-ink-2"
        >
          <X className="size-[18px]" strokeWidth={2.2} />
        </button>
      ) : (
        <span />
      )}
      {children}
    </div>
  );
}

// ─────────────────────────── Setup ───────────────────────────

function SetupView({
  options,
  initialKey,
  todayMin,
  todayCount,
  onClose,
  onStarted,
}: {
  options: FocusOption[];
  initialKey: string | null;
  todayMin: number;
  todayCount: number;
  onClose: () => void;
  onStarted: (r: Run) => void;
}) {
  const initial = options.find((o) => o.key === initialKey) ?? null;
  const initialMinutes = initial?.minutes ? Math.max(FOCUS_MIN, Math.min(FOCUS_MAX, initial.minutes)) : 50;
  const [selected, setSelected] = useState<string | null>(initialKey);
  const [custom, setCustom] = useState("");
  const [minutes, setMinutes] = useState(initialMinutes);
  const [customDuration, setCustomDuration] = useState(!(FOCUS_PRESETS as readonly number[]).includes(initialMinutes));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const blocks = options.filter((o) => o.type === "block");
  const tasks = options.filter((o) => o.type === "task");
  const goals = options.filter((o) => o.type === "goal");
  const chosen = options.find((o) => o.key === selected) ?? null;
  const label = chosen?.label ?? custom.trim();
  const color = chosen?.color ?? null;

  const pick = (o: FocusOption) => {
    setSelected(o.key === selected ? null : o.key);
    if (o.key !== selected && o.minutes && o.type !== "goal") {
      const m = Math.max(FOCUS_MIN, Math.min(FOCUS_MAX, Math.round(o.minutes / 5) * 5));
      setMinutes(m);
      setCustomDuration(!(FOCUS_PRESETS as readonly number[]).includes(m));
    }
  };

  const begin = () => {
    if (!label) return;
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
          color,
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
    <>
      <TopBar onClose={onClose}>
        {todayCount > 0 && (
          <span className="tnum text-[13px] text-ink-3">
            Today {formatDuration(todayMin)} · {todayCount} {todayCount === 1 ? "session" : "sessions"}
          </span>
        )}
      </TopBar>

      <header className="pt-6 pb-2">
        <h1 className="display text-[48px] text-ink">Focus</h1>
        <p className="mt-1.5 text-[15px] text-ink-2">One thing, full attention.</p>
      </header>

      <div className="flex-1 pb-6">
        {blocks.length > 0 && (
          <OptionGroup title="Planned today">
            {blocks.map((o) => (
              <OptionRow
                key={o.key}
                option={o}
                selected={selected === o.key}
                onPick={() => pick(o)}
                meta={`${formatMin(o.startMin ?? 0, true)} · ${formatDuration(o.minutes ?? 0)}`}
              />
            ))}
          </OptionGroup>
        )}
        {tasks.length > 0 && (
          <OptionGroup title="Due today">
            {tasks.map((o) => (
              <OptionRow
                key={o.key}
                option={o}
                selected={selected === o.key}
                onPick={() => pick(o)}
                meta={o.minutes ? formatDuration(o.minutes) : undefined}
              />
            ))}
          </OptionGroup>
        )}
        {goals.length > 0 && (
          <section className="mt-7">
            <h2 className="eyebrow mb-2.5 px-1">Goals</h2>
            <div className="flex flex-wrap gap-2">
              {goals.map((o) => {
                const active = selected === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => pick(o)}
                    className={cn(
                      "tap inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors",
                      active ? "border-transparent text-bg" : "border-line bg-surface text-ink-2",
                    )}
                    style={active ? { background: o.color ? colorVar(o.color) : "var(--ink)" } : undefined}
                  >
                    {!active && <span className="size-2 rounded-full" style={{ background: o.color ? colorVar(o.color) : "var(--ink-3)" }} />}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <section className="mt-7">
          <h2 className="eyebrow mb-2.5 px-1">{options.length ? "Something else" : "What are you working on?"}</h2>
          <Input
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              if (e.target.value.trim()) setSelected(null);
            }}
            placeholder="e.g. Read chapter 3"
            maxLength={120}
            className={cn(!chosen && custom.trim() && "border-ink-3")}
          />
        </section>

        <section className="mt-7">
          <h2 className="eyebrow mb-2.5 px-1">Duration</h2>
          <div className="grid grid-cols-4 gap-2">
            {FOCUS_PRESETS.map((p) => {
              const active = !customDuration && minutes === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setMinutes(p);
                    setCustomDuration(false);
                  }}
                  className={cn(
                    "tap h-14 rounded-2xl border text-center transition-colors",
                    active ? "border-transparent bg-ink text-bg" : "border-line bg-surface text-ink",
                  )}
                >
                  <span className="tnum block text-[18px] leading-none font-semibold">{p}</span>
                  <span className={cn("mt-1 block text-[11px]", active ? "text-bg/70" : "text-ink-3")}>min</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustomDuration(true)}
              className={cn(
                "tap h-14 rounded-2xl border text-[14px] font-semibold transition-colors",
                customDuration ? "border-transparent bg-ink text-bg" : "border-line bg-surface text-ink-2",
              )}
            >
              Custom
            </button>
          </div>
          <AnimatePresence initial={false}>
            {customDuration && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Stepper
                  className="mt-2.5"
                  value={minutes}
                  onChange={setMinutes}
                  step={5}
                  min={FOCUS_MIN}
                  max={FOCUS_MAX}
                  format={(v) => `${formatDuration(v)}`}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <div className="sticky bottom-0 -mx-5 mt-auto bg-gradient-to-t from-bg via-bg to-transparent px-5 pt-6 pb-1">
        {error && <p className="mb-3 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{error}</p>}
        <Button
          size="lg"
          className="h-14 text-[16px]"
          disabled={!label}
          loading={pending}
          onClick={begin}
          style={label && color ? { background: colorVar(color), color: "#0a0a0b" } : undefined}
        >
          <Play className="size-4 fill-current" />
          {label ? `Start ${formatDuration(minutes)}` : "Pick something to focus on"}
        </Button>
      </div>
    </>
  );
}

function OptionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="eyebrow mb-2.5 px-1">{title}</h2>
      <div className="card overflow-hidden">{children}</div>
    </section>
  );
}

function OptionRow({ option, selected, onPick, meta }: { option: FocusOption; selected: boolean; onPick: () => void; meta?: string }) {
  const c = option.color ? colorVar(option.color) : "var(--ink-3)";
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className="tap flex w-full items-center gap-3 px-4 py-3 text-left [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line"
    >
      <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: c }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{option.label}</span>
        {meta && <span className="tnum block text-[12.5px] text-ink-3">{meta}</span>}
      </span>
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border-[1.75px] transition-colors",
          selected ? "border-transparent" : "border-line-strong",
        )}
        style={selected ? { background: c } : undefined}
      >
        {selected && <Check className="size-3.5 text-bg" strokeWidth={3} />}
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
}: {
  run: Run;
  setRun: (r: Run | null) => void;
  onClose: () => void;
  audio: React.RefObject<AudioContext | null>;
  ensureAudio: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const paused = run.pausedAt != null;
  const plannedMs = run.plannedMin * 60_000;
  const elapsed = focusedMs(run, now);
  const remaining = Math.max(0, plannedMs - elapsed);
  const progress = Math.min(1, elapsed / plannedMs);
  const color = run.color ? colorVar(run.color) : "var(--accent)";

  // tick
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [paused]);

  // time is up
  useEffect(() => {
    if (paused || remaining > 0) return;
    const endedAt = run.startedAt + run.pausedMs + plannedMs;
    // only chime when it ends while the screen is open, not when reopening hours later
    if (Date.now() - endedAt < 10_000) {
      chime(audio.current);
      try {
        navigator.vibrate?.([180, 90, 180]);
      } catch {}
    }
    setRun({ ...run, endedAt, completed: true });
  }, [remaining, paused, run, plannedMs, setRun, audio]);

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
    setNow(t);
  };
  const extend = () => setRun({ ...run, plannedMin: Math.min(FOCUS_MAX + 120, run.plannedMin + 5) });
  const end = () => {
    const t = Date.now();
    const pausedMs = run.pausedAt != null ? run.pausedMs + (t - run.pausedAt) : run.pausedMs;
    setRun({ ...run, pausedAt: null, pausedMs, endedAt: t, completed: false });
  };

  const size = 300;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative flex flex-1 flex-col" style={{ ["--glow" as string]: color }}>
      <div className="focus-glow pointer-events-none fixed inset-0" aria-hidden />
      <TopBar onClose={onClose}>
        <span className="text-[13px] font-medium text-ink-3">{paused ? "Paused" : "Focusing"}</span>
      </TopBar>

      <div className="relative flex flex-1 flex-col items-center justify-center py-6">
        <div className="relative" style={{ width: "min(78vw, 300px)", aspectRatio: "1" }}>
          <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c * progress} ${c}`}
              style={{ transition: "stroke-dasharray 400ms linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              className="display tnum text-[clamp(64px,22vw,88px)] leading-none text-ink"
              animate={{ opacity: paused ? [1, 0.35, 1] : 1 }}
              transition={paused ? { duration: 2.4, repeat: Infinity } : { duration: 0.2 }}
            >
              {clock}
            </motion.div>
            <div className="tnum mt-3 text-[13px] text-ink-3">
              of {formatDuration(run.plannedMin)}
              {run.pauses > 0 && ` · ${run.pauses} ${run.pauses === 1 ? "pause" : "pauses"}`}
            </div>
          </div>
        </div>

        <div className="mt-10 flex max-w-full items-center gap-2.5 px-4">
          <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate text-[17px] font-semibold tracking-tight text-ink">{run.label}</span>
        </div>
      </div>

      <div className="relative grid grid-cols-3 items-end pb-4">
        <RoundAction label="+5 min" onClick={extend}>
          <Plus className="size-5" />
        </RoundAction>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={paused ? "Resume" : "Pause"}
            className="tap grid size-[76px] place-items-center rounded-full bg-ink text-bg shadow-float"
          >
            {paused ? <Play className="ml-1 size-7 fill-current" /> : <Pause className="size-7 fill-current" />}
          </button>
          <span className="text-[12px] font-medium text-ink-2">{paused ? "Resume" : "Pause"}</span>
        </div>
        <RoundAction label="End" onClick={end}>
          <Square className="size-4 fill-current" />
        </RoundAction>
      </div>
    </div>
  );
}

function RoundAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="tap grid size-14 place-items-center rounded-full border border-line bg-surface/80 text-ink backdrop-blur"
      >
        {children}
      </button>
      <span className="text-[12px] font-medium text-ink-3">{label}</span>
    </div>
  );
}

// ─────────────────────────── Finish ───────────────────────────

function FinishView({
  run,
  onSaved,
  onDiscard,
}: {
  run: Run;
  onSaved: (r: Result) => void;
  onDiscard: () => void;
}) {
  const focusedMin = Math.round(focusedMs(run, run.endedAt ?? run.startedAt) / 60_000);
  const [rating, setRating] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [blockers, setBlockers] = useState("");
  const [notes, setNotes] = useState("");
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
    <>
      <TopBar />
      <header className="pt-4">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink-3">
          <span className="size-2 rounded-full" style={{ background: color }} />
          <span className="truncate">{run.label}</span>
        </div>
        <h1 className="display mt-2 text-[44px] text-ink">{run.completed ? "Time’s up" : "Session ended"}</h1>
        <p className="tnum mt-2 text-[15px] text-ink-2">
          {formatDuration(focusedMin)} focused of {formatDuration(run.plannedMin)}
          {run.pauses > 0 ? ` · ${run.pauses} ${run.pauses === 1 ? "pause" : "pauses"}` : " · no pauses"}
        </p>
      </header>

      <section className="mt-9">
        <h2 className="mb-3 px-1 text-[15px] font-semibold tracking-tight text-ink">How focused were you?</h2>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = rating === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-pressed={active}
                aria-label={`${n}: ${RATING_LABELS[n - 1]}`}
                className={cn(
                  "tap tnum h-14 rounded-2xl border text-[20px] font-semibold transition-colors",
                  active ? "border-transparent text-[#0a0a0b]" : "border-line bg-surface text-ink-2",
                )}
                style={active ? { background: color } : undefined}
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
      </section>

      <section className="mt-8">
        <h2 className="mb-3 px-1 text-[15px] font-semibold tracking-tight text-ink">Energy now</h2>
        <div className="grid grid-cols-5 gap-1.5 rounded-2xl bg-sunken p-1">
          {ENERGY_OPTIONS.map((o) => {
            const active = energy === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setEnergy(active ? null : o.value)}
                aria-pressed={active}
                className={cn(
                  "tap h-11 rounded-xl text-[12px] font-semibold transition-colors",
                  active ? "bg-surface-2 text-ink shadow-[0_1px_3px_rgb(0_0_0/0.4)]" : "text-ink-3",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8 space-y-2.5">
        <Input value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="What got in the way? (optional)" maxLength={300} />
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes (optional)" maxLength={1000} />
      </section>

      {run.blockId && (
        <button
          type="button"
          onClick={() => setMarkDone(!markDone)}
          aria-pressed={markDone}
          className="tap mt-4 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left"
        >
          <span
            className={cn("grid size-6 place-items-center rounded-full border-[1.75px]", markDone ? "border-transparent" : "border-line-strong")}
            style={markDone ? { background: color } : undefined}
          >
            {markDone && <Check className="size-3.5 text-[#0a0a0b]" strokeWidth={3} />}
          </span>
          <span className="text-[15px] font-medium text-ink">Mark block done</span>
        </button>
      )}

      <div className="mt-auto pt-8">
        {error && <p className="mb-3 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{error}</p>}
        <Button size="lg" className="h-14 text-[16px]" disabled={rating == null} loading={pending} onClick={save}>
          {rating == null ? "Rate your focus to save" : `Save · ${preview}% quality`}
        </Button>
        <button
          type="button"
          onClick={discard}
          disabled={pending}
          className="tap mx-auto mt-2 flex h-11 items-center px-4 text-[14px] font-medium text-ink-3"
        >
          Discard session
        </button>
      </div>
    </>
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
  const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(result.quality));
    return () => cancelAnimationFrame(id);
  }, [result.quality]);

  const size = 200;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative flex flex-1 flex-col" style={{ ["--glow" as string]: color }}>
      <div className="focus-glow pointer-events-none fixed inset-0 opacity-60" aria-hidden />
      <TopBar onClose={onClose} />

      <div className="relative flex flex-col items-center pt-6 text-center">
        <div className="relative size-[200px]">
          <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${(c * shown) / 100} ${c}`}
              style={{ transition: "stroke-dasharray 1200ms cubic-bezier(0.32,0.72,0,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="display tnum text-[64px] leading-none text-ink">
              {result.quality}
              <span className="text-[32px] text-ink-2">%</span>
            </div>
            <div className="mt-1.5 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Focus quality</div>
          </div>
        </div>
        <h1 className="mt-6 text-[22px] font-semibold tracking-tight text-ink">{qualityLabel(result.quality)}</h1>
        <p className="tnum mt-1 text-[15px] text-ink-2">
          {formatDuration(result.focusedMin)} on {result.label}
        </p>
      </div>

      <div className="relative mt-9 grid grid-cols-2 gap-2.5">
        <div className="card px-4 py-3.5">
          <div className="text-[12px] font-medium text-ink-3">Focused today</div>
          <div className="tnum mt-0.5 text-[22px] font-semibold tracking-tight text-ink">{formatDuration(total)}</div>
        </div>
        <div className="card px-4 py-3.5">
          <div className="text-[12px] font-medium text-ink-3">Sessions</div>
          <div className="tnum mt-0.5 text-[22px] font-semibold tracking-tight text-ink">{result.sessions.length}</div>
        </div>
      </div>

      {result.sessions.length > 0 && (
        <section className="relative mt-6">
          <h2 className="eyebrow mb-2.5 px-1">Today</h2>
          <div className="card overflow-hidden">
            {result.sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
                <span className="tnum w-[62px] shrink-0 text-[12.5px] text-ink-3">{timeFmt.format(s.startedAt)}</span>
                <span className="size-2 shrink-0 rounded-full" style={{ background: s.color ? colorVar(s.color) : "var(--ink-3)" }} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{s.label}</span>
                <span className="tnum shrink-0 text-[13px] text-ink-2">{formatDuration(s.focusedMin)}</span>
                {s.quality != null && (
                  <span className="tnum w-11 shrink-0 rounded-full bg-sunken py-0.5 text-center text-[12px] font-semibold text-ink-2">
                    {s.quality}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="relative mt-auto grid grid-cols-2 gap-2.5 pt-8">
        <Button variant="secondary" size="lg" onClick={onAgain}>
          Another session
        </Button>
        <Button size="lg" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
