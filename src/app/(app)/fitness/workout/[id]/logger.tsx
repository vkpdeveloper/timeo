"use client";

import { ChevronLeft, Ellipsis, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle } from "@/components/ui/controls";
import { cn } from "@/lib/cn";
import { colorVar, tint } from "@/lib/colors";
import { formatLongDate } from "@/lib/dates";
import { repsLabel } from "@/lib/fitness-library";
import type { ExerciseHistory, PrevSet } from "@/lib/fitness";
import {
  basisLabel,
  epley,
  fmtRest,
  fmtSet,
  fmtVolume,
  type ExerciseOption,
} from "@/lib/fitness-math";
import { deleteSet, exerciseHistory, renameWorkout, saveSet, syncBlocks, type SetInput } from "./actions";
import { ExerciseMenu, ExercisePicker, FinishSheet, SetMenu, type PR } from "./sheets";
import { RestBar, useRestTimer } from "./rest";

export type Prescription = {
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  reps: string;
  provisional: boolean;
  notes: string | null;
  restSec: number;
};

type DbSet = {
  id: string;
  exerciseId: string;
  exerciseOrder: number;
  setIndex: number;
  warmup: boolean;
  reps: number | null;
  weightKg: number | null;
  note: string | null;
  done: boolean;
};

export type LSet = {
  id: string;
  warmup: boolean;
  weight: string;
  reps: string;
  note: string;
  done: boolean;
};
export type Block = { key: string; exerciseId: string; sets: LSet[] };

type LogInfo = {
  id: string;
  name: string;
  date: string;
  status: "in_progress" | "completed" | "skipped" | "unlogged";
  startedAt: number;
  endedAt: number | null;
  feeling: number | null;
  notes: string | null;
};

const uid = () => crypto.randomUUID();
const parseNum = (s: string) => {
  const n = Number(s.replace(",", ".").trim());
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};
const numStr = (n: number | null) => (n == null ? "" : String(n));

function toBlocks(sets: DbSet[]): Block[] {
  const blocks: Block[] = [];
  let lastOrder = -1;
  for (const s of sets) {
    if (s.exerciseOrder !== lastOrder || blocks[blocks.length - 1]?.exerciseId !== s.exerciseId) {
      blocks.push({ key: uid(), exerciseId: s.exerciseId, sets: [] });
      lastOrder = s.exerciseOrder;
    }
    blocks[blocks.length - 1].sets.push({
      id: s.id,
      warmup: s.warmup,
      weight: numStr(s.weightKg),
      reps: numStr(s.reps),
      note: s.note ?? "",
      done: s.done,
    });
  }
  return blocks;
}

/** The previous session's set that lines up with this one (warm-ups with warm-ups). */
function prevFor(block: Block, setIdx: number, last: PrevSet[] | undefined): PrevSet | null {
  if (!last?.length) return null;
  const set = block.sets[setIdx];
  const kind = (s: { warmup: boolean }) => s.warmup === set.warmup;
  const nth = block.sets.slice(0, setIdx).filter(kind).length;
  const pool = last.filter(kind);
  if (!pool.length) return null;
  return pool[Math.min(nth, pool.length - 1)];
}

function useElapsed(startedAt: number, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [running]);
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return { sec, label: h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}` };
}

export function Logger({
  log,
  color,
  initialSets,
  prescriptions,
  exercises: initialExercises,
  history: initialHistory,
}: {
  log: LogInfo;
  color: string;
  today: string;
  initialSets: DbSet[];
  prescriptions: Record<string, Prescription>;
  exercises: ExerciseOption[];
  history: Record<string, ExerciseHistory>;
}) {
  const editing = log.status !== "in_progress";
  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(initialSets));
  const [exercises, setExercises] = useState(initialExercises);
  const [history, setHistory] = useState(initialHistory);
  const [name, setName] = useState(log.name);
  const blocksRef = useRef(blocks);
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const elapsed = useElapsed(log.startedAt, !editing);
  const rest = useRestTimer(log.id);

  // ── persistence ──
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [saveError, setSaveError] = useState(false);
  const failed = useRef(new Set<string>());

  const update = useCallback((fn: (b: Block[]) => Block[]) => {
    const next = fn(blocksRef.current);
    blocksRef.current = next;
    setBlocks(next);
  }, []);

  const enqueue = useCallback((job: () => Promise<unknown>) => {
    queue.current = queue.current.then(async () => {
      try {
        await job();
        setSaveError(false);
      } catch {
        setSaveError(true);
        throw new Error("save failed");
      }
    }).catch(() => {});
  }, []);

  const persist = useCallback(
    (setId: string) => {
      const t = timers.current.get(setId);
      if (t) clearTimeout(t);
      timers.current.delete(setId);
      queue.current = queue.current
        .then(async () => {
          const bs = blocksRef.current;
          for (let bi = 0; bi < bs.length; bi++) {
            const si = bs[bi].sets.findIndex((s) => s.id === setId);
            if (si < 0) continue;
            const s = bs[bi].sets[si];
            const input: SetInput = {
              id: s.id,
              exerciseId: bs[bi].exerciseId,
              exerciseOrder: bi,
              setIndex: si,
              warmup: s.warmup,
              reps: parseNum(s.reps),
              weightKg: parseNum(s.weight),
              note: s.note || null,
              done: s.done,
            };
            try {
              await saveSet(log.id, input);
              failed.current.delete(setId);
              if (!failed.current.size) setSaveError(false);
            } catch {
              failed.current.add(setId);
              setSaveError(true);
            }
            return;
          }
        })
        .catch(() => {});
    },
    [log.id],
  );

  const schedule = useCallback(
    (setId: string, delay = 700) => {
      const t = timers.current.get(setId);
      if (t) clearTimeout(t);
      timers.current.set(setId, setTimeout(() => persist(setId), delay));
    },
    [persist],
  );

  const flushAll = useCallback(async () => {
    for (const id of [...timers.current.keys(), ...failed.current]) persist(id);
    await queue.current;
  }, [persist]);

  const syncStructure = useCallback(() => {
    const snapshot = blocksRef.current.map((b) => ({ exerciseId: b.exerciseId, setIds: b.sets.map((s) => s.id) }));
    enqueue(() => syncBlocks(log.id, snapshot));
  }, [enqueue, log.id]);

  useEffect(() => {
    const onHide = () => {
      for (const id of timers.current.keys()) persist(id);
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      onHide();
    };
  }, [persist]);

  // ── mutations ──
  const patchSet = (setId: string, patch: Partial<LSet>, save: "debounce" | "now" = "debounce") => {
    update((bs) => bs.map((b) => ({ ...b, sets: b.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) })));
    if (save === "now") persist(setId);
    else schedule(setId);
  };

  const toggleDone = (bi: number, si: number) => {
    const block = blocksRef.current[bi];
    const set = block.sets[si];
    if (set.done) return patchSet(set.id, { done: false }, "now");
    const prev = prevFor(block, si, history[block.exerciseId]?.last?.sets);
    const patch: Partial<LSet> = { done: true };
    if (!set.weight && prev?.weightKg != null) patch.weight = String(prev.weightKg);
    if (!set.reps) {
      // Only copy what was actually done last time; never invent values.
      if (prev?.reps == null) {
        const focusId = !set.weight && !patch.weight && exById.get(block.exerciseId)?.type === "weight" ? `w-${set.id}` : `reps-${set.id}`;
        document.getElementById(focusId)?.focus();
        return;
      }
      patch.reps = String(prev.reps);
    }
    patchSet(set.id, patch, "now");
    const restSec = set.warmup ? 60 : (prescriptions[block.exerciseId]?.restSec ?? 90);
    rest.start(restSec);
  };

  const addSet = (bi: number) => {
    const id = uid();
    update((bs) =>
      bs.map((b, i) =>
        i === bi ? { ...b, sets: [...b.sets, { id, warmup: false, weight: "", reps: "", note: "", done: false }] } : b,
      ),
    );
    persist(id);
  };

  const removeSet = (setId: string) => {
    const t = timers.current.get(setId);
    if (t) clearTimeout(t);
    timers.current.delete(setId);
    update((bs) => bs.map((b) => ({ ...b, sets: b.sets.filter((s) => s.id !== setId) })).filter((b) => b.sets.length));
    enqueue(() => deleteSet(log.id, setId));
    syncStructure();
  };

  const loadHistory = (exerciseId: string) => {
    if (history[exerciseId]) return;
    exerciseHistory(log.id, exerciseId)
      .then((h) => h && setHistory((m) => ({ ...m, [exerciseId]: h })))
      .catch(() => {});
  };

  const addExercise = (ex: ExerciseOption) => {
    setExercises((list) => (list.some((e) => e.id === ex.id) ? list : [...list, ex].sort((a, b) => a.name.localeCompare(b.name))));
    const n = 3;
    const sets: LSet[] = Array.from({ length: n }, () => ({ id: uid(), warmup: false, weight: "", reps: "", note: "", done: false }));
    update((bs) => [...bs, { key: uid(), exerciseId: ex.id, sets }]);
    for (const s of sets) persist(s.id);
    loadHistory(ex.id);
    setTimeout(() => document.getElementById(`block-${blocksRef.current.length - 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const replaceExercise = (bi: number, ex: ExerciseOption) => {
    setExercises((list) => (list.some((e) => e.id === ex.id) ? list : [...list, ex]));
    update((bs) => bs.map((b, i) => (i === bi ? { ...b, exerciseId: ex.id } : b)));
    loadHistory(ex.id);
    syncStructure();
  };

  const moveBlock = (bi: number, dir: -1 | 1) => {
    const to = bi + dir;
    if (to < 0 || to >= blocksRef.current.length) return;
    update((bs) => {
      const next = [...bs];
      [next[bi], next[to]] = [next[to], next[bi]];
      return next;
    });
    syncStructure();
  };

  const removeBlock = (bi: number) => {
    update((bs) => bs.filter((_, i) => i !== bi));
    syncStructure();
  };

  // ── sheets ──
  const [picker, setPicker] = useState<null | { mode: "add" } | { mode: "replace"; bi: number }>(null);
  const [exMenu, setExMenu] = useState<number | null>(null);
  const [setMenu, setSetMenu] = useState<{ bi: number; si: number } | null>(null);
  const [finishing, setFinishing] = useState(false);

  // ── summary ──
  const summary = useMemo(() => {
    let done = 0;
    let total = 0;
    let volume = 0;
    let undone = 0;
    const best = new Map<string, { e1rm: number; weight: number; reps: number }>();
    for (const b of blocks) {
      for (const s of b.sets) {
        if (!s.done) {
          undone++;
          if (!s.warmup) total++;
          continue;
        }
        if (s.warmup) continue;
        total++;
        done++;
        const w = parseNum(s.weight);
        const r = parseNum(s.reps);
        if (w != null && r != null) volume += w * r;
        const e = epley(w, r);
        if (e != null && w != null && r != null) {
          const cur = best.get(b.exerciseId);
          if (!cur || e > cur.e1rm) best.set(b.exerciseId, { e1rm: e, weight: w, reps: r });
        }
      }
    }
    const prs: PR[] = [];
    for (const [exId, b] of best) {
      const h = history[exId];
      if (!h || h.maxE1rm == null) continue;
      if (b.e1rm > h.maxE1rm + 0.05) {
        prs.push({
          name: exById.get(exId)?.name ?? "Exercise",
          set: fmtSet({ weightKg: b.weight, reps: b.reps }),
          detail: b.weight > (h.maxWeight ?? 0) ? "Heaviest yet" : "Best estimated 1RM",
        });
      }
    }
    return { done, total, volume: Math.round(volume), undone, prs };
  }, [blocks, history, exById]);

  const tintStyle = tint(color);

  return (
    <div style={tintStyle} className="pb-40">
      {/* Header */}
      <div className="sticky top-0 z-30 -mx-4 glass px-4 pt-safe sm:-mx-6 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-3">
          <Link
            href={editing ? `/fitness/history/${log.id}` : "/fitness"}
            className="tap -ml-2 grid size-11 place-items-center rounded-full text-ink-2"
            aria-label={editing ? "Back to session" : "Leave logger (workout keeps running)"}
          >
            <ChevronLeft className="size-6" strokeWidth={2.2} />
          </Link>
          <div className="min-w-0 text-center">
            <div className="tnum text-[17px] font-semibold tracking-tight text-ink">
              {editing ? "Edit session" : elapsed.label}
            </div>
            {saveError && (
              <button type="button" onClick={() => flushAll()} className="text-[11.5px] font-semibold text-bad">
                Not saved · Retry
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={async () => {
              setFinishing(true);
              void flushAll();
            }}
            className="tap h-10 rounded-full bg-tint px-5 text-[15px] font-semibold text-tint-ink"
          >
            {editing ? "Save" : "Finish"}
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="pt-4 pb-5">
        <div className="eyebrow" style={{ color: colorVar(color) }}>
          {editing ? formatLongDate(log.date) : "Workout"}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== log.name && renameWorkout(log.id, name).catch(() => {})}
          aria-label="Workout name"
          className="display -ml-0.5 mt-1 w-full bg-transparent !text-[36px] text-ink outline-none"
        />
        <div className="tnum mt-1 text-[13.5px] text-ink-3">
          {summary.done} of {summary.total} sets
          {summary.volume > 0 && ` · ${fmtVolume(summary.volume)}`}
        </div>
      </div>

      {/* Exercises */}
      <div className="flex flex-col gap-4">
        {blocks.map((b, bi) => (
          <ExerciseCard
            key={b.key}
            index={bi}
            block={b}
            exercise={exById.get(b.exerciseId)}
            prescription={prescriptions[b.exerciseId]}
            history={history[b.exerciseId]}
            onChange={(setId, patch) => patchSet(setId, patch)}
            onBlurSet={(setId) => timers.current.has(setId) && persist(setId)}
            onToggle={(si) => toggleDone(bi, si)}
            onAddSet={() => addSet(bi)}
            onMenu={() => setExMenu(bi)}
            onSetMenu={(si) => setSetMenu({ bi, si })}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPicker({ mode: "add" })}
        className="tap mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[22px] border border-dashed border-line-strong text-[15px] font-semibold text-ink-2"
      >
        <Plus className="size-[18px]" /> Add exercise
      </button>

      {blocks.length === 0 && (
        <p className="mt-6 text-center text-[14px] text-ink-3">Add an exercise to start logging.</p>
      )}

      <RestBar rest={rest} />

      <ExercisePicker
        open={picker != null}
        onClose={() => setPicker(null)}
        exercises={exercises}
        title={picker?.mode === "replace" ? "Replace exercise" : "Add exercise"}
        onPick={(ex) => {
          if (picker?.mode === "replace") replaceExercise(picker.bi, ex);
          else addExercise(ex);
          setPicker(null);
        }}
      />

      <ExerciseMenu
        open={exMenu != null}
        onClose={() => setExMenu(null)}
        exercise={exMenu != null ? exById.get(blocks[exMenu]?.exerciseId ?? "") : undefined}
        canUp={exMenu != null && exMenu > 0}
        canDown={exMenu != null && exMenu < blocks.length - 1}
        onUp={() => exMenu != null && moveBlock(exMenu, -1)}
        onDown={() => exMenu != null && moveBlock(exMenu, 1)}
        onReplace={() => exMenu != null && setPicker({ mode: "replace", bi: exMenu })}
        onRemove={() => exMenu != null && removeBlock(exMenu)}
      />

      <SetMenu
        open={setMenu != null}
        onClose={() => setSetMenu(null)}
        set={setMenu ? blocks[setMenu.bi]?.sets[setMenu.si] : undefined}
        exerciseName={setMenu ? (exById.get(blocks[setMenu.bi]?.exerciseId ?? "")?.name ?? "") : ""}
        onWarmup={(warmup) => {
          const s = setMenu && blocks[setMenu.bi]?.sets[setMenu.si];
          if (s) patchSet(s.id, { warmup }, "now");
        }}
        onNote={(note) => {
          const s = setMenu && blocks[setMenu.bi]?.sets[setMenu.si];
          if (s) patchSet(s.id, { note }, "now");
        }}
        onDelete={() => {
          const s = setMenu && blocks[setMenu.bi]?.sets[setMenu.si];
          if (s) removeSet(s.id);
          setSetMenu(null);
        }}
      />

      <FinishSheet
        open={finishing}
        onClose={() => setFinishing(false)}
        logId={log.id}
        editing={editing}
        durationSec={editing ? (log.endedAt ? Math.round((log.endedAt - log.startedAt) / 1000) : null) : elapsed.sec}
        workingSets={summary.done}
        volume={summary.volume}
        undone={summary.undone}
        prs={summary.prs}
        defaultFeeling={log.feeling}
        defaultNotes={log.notes}
        flush={flushAll}
        color={color}
      />
    </div>
  );
}

function ExerciseCard({
  index,
  block,
  exercise,
  prescription: p,
  history,
  onChange,
  onBlurSet,
  onToggle,
  onAddSet,
  onMenu,
  onSetMenu,
}: {
  index: number;
  block: Block;
  exercise?: ExerciseOption;
  prescription?: Prescription;
  history?: ExerciseHistory;
  onChange: (setId: string, patch: Partial<LSet>) => void;
  onBlurSet: (setId: string) => void;
  onToggle: (si: number) => void;
  onAddSet: () => void;
  onMenu: () => void;
  onSetMenu: (si: number) => void;
}) {
  const basis = exercise ? basisLabel(exercise.weightBasis, exercise.unilateral) : null;
  const last = history?.last;
  const lastWorking = last?.sets.filter((s) => !s.warmup) ?? [];
  const allDone = block.sets.length > 0 && block.sets.every((s) => s.done);
  const isBodyweight = exercise?.type === "bodyweight";
  let working = 0;

  return (
    <section id={`block-${index}`} className="card scroll-mt-20 overflow-hidden">
      <div className="flex items-start gap-2 px-4 pt-4">
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-[17px] font-semibold leading-snug tracking-tight", allDone ? "text-ink-3" : "text-ink")}>
            {exercise?.name ?? "Exercise"}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
            {p && (
              <span className="tnum font-medium text-ink-2">
                {p.sets} × {repsLabel(p.repsMin, p.repsMax, p.reps)}
              </span>
            )}
            {p && <span>rest {fmtRest(p.restSec)}</span>}
            {p?.provisional && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">Provisional</span>
            )}
            {basis && <span>{basis}</span>}
          </div>
          {p?.notes && <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{p.notes}</p>}
          {lastWorking.length > 0 && (
            <p className="tnum mt-1.5 text-[13px] leading-snug text-ink-3">
              Last: <span className="text-ink-2">{lastWorking.map(fmtSet).join(", ")}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onMenu}
          aria-label="Exercise options"
          className="tap -mr-2 -mt-1.5 grid size-11 shrink-0 place-items-center rounded-full text-ink-3"
        >
          <Ellipsis className="size-5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[40px_1fr_1fr_48px] items-center gap-2 px-3 pb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">
        <span className="text-center">Set</span>
        <span className="text-center">{isBodyweight ? "+kg" : "kg"}</span>
        <span className="text-center">Reps</span>
        <span />
      </div>

      <div className="flex flex-col gap-1 px-2 pb-2">
        {block.sets.map((s, si) => {
          if (!s.warmup) working++;
          const prev = prevFor(block, si, last?.sets);
          return (
            <div key={s.id}>
              <div
                className={cn(
                  "grid grid-cols-[40px_1fr_1fr_48px] items-center gap-2 rounded-2xl px-1 py-1 transition-colors",
                  s.done && "bg-[color-mix(in_oklab,var(--ok)_9%,transparent)]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSetMenu(si)}
                  aria-label={`Set ${si + 1} options`}
                  className={cn(
                    "tap tnum grid h-11 place-items-center rounded-xl text-[15px] font-semibold",
                    s.warmup ? "text-warn" : "text-ink-2",
                  )}
                >
                  {s.warmup ? "W" : working}
                </button>
                <NumInput
                  id={`w-${s.id}`}
                  value={s.weight}
                  placeholder={prev?.weightKg != null ? String(prev.weightKg) : isBodyweight ? "0" : "kg"}
                  decimal
                  done={s.done}
                  onChange={(v) => onChange(s.id, { weight: v })}
                  onBlur={() => onBlurSet(s.id)}
                  label="Weight in kg"
                />
                <NumInput
                  id={`reps-${s.id}`}
                  value={s.reps}
                  placeholder={prev?.reps != null ? String(prev.reps) : p && !s.warmup ? repsLabel(p.repsMin, p.repsMax, "reps") : "reps"}
                  done={s.done}
                  onChange={(v) => onChange(s.id, { reps: v })}
                  onBlur={() => onBlurSet(s.id)}
                  label="Reps"
                />
                <div className="grid place-items-center">
                  <CheckCircle checked={s.done} onToggle={() => onToggle(si)} color="var(--ok)" size={32} label={s.done ? "Undo set" : "Complete set"} />
                </div>
              </div>
              {s.note && (
                <button
                  type="button"
                  onClick={() => onSetMenu(si)}
                  className="flex w-full items-start gap-1.5 px-3 pt-0.5 pb-1.5 text-left text-[12.5px] leading-snug text-ink-3"
                >
                  <MessageSquare className="mt-0.5 size-3 shrink-0" />
                  {s.note}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddSet}
        className="tap flex h-12 w-full items-center justify-center gap-1.5 border-t border-line text-[14px] font-semibold text-ink-2"
      >
        <Plus className="size-4" /> Add set
      </button>
    </section>
  );
}

function NumInput({
  id,
  value,
  placeholder,
  decimal,
  done,
  onChange,
  onBlur,
  label,
}: {
  id: string;
  value: string;
  placeholder: string;
  decimal?: boolean;
  done: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
  label: string;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      pattern={decimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
      enterKeyHint="done"
      autoComplete="off"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const v = e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, "").slice(0, 6);
        onChange(v);
      }}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className={cn(
        "tnum h-12 w-full min-w-0 rounded-xl text-center text-[19px] font-semibold text-ink outline-none transition-colors placeholder:font-medium placeholder:text-ink-3/70",
        done ? "bg-transparent" : "bg-sunken focus:bg-surface focus:ring-[1.5px] focus:ring-inset focus:ring-[color-mix(in_oklab,var(--tint)_70%,transparent)]",
      )}
    />
  );
}
