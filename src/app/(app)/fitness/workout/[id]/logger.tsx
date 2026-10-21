"use client";

import { Check, ChevronLeft, Ellipsis, History as HistoryIcon, MessageSquare, Pause, Play, Plus } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle } from "@/components/ui/controls";
import { springs } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { colorVar, tint } from "@/lib/colors";
import { formatLongDate, formatMonthDay } from "@/lib/dates";
import { repsLabel } from "@/lib/fitness-library";
import type { ExerciseHistory, PrevSet } from "@/lib/fitness";
import {
  basisLabel,
  bestSet,
  epley,
  fmtKg,
  fmtRest,
  fmtSet,
  fmtVolume,
  type ExerciseOption,
} from "@/lib/fitness-math";
import { useWorkoutClock } from "../../_components/workout-clock";
import { draftKey, readDraft, type Draft } from "./draft";
import { deleteSet, exerciseHistory, pauseWorkout, renameWorkout, resumeWorkout, saveSet, syncBlocks, type SetInput } from "./actions";
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
  pausedAt: number | null;
  pausedMs: number;
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
  const [clockState, setClockState] = useState({ pausedAt: log.pausedAt, pausedMs: log.pausedMs });
  const clock = useWorkoutClock({ startedAt: log.startedAt, ...clockState }, !editing);
  const rest = useRestTimer(log.id);

  // ── persistence ──
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [saveError, setSaveError] = useState(false);
  const failed = useRef(new Set<string>());
  // sets the server doesn't have yet (with an edit counter), and pending reorders/removals
  const dirty = useRef(new Map<string, number>());
  const structure = useRef(0);
  const structureSaved = useRef(0);

  const saveDraft = useCallback(() => {
    try {
      if (!dirty.current.size && structure.current === structureSaved.current) localStorage.removeItem(draftKey(log.id));
      else {
        const draft: Draft = { blocks: blocksRef.current, dirty: [...dirty.current.keys()], structure: structure.current !== structureSaved.current };
        localStorage.setItem(draftKey(log.id), JSON.stringify(draft));
      }
    } catch {}
  }, [log.id]);

  const markDirty = useCallback(
    (setId: string) => {
      dirty.current.set(setId, (dirty.current.get(setId) ?? 0) + 1);
      saveDraft();
    },
    [saveDraft],
  );

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
            const version = dirty.current.get(setId);
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
              // only clean if nothing changed while it was saving
              if (dirty.current.get(setId) === version) {
                dirty.current.delete(setId);
                saveDraft();
              }
              failed.current.delete(setId);
              if (!failed.current.size) setSaveError(false);
            } catch {
              failed.current.add(setId);
              setSaveError(true);
            }
            return;
          }
          // the set is gone (removed); nothing to save
          dirty.current.delete(setId);
          saveDraft();
        })
        .catch(() => {});
    },
    [log.id, saveDraft],
  );

  const schedule = useCallback(
    (setId: string, delay = 700) => {
      const t = timers.current.get(setId);
      if (t) clearTimeout(t);
      timers.current.set(setId, setTimeout(() => persist(setId), delay));
    },
    [persist],
  );

  const syncStructure = useCallback(() => {
    const version = ++structure.current;
    saveDraft();
    const snapshot = blocksRef.current.map((b) => ({ exerciseId: b.exerciseId, setIds: b.sets.map((s) => s.id) }));
    enqueue(async () => {
      await syncBlocks(log.id, snapshot);
      structureSaved.current = Math.max(structureSaved.current, version);
      saveDraft();
    });
  }, [enqueue, log.id, saveDraft]);

  /** Saves everything pending; throws if the server still lacks something. */
  const flushAll = useCallback(async () => {
    for (const id of new Set([...timers.current.keys(), ...failed.current, ...dirty.current.keys()])) persist(id);
    if (structure.current !== structureSaved.current) syncStructure();
    await queue.current;
    if (dirty.current.size || structure.current !== structureSaved.current) throw new Error("Not saved");
  }, [persist, syncStructure]);

  // Bring back edits the server never got (refresh, crash, offline).
  useEffect(() => {
    const draft = readDraft(log.id);
    if (!draft || (!draft.dirty.length && !draft.structure)) return;
    blocksRef.current = draft.blocks;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
    setBlocks(draft.blocks);
    for (const id of draft.dirty) {
      markDirty(id);
      persist(id);
    }
    if (draft.structure) syncStructure();
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    markDirty(setId);
    if (save === "now") persist(setId);
    else schedule(setId);
  };

  const toggleDone = (bi: number, si: number) => {
    const block = blocksRef.current[bi];
    const set = block.sets[si];
    if (set.done) return patchSet(set.id, { done: false }, "now");
    const prev = prevFor(block, si, history[block.exerciseId]?.last?.sets);
    // Ticking marks it done, always. Empty fields take last session's values when
    // there are some; nothing is invented.
    const patch: Partial<LSet> = { done: true };
    if (!set.weight && prev?.weightKg != null) patch.weight = String(prev.weightKg);
    if (!set.reps && prev?.reps != null) patch.reps = String(prev.reps);
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
    markDirty(id);
    persist(id);
  };

  const removeSet = (setId: string) => {
    const t = timers.current.get(setId);
    if (t) clearTimeout(t);
    timers.current.delete(setId);
    update((bs) => bs.map((b) => ({ ...b, sets: b.sets.filter((s) => s.id !== setId) })).filter((b) => b.sets.length));
    dirty.current.delete(setId);
    failed.current.delete(setId);
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
    for (const s of sets) {
      markDirty(s.id);
      persist(s.id);
    }
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

  // ── clock ──
  const togglePause = () => {
    const now = Date.now();
    if (clockState.pausedAt != null) {
      setClockState({ pausedAt: null, pausedMs: clockState.pausedMs + Math.max(0, now - clockState.pausedAt) });
      resumeWorkout(log.id).then(setClockState).catch(() => {});
    } else {
      setClockState({ ...clockState, pausedAt: now });
      pauseWorkout(log.id).then(setClockState).catch(() => {});
    }
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
  const progress = summary.total ? summary.done / summary.total : 0;

  // The first unticked set, in order: highlighted in the list and named on the rest bar.
  const upNext = findUpNext(blocks);
  const nextLabel = upNextLabel(upNext, blocks, history, exById);
  const exercisesLeft = blocks.filter((b) => b.sets.some((s) => !s.done)).length;

  return (
    <div style={tintStyle} className="pb-44">
      {/* Header */}
      <div className="sticky top-0 z-30 -mx-4 glass px-4 pt-safe sm:-mx-6 sm:px-6">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Link
            href={editing ? `/fitness/history/${log.id}` : "/fitness"}
            className="tap -ml-2 grid size-11 place-items-center justify-self-start rounded-full text-ink-2"
            aria-label={editing ? "Back to session" : "Leave logger (workout keeps running)"}
          >
            <ChevronLeft className="size-6" strokeWidth={2.2} />
          </Link>
          <div className="flex min-w-0 flex-col items-center">
            {editing ? (
              <div className="text-[16px] font-semibold tracking-tight text-ink">Edit session</div>
            ) : (
              <button
                type="button"
                onClick={togglePause}
                disabled={clock.capped}
                aria-label={clock.paused ? "Resume timer" : "Pause timer"}
                className="tap inline-flex h-10 items-center gap-1.5 rounded-full px-3 hover:bg-sunken disabled:hover:bg-transparent"
              >
                {!clock.capped &&
                  (clock.paused ? (
                    <Play className="size-3.5 fill-current text-tint" />
                  ) : (
                    <Pause className="size-3.5 fill-current text-ink-3" />
                  ))}
                <span suppressHydrationWarning className={cn("tnum-live text-[18px] font-semibold tracking-tight", clock.paused ? "text-ink-3" : "text-ink")}>
                  {clock.label}
                </span>
              </button>
            )}
            {saveError ? (
              <button type="button" onClick={() => flushAll().catch(() => {})} className="-mt-1 text-[11.5px] font-semibold text-bad">
                Not saved · Retry
              </button>
            ) : (
              !editing &&
              (clock.paused || clock.capped) && (
                <span className="-mt-1 text-[11.5px] font-medium text-ink-3">{clock.paused ? "Paused" : "Time's up"}</span>
              )
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setFinishing(true);
              flushAll().catch(() => {});
            }}
            className="tap h-10 justify-self-end rounded-full bg-accent px-4 text-[15px] font-semibold text-accent-ink"
          >
            {editing ? "Save" : "Finish"}
          </button>
        </div>
        {/* sets done / total, along the bottom edge of the bar */}
        <div className="-mx-4 h-[3px] bg-transparent sm:-mx-6" aria-hidden>
          <motion.div
            className="h-full bg-tint"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={springs.smooth}
          />
        </div>
      </div>

      {/* Title */}
      <div className="pt-4 pb-4">
        <div className="eyebrow" style={{ color: colorVar(color) }}>
          {editing ? formatLongDate(log.date) : "Workout"}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== log.name && renameWorkout(log.id, name).catch(() => {})}
          aria-label="Workout name"
          className="display -ml-0.5 mt-0.5 w-full bg-transparent !text-[32px] text-ink outline-none"
        />
        <div className="tnum mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[14px] text-ink-3">
          <span>
            <b className="font-semibold text-ink">{summary.done}</b> of {summary.total} sets
          </span>
          {!editing && blocks.length > 0 && (
            <span>· {exercisesLeft ? `${exercisesLeft} ${exercisesLeft === 1 ? "exercise" : "exercises"} left` : "all done"}</span>
          )}
          {summary.volume > 0 && <span>· {fmtVolume(summary.volume)}</span>}
        </div>
      </div>

      {/* Exercises */}
      <div className="stagger flex flex-col gap-3">
        {blocks.map((b, bi) => (
          <ExerciseCard
            key={b.key}
            index={bi}
            block={b}
            upNext={!editing && upNext?.bi === bi ? upNext.si : null}
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

      {blocks.length === 0 && (
        <div className="card px-6 py-8 text-center">
          <div className="text-[15px] font-semibold text-ink">No exercises yet</div>
          <p className="mt-1 text-[13.5px] text-ink-3">Add one to start logging sets.</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setPicker({ mode: "add" })}
        className="tap mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-line-strong text-[15px] font-semibold text-ink-2"
      >
        <Plus className="size-[18px]" /> Add exercise
      </button>

      <RestBar rest={rest} next={nextLabel} />

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
        durationSec={editing ? (log.endedAt ? Math.round((log.endedAt - log.startedAt) / 1000) : null) : clock.sec}
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

function findUpNext(blocks: Block[]) {
  for (let bi = 0; bi < blocks.length; bi++) {
    const si = blocks[bi].sets.findIndex((s) => !s.done);
    if (si >= 0) return { bi, si };
  }
  return null;
}

/** "Lat pulldown, set 2 · 57.5 × 12" for the rest bar. */
function upNextLabel(
  upNext: { bi: number; si: number } | null,
  blocks: Block[],
  history: Record<string, ExerciseHistory>,
  exById: Map<string, ExerciseOption>,
) {
  if (!upNext) return "Last set done";
  const b = blocks[upNext.bi];
  const s = b.sets[upNext.si];
  const n = s.warmup ? "warm-up" : `set ${b.sets.slice(0, upNext.si + 1).filter((x) => !x.warmup).length}`;
  const prev = prevFor(b, upNext.si, history[b.exerciseId]?.last?.sets);
  const target = prev && (prev.weightKg != null || prev.reps != null) ? ` · ${fmtSet(prev)}` : "";
  return `${exById.get(b.exerciseId)?.name ?? "Exercise"}, ${n}${target}`;
}

const ROW = "grid grid-cols-[34px_58px_1fr_1fr_48px] items-center gap-1.5";

function ExerciseCard({
  index,
  block,
  upNext,
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
  /** Index of the set to do next, when it is in this exercise. */
  upNext: number | null;
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
  const top = bestSet(lastWorking);
  const doneCount = block.sets.filter((s) => s.done).length;
  const allDone = block.sets.length > 0 && doneCount === block.sets.length;
  const isBodyweight = exercise?.type === "bodyweight";
  let working = 0;

  return (
    <section id={`block-${index}`} className="card scroll-mt-20 overflow-hidden">
      <div className="flex items-start gap-3 pt-3.5 pr-2 pl-4">
        <motion.span
          className={cn(
            "tnum mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold",
            allDone ? "bg-ok text-white" : "bg-sunken text-ink-2",
          )}
          initial={false}
          animate={{ scale: allDone ? [1, 1.18, 1] : 1 }}
          transition={{ duration: 0.32 }}
        >
          {allDone ? <Check className="size-4" strokeWidth={3} /> : index + 1}
        </motion.span>
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-[17px] leading-snug font-semibold tracking-tight transition-colors", allDone ? "text-ink-3" : "text-ink")}>
            {exercise?.name ?? "Exercise"}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
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
          {p?.notes && <p className="mt-1 text-[13px] leading-snug text-ink-2">{p.notes}</p>}
          {top && last && (
            <p className="tnum mt-1 flex items-center gap-1.5 text-[13px] text-ink-3">
              <HistoryIcon className="size-3 shrink-0" />
              <span className="truncate">
                {formatMonthDay(last.date)} · best <span className="font-medium text-ink-2">{fmtSet(top)}</span>
                {lastWorking.length > 1 && ` · ${lastWorking.length} sets`}
              </span>
            </p>
          )}
        </div>
        <span className="tnum mt-1 shrink-0 text-[13px] font-medium text-ink-3">
          {doneCount}/{block.sets.length}
        </span>
        <button
          type="button"
          onClick={onMenu}
          aria-label="Exercise options"
          className="tap -mt-1.5 grid size-11 shrink-0 place-items-center rounded-full text-ink-3"
        >
          <Ellipsis className="size-5" />
        </button>
      </div>

      <div className={cn(ROW, "mt-3 px-3 pb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase")}>
        <span className="text-center">Set</span>
        <span className="text-center">Prev</span>
        <span className="text-center">{isBodyweight ? "+kg" : "kg"}</span>
        <span className="text-center">Reps</span>
        <span />
      </div>

      <div className="flex flex-col gap-1 px-2 pb-2">
        {block.sets.map((s, si) => {
          if (!s.warmup) working++;
          const prev = prevFor(block, si, last?.sets);
          const hasPrev = prev && (prev.weightKg != null || prev.reps != null);
          const next = upNext === si;
          return (
            <div key={s.id}>
              <motion.div
                initial={false}
                animate={{ scale: s.done ? [1, 1.018, 1] : 1 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  ROW,
                  "rounded-2xl px-1 py-1 transition-[background-color,box-shadow] duration-300",
                  s.done
                    ? "bg-[color-mix(in_oklab,var(--ok)_12%,transparent)]"
                    : next && "shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--tint)_55%,transparent)]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSetMenu(si)}
                  aria-label={`Set ${si + 1} options`}
                  className={cn(
                    "tap tnum grid h-12 place-items-center rounded-xl text-[15px] font-semibold",
                    s.warmup ? "text-warn" : s.done ? "text-ok" : "text-ink-2",
                  )}
                >
                  {s.warmup ? "W" : working}
                </button>
                <button
                  type="button"
                  disabled={!hasPrev || s.done}
                  onClick={() =>
                    prev &&
                    onChange(s.id, {
                      weight: prev.weightKg != null ? String(prev.weightKg) : s.weight,
                      reps: prev.reps != null ? String(prev.reps) : s.reps,
                    })
                  }
                  aria-label={hasPrev ? `Use last time: ${fmtSet(prev)}` : "No previous set"}
                  className="tap tnum h-12 truncate rounded-xl px-0.5 text-center text-[12.5px] font-medium text-ink-3 disabled:active:scale-100"
                >
                  {hasPrev ? `${fmtKg(prev.weightKg)}×${prev.reps ?? "?"}` : "—"}
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
                  <CheckCircle checked={s.done} onToggle={() => onToggle(si)} color="var(--ok)" size={36} label={s.done ? "Undo set" : "Complete set"} />
                </div>
              </motion.div>
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
        "tnum h-12 w-full min-w-0 rounded-xl text-center text-[20px] font-semibold text-ink outline-none transition-colors placeholder:font-medium placeholder:text-ink-3/60",
        done ? "bg-transparent" : "bg-sunken focus:bg-surface focus:ring-[1.5px] focus:ring-inset focus:ring-[color-mix(in_oklab,var(--tint)_70%,transparent)]",
      )}
    />
  );
}
