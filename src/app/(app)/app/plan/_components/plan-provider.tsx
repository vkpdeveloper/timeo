"use client";

import { ArrowRight, Check, Loader2, Pencil, Play, RotateCcw, ShieldCheck, SkipForward, Trash2 } from "lucide-react";
import Link from "next/link";
import { createContext, use, useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { deleteBlock, moveBlock, setBlockDone, skipBlock } from "@/actions/blocks";
import type { GoalOption } from "@/actions/context";
import { BlockSheet } from "@/components/forms/sheets";
import { buttonClass } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { addDays, formatDuration, relativeDay, toTimeInput } from "@/lib/dates";
import { blockColors, KIND_ICON, KIND_LABEL } from "./block-style";
import type { PlanBlock } from "./types";

export type NewBlockDefaults = {
  date: string;
  start: number;
  end: number;
  title?: string;
  goalId?: string;
  taskId?: string;
  kind?: PlanBlock["kind"];
};

type Ctx = {
  today: string;
  /** Placeholder shown on the grid while the new-block sheet is open. */
  draft: NewBlockDefaults | null;
  openNew: (d: NewBlockDefaults) => void;
  openBlock: (b: PlanBlock) => void;
};

const PlanCtx = createContext<Ctx | null>(null);

export function usePlan() {
  const ctx = use(PlanCtx);
  if (!ctx) throw new Error("usePlan outside PlanProvider");
  return ctx;
}

export function PlanProvider({ goals, today, children }: { goals: GoalOption[]; today: string; children: ReactNode }) {
  const [draft, setDraft] = useState<NewBlockDefaults | null>(null);
  const [detail, setDetail] = useState<PlanBlock | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<PlanBlock | null>(null);

  const openNew = useCallback((d: NewBlockDefaults) => setDraft(d), []);
  const openBlock = useCallback((b: PlanBlock) => {
    setDetail(b);
    setDetailOpen(true);
  }, []);
  const closeNew = useCallback(() => setDraft(null), []);
  const closeDetail = useCallback(() => setDetailOpen(false), []);
  const closeEdit = useCallback(() => setEditing(null), []);

  const value = useMemo(() => ({ today, draft, openNew, openBlock }), [today, draft, openNew, openBlock]);

  return (
    <PlanCtx value={value}>
      {children}
      <BlockSheet
        open={!!draft}
        onClose={closeNew}
        goals={goals}
        today={today}
        defaults={draft ?? undefined}
      />
      <BlockSheet open={!!editing} onClose={closeEdit} goals={goals} today={today} block={editing ?? undefined} />
      <Sheet open={detailOpen} onClose={closeDetail}>
        {detail && (
          <BlockDetail
            key={detail.id}
            block={detail}
            today={today}
            onClose={closeDetail}
            onEdit={() => {
              setDetailOpen(false);
              setEditing(detail);
            }}
          />
        )}
      </Sheet>
    </PlanCtx>
  );
}

function BlockDetail({
  block,
  today,
  onClose,
  onEdit,
}: {
  block: PlanBlock;
  today: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const colors = blockColors(block.color);
  const Icon = KIND_ICON[block.kind];
  const done = !!block.doneAt;
  const skipped = !!block.skippedAt;

  // "Delete?" waits for a second tap, then quietly resets
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3500);
    return () => clearTimeout(t);
  }, [confirm]);

  const run = (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    start(async () => {
      await fn();
      setBusy(null);
      onClose();
    });
  };

  const actions = [
    done
      ? { key: "undo", label: "Undo", icon: RotateCcw, fn: () => setBlockDone(block.id, false) }
      : { key: "done", label: "Done", icon: Check, fn: () => setBlockDone(block.id, true) },
    skipped
      ? { key: "unskip", label: "Restore", icon: RotateCcw, fn: () => setBlockDone(block.id, false) }
      : { key: "skip", label: "Skip", icon: SkipForward, fn: () => skipBlock(block.id) },
    {
      key: "tomorrow",
      label: "Tomorrow",
      icon: ArrowRight,
      fn: () => moveBlock(block.id, addDays(block.date, 1), block.startMin),
    },
  ];

  const primary =
    block.kind === "workout"
      ? { href: "/app/fitness", label: "Start workout" }
      : { href: `/app/focus?block=${block.id}`, label: "Start focus" };

  return (
    <div className="pt-1">
      <div className="flex items-start gap-3.5">
        <span
          className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-[12px]"
          style={{ background: colors.fill, color: colors.ink }}
        >
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="eyebrow flex min-w-0 items-center gap-1.5">
            <span className="shrink-0">{KIND_LABEL[block.kind]}</span>
            {block.goalTitle && (
              <>
                <span className="text-line-strong">·</span>
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: colors.bar }} />
                <span className="truncate text-ink-2">{block.goalTitle}</span>
              </>
            )}
          </div>
          <h2 className={cn("mt-1 text-[20px] leading-snug font-semibold tracking-tight text-ink", skipped && "line-through decoration-ink-3")}>
            {block.title}
          </h2>
          <p className="tnum mt-1 text-[14px] text-ink-2">
            {relativeDay(block.date, today)} ·{" "}
            <span className="mono">
              {toTimeInput(block.startMin)}–{toTimeInput(block.endMin % (24 * 60))}
            </span>
            <span className="text-ink-3"> · {formatDuration(block.endMin - block.startMin)}</span>
          </p>
        </div>
      </div>

      {(done || skipped || block.rescheduleCount > 0 || block.protected) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {done && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-[12px] font-semibold text-ok">
              <Check className="size-3.5" strokeWidth={2.6} /> Done
            </span>
          )}
          {skipped && (
            <span className="inline-flex items-center rounded-full bg-sunken px-2.5 py-1 text-[12px] font-semibold text-ink-2">Skipped</span>
          )}
          {block.protected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-[12px] font-medium text-ink-2">
              <ShieldCheck className="size-3.5" /> Protected
            </span>
          )}
          {block.rescheduleCount > 0 && (
            <span
              className={cn(
                "tnum inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium",
                block.rescheduleCount >= 2 ? "bg-warn-soft text-warn" : "bg-sunken text-ink-2",
              )}
            >
              Moved {block.rescheduleCount}×
            </span>
          )}
        </div>
      )}

      {!done && !skipped && (
        <Link href={primary.href} className={buttonClass("accent", "lg", "mt-6")}>
          <Play className="size-4 fill-current" />
          {primary.label}
        </Link>
      )}

      <div className={cn("grid grid-cols-4 gap-2", done || skipped ? "mt-6" : "mt-3")}>
        {[...actions, { key: "edit", label: "Edit", icon: Pencil, fn: null }].map((a) => {
          const AIcon = a.icon;
          const loading = pending && busy === a.key;
          return (
            <button
              key={a.key}
              type="button"
              disabled={pending}
              onClick={() => (a.fn ? run(a.key, a.fn) : onEdit())}
              className="tap flex h-[64px] flex-col items-center justify-center gap-1.5 rounded-[12px] border border-line-strong text-[12.5px] font-medium text-ink disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-[18px] animate-spin" /> : <AIcon className="size-[18px]" strokeWidth={2} />}
              {a.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => (confirm ? run("delete", () => deleteBlock(block.id)) : setConfirm(true))}
        className={cn(
          "tap mx-auto mt-4 mb-1 flex h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium disabled:opacity-60",
          confirm ? "border border-line-strong text-ink" : "text-ink-2",
        )}
      >
        {pending && busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        {confirm ? "Delete? Tap again" : "Delete block"}
      </button>
    </div>
  );
}
