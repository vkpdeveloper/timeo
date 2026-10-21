"use client";

import { Check, ChevronLeft, CircleAlert, Ellipsis, History as HistoryIcon, MessageSquare, Minus, Pause, Play, Plus } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "@/components/ui/controls";
import { LinearProgress } from "@/components/ui/live";
import { springs, useReducedMotion } from "@/components/ui/motion";
import { cn } from "@/lib/cn";
import { colorVar, tint } from "@/lib/colors";
import { formatLongDate, formatMonthDay } from "@/lib/dates";
import { repsLabel } from "@/lib/fitness-library";
import type { ExerciseHistory, PrevSet } from "@/lib/fitness";
import {
  basisLabel,
  bestSet,
  epley,
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

  // The set open for editing: one the user tapped, or else the next set to do.
  // "none" keeps everything closed until the next tick.
  const [focus, setFocus] = useState<string | null>(null);

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
  const upNextId = upNext ? blocks[upNext.bi].sets[upNext.si].id : null;
  const openSet = focus === "none" ? null : focus && blocks.some((b) => b.sets.some((s) => s.id === focus)) ? focus : editing ? null : upNextId;

  return (
    <div style={tintStyle} className="pb-44">
      {/* Header: back, the clock, finish */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-line bg-bg px-4 pt-safe sm:-mx-6 sm:px-6">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Link
            href={editing ? `/app/fitness/history/${log.id}` : "/app/fitness"}
            className="tap -ml-2 grid size-11 place-items-center justify-self-start rounded-full text-ink-2 hover:text-ink"
            aria-label={editing ? "Back to session" : "Leave logger (workout keeps running)"}
          >
            <ChevronLeft className="size-6" strokeWidth={2.2} />
          </Link>
          <div className="flex min-w-0 flex-col items-center">
            {editing ? (
              <div className="text-[15px] font-semibold tracking-tight text-ink">Edit session</div>
            ) : (
              <button
                type="button"
                onClick={togglePause}
                disabled={clock.capped}
                aria-label={clock.paused ? "Resume timer" : "Pause timer"}
                className="tap inline-flex h-11 items-center gap-2 rounded-[12px] px-3 hover:bg-sunken disabled:hover:bg-transparent"
              >
                {!clock.capped &&
                  (clock.paused ? (
                    <Play className="size-3.5 fill-current text-accent" />
                  ) : (
                    <Pause className="size-3.5 fill-current text-ink-3" />
                  ))}
                <span suppressHydrationWarning className={cn("mono text-[18px] font-medium", clock.paused ? "text-ink-3" : "text-ink")}>
                  {clock.label}
                </span>
              </button>
            )}
            {saveError ? (
              <button
                type="button"
                onClick={() => flushAll().catch(() => {})}
                className="-mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-bad"
              >
                <CircleAlert className="size-3" /> Not saved · Retry
              </button>
            ) : (
              !editing &&
              (clock.paused || clock.capped) && (
                <span className="-mt-1.5 text-[11.5px] font-medium text-ink-3">{clock.paused ? "Paused" : "Time's up"}</span>
              )
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setFinishing(true);
              flushAll().catch(() => {});
            }}
            className="tap h-11 justify-self-end rounded-[12px] border border-line-strong bg-surface px-4 text-[15px] font-medium text-ink"
          >
            {editing ? "Save" : "Finish"}
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="pt-5 pb-5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink-3">
          <span className="size-2 rounded-full" style={{ background: colorVar(color) }} />
          {editing ? formatLongDate(log.date) : "Workout"}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== log.name && renameWorkout(log.id, name).catch(() => {})}
          aria-label="Workout name"
          className="display -ml-0.5 mt-1 w-full bg-transparent !text-[28px] text-ink outline-none"
        />
        <div className="tnum mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[14px] text-ink-3">
          <span>
            <span className="font-medium text-ink">{summary.done}</span> of {summary.total} sets
          </span>
          {!editing && blocks.length > 0 && (
            <span>· {exercisesLeft ? `${exercisesLeft} ${exercisesLeft === 1 ? "exercise" : "exercises"} left` : "all done"}</span>
          )}
          {summary.volume > 0 && <span>· {fmtVolume(summary.volume)}</span>}
        </div>
        <LinearProgress value={progress} color="var(--tint)" height={4} className="mt-3" />
      </div>

      {/* Exercises */}
      <div className="stagger flex flex-col gap-3">
        {blocks.map((b, bi) => (
          <ExerciseCard
            key={b.key}
            index={bi}
            block={b}
            open={openSet}
            upNext={!editing && upNext?.bi === bi ? upNext.si : null}
            exercise={exById.get(b.exerciseId)}
            prescription={prescriptions[b.exerciseId]}
            history={history[b.exerciseId]}
            onOpen={(setId) => setFocus(setId)}
            onChange={(setId, patch) => patchSet(setId, patch)}
            onBlurSet={(setId) => timers.current.has(setId) && persist(setId)}
            onToggle={(si) => {
              setFocus(null);
              toggleDone(bi, si);
            }}
            onClose={() => setFocus(editing ? null : "none")}
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
        className="tap mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-line-strong text-[15px] font-medium text-ink-2 hover:text-ink"
      >
        <Plus className="size-[18px]" /> Add exercise
      </button>

      {!editing && blocks.length > 0 && !upNext && (
        <Button
          variant="accent"
          size="lg"
          className="rise mt-6 h-[52px] text-[16.5px]"
          onClick={() => {
            setFinishing(true);
            flushAll().catch(() => {});
          }}
        >
          <Check className="size-[18px]" strokeWidth={2.6} /> Finish workout
        </Button>
      )}

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

function ExerciseCard({
  index,
  block,
  open,
  upNext,
  exercise,
  prescription: p,
  history,
  onOpen,
  onChange,
  onBlurSet,
  onToggle,
  onClose,
  onAddSet,
  onMenu,
  onSetMenu,
}: {
  index: number;
  block: Block;
  /** Id of the set open for editing, anywhere in the workout. */
  open: string | null;
  /** Index of the set to do next, when it is in this exercise. */
  upNext: number | null;
  exercise?: ExerciseOption;
  prescription?: Prescription;
  history?: ExerciseHistory;
  onOpen: (setId: string) => void;
  onChange: (setId: string, patch: Partial<LSet>) => void;
  onBlurSet: (setId: string) => void;
  onToggle: (si: number) => void;
  onClose: () => void;
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
  const meta = [p && `${p.sets} × ${repsLabel(p.repsMin, p.repsMax, p.reps)}`, p && `rest ${fmtRest(p.restSec)}`, basis].filter(Boolean);
  let working = 0;

  return (
    <section id={`block-${index}`} className="card scroll-mt-20 overflow-hidden">
      <div className="flex items-start gap-3 pt-4 pr-2 pl-4">
        <motion.span
          className={cn(
            "tnum mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-medium",
            allDone ? "bg-accent text-accent-ink" : "bg-sunken text-ink-2",
          )}
          initial={false}
          animate={{ scale: allDone ? [1, 1.12, 1] : 1 }}
          transition={{ duration: 0.28 }}
        >
          {allDone ? <Check className="size-4" strokeWidth={2.8} /> : index + 1}
        </motion.span>
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-[17px] leading-snug font-semibold tracking-tight transition-colors", allDone ? "text-ink-3" : "text-ink")}>
            {exercise?.name ?? "Exercise"}
          </h3>
          {(meta.length > 0 || p?.provisional) && (
            <div className="tnum mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-3">
              {meta.join(" · ")}
              {p?.provisional && (
                <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">Provisional</span>
              )}
            </div>
          )}
          {p?.notes && <p className="mt-1 text-[13px] leading-snug text-ink-2">{p.notes}</p>}
          {top && last && (
            <p className="tnum mt-1 flex items-center gap-1.5 text-[13px] text-ink-3">
              <HistoryIcon className="size-3 shrink-0" />
              <span className="truncate">
                {formatMonthDay(last.date)} · best <span className="text-ink-2">{fmtSet(top)}</span>
                {lastWorking.length > 1 && ` · ${lastWorking.length} sets`}
              </span>
            </p>
          )}
        </div>
        <span className="tnum mt-1 shrink-0 text-[13px] text-ink-3">
          {doneCount}/{block.sets.length}
        </span>
        <button
          type="button"
          onClick={onMenu}
          aria-label="Exercise options"
          className="tap -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:text-ink"
        >
          <Ellipsis className="size-5" />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-1 px-2 pb-2">
        {block.sets.map((s, si) => {
          if (!s.warmup) working++;
          const prev = prevFor(block, si, last?.sets);
          const label = s.warmup ? "W" : String(working);
          const target = p && !s.warmup ? repsLabel(p.repsMin, p.repsMax, "reps") : null;
          return s.id === open ? (
            <OpenSet
              key={s.id}
              set={s}
              label={s.warmup ? "Warm-up" : `Set ${working}`}
              prev={prev}
              target={target}
              isBodyweight={isBodyweight}
              onChange={(patch) => onChange(s.id, patch)}
              onBlur={() => onBlurSet(s.id)}
              onLog={() => onToggle(si)}
              onClose={onClose}
              onMenu={() => onSetMenu(si)}
            />
          ) : (
            <SetRow
              key={s.id}
              set={s}
              label={label}
              prev={prev}
              target={target}
              next={upNext === si}
              isBodyweight={isBodyweight}
              onOpen={() => onOpen(s.id)}
              onToggle={() => onToggle(si)}
              onMenu={() => onSetMenu(si)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddSet}
        className="tap-row flex h-12 w-full items-center justify-center gap-1.5 border-t border-line text-[14px] font-medium text-ink-2"
      >
        <Plus className="size-4" /> Add set
      </button>
    </section>
  );
}

const kgText = (w: string, bodyweight: boolean) => (bodyweight ? (w && w !== "0" ? `+${w} kg` : "Bodyweight") : `${w || "–"} kg`);

/** One set, closed: number, what was (or will be) lifted, a check. 56px tall. */
function SetRow({
  set: s,
  label,
  prev,
  target,
  next,
  isBodyweight,
  onOpen,
  onToggle,
  onMenu,
}: {
  set: LSet;
  label: string;
  prev: PrevSet | null;
  target: string | null;
  next: boolean;
  isBodyweight: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onMenu: () => void;
}) {
  const filled = s.weight !== "" || s.reps !== "";
  const hasPrev = prev && (prev.weightKg != null || prev.reps != null);
  return (
    <div>
      <div
        className={cn(
          "grid min-h-14 grid-cols-[44px_1fr_48px] items-center rounded-[12px] transition-colors duration-300",
          s.done ? "bg-accent-soft" : next && "bg-sunken",
        )}
      >
        <button
          type="button"
          onClick={onMenu}
          aria-label={`Set ${label} options`}
          className={cn(
            "tap tnum grid h-14 place-items-center rounded-[12px] text-[15px] font-medium",
            s.warmup ? "text-warn" : s.done ? "text-accent" : "text-ink-3",
          )}
        >
          {label}
        </button>
        <button type="button" onClick={onOpen} className="tap flex h-14 min-w-0 items-center gap-2 px-1 text-left" aria-label={`Edit set ${label}`}>
          {filled ? (
            <span className={cn("tnum truncate text-[17px] font-medium", s.done ? "text-ink" : "text-ink-2")}>
              {kgText(s.weight, isBodyweight)} <span className="text-ink-3">×</span> {s.reps || "–"}
            </span>
          ) : hasPrev ? (
            <span className="tnum truncate text-[15px] text-ink-3">
              {fmtSet(prev)} <span className="text-[13px]">last time</span>
            </span>
          ) : (
            <span className="truncate text-[15px] text-ink-3">{target ?? "Add weight and reps"}</span>
          )}
        </button>
        <div className="grid place-items-center">
          <CheckCircle checked={s.done} onToggle={onToggle} color="var(--accent)" size={32} label={s.done ? "Undo set" : "Complete set"} />
        </div>
      </div>
      {s.note && (
        <button
          type="button"
          onClick={onMenu}
          className="flex w-full items-start gap-1.5 px-3 pt-0.5 pb-1.5 text-left text-[12.5px] leading-snug text-ink-3"
        >
          <MessageSquare className="mt-0.5 size-3 shrink-0" />
          {s.note}
        </button>
      )}
    </div>
  );
}

/** The set being logged: big steppers for weight and reps, one button. */
function OpenSet({
  set: s,
  label,
  prev,
  target,
  isBodyweight,
  onChange,
  onBlur,
  onLog,
  onClose,
  onMenu,
}: {
  set: LSet;
  label: string;
  prev: PrevSet | null;
  target: string | null;
  isBodyweight: boolean;
  onChange: (patch: Partial<LSet>) => void;
  onBlur: () => void;
  onLog: () => void;
  onClose: () => void;
  onMenu: () => void;
}) {
  const reduce = useReducedMotion();
  const hasPrev = prev && (prev.weightKg != null || prev.reps != null);
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.snappy}
      className="rounded-[14px] border border-line-strong bg-surface-2 p-3"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenu}
          className={cn("tap -my-2 -ml-1 inline-flex h-11 items-center rounded-[10px] px-1 text-[15px] font-semibold", s.warmup ? "text-warn" : "text-ink")}
          aria-label={`${label} options`}
        >
          {label}
        </button>
        {target && <span className="tnum text-[13px] text-ink-3">{target}</span>}
        <span className="flex-1" />
        {hasPrev && !s.done && (
          <button
            type="button"
            onClick={() =>
              onChange({
                weight: prev.weightKg != null ? String(prev.weightKg) : s.weight,
                reps: prev.reps != null ? String(prev.reps) : s.reps,
              })
            }
            className="tap tnum -my-2 -mr-1 inline-flex h-11 items-center gap-1 rounded-[10px] px-1.5 text-[13px] text-ink-3 hover:text-ink"
            aria-label={`Use last time: ${fmtSet(prev)}`}
          >
            Last <span className="font-medium text-ink-2">{fmtSet(prev)}</span>
          </button>
        )}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <SetStepper
          label={isBodyweight ? "Added kg" : "kg"}
          value={s.weight}
          placeholder={prev?.weightKg != null ? String(prev.weightKg) : "0"}
          step={2.5}
          decimal
          onChange={(v) => onChange({ weight: v })}
          onBlur={onBlur}
        />
        <SetStepper
          label="Reps"
          value={s.reps}
          placeholder={prev?.reps != null ? String(prev.reps) : "0"}
          step={1}
          onChange={(v) => onChange({ reps: v })}
          onBlur={onBlur}
        />
      </div>
      {s.done ? (
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" size="md" className="flex-1" onClick={onLog}>
            Mark not done
          </Button>
          <Button variant="outline" size="md" className="flex-1" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <Button variant="accent" size="lg" className="mt-3 h-[52px] text-[16px]" onClick={onLog}>
          <Check className="size-[18px]" strokeWidth={2.6} /> Log set
        </Button>
      )}
    </motion.div>
  );
}

/** Minus, the number (typeable), plus. Every target is at least 44px. */
function SetStepper({
  label,
  value,
  placeholder,
  step,
  decimal,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder: string;
  step: number;
  decimal?: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const bump = (dir: 1 | -1) => {
    const base = parseNum(value) ?? parseNum(placeholder) ?? 0;
    const next = Math.max(0, Math.round((base + dir * step) * 100) / 100);
    onChange(String(next));
  };
  const btn = "tap grid h-12 w-11 shrink-0 place-items-center rounded-[10px] border border-line bg-surface text-ink";
  return (
    <div className="min-w-0">
      <div className="mb-1 px-1 text-[12.5px] text-ink-3">{label}</div>
      <div className="flex items-center gap-1 rounded-[12px] bg-sunken p-1">
        <button type="button" onClick={() => bump(-1)} className={btn} aria-label={`Less ${label}`}>
          <Minus className="size-4" strokeWidth={2.4} />
        </button>
        <input
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          pattern={decimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
          enterKeyHint="done"
          autoComplete="off"
          aria-label={label}
          value={value}
          placeholder={placeholder}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onChange(e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, "").slice(0, 6))}
          onBlur={onBlur}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="tnum h-12 w-full min-w-0 bg-transparent text-center text-[22px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink-3"
        />
        <button type="button" onClick={() => bump(1)} className={btn} aria-label={`More ${label}`}>
          <Plus className="size-4" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
