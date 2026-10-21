"use client";

import { ArrowRight, Check, Pencil, Play, RotateCcw, ShieldCheck, SkipForward, Trash2 } from "lucide-react";
import Link from "next/link";
import { createContext, use, useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { deleteBlock, moveBlock, setBlockDone, skipBlock } from "@/actions/blocks";
import type { GoalOption } from "@/actions/context";
import { BlockSheet } from "@/components/forms/sheets";
import { buttonClass } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { addDays, formatDuration, formatMin, relativeDay } from "@/lib/dates";
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
  const colors = blockColors(block.color);
  const Icon = KIND_ICON[block.kind];
  const done = !!block.doneAt;
  const skipped = !!block.skippedAt;

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
          className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl"
          style={{ background: block.color ? colors.fill : "var(--sunken)", color: colors.ink }}
        >
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="eyebrow flex items-center gap-1.5">
            {KIND_LABEL[block.kind]}
            {block.goalTitle && (
              <>
                <span className="text-line-strong">·</span>
                <span className="truncate normal-case tracking-normal" style={{ color: colors.ink }}>
                  {block.goalTitle}
                </span>
              </>
            )}
          </div>
          <h2 className={cn("mt-1 text-[20px] leading-snug font-semibold tracking-tight text-ink", skipped && "line-through decoration-ink-3")}>
            {block.title}
          </h2>
          <p className="tnum mt-1 text-[14px] text-ink-2">
            {relativeDay(block.date, today)} · {formatMin(block.startMin)} – {formatMin(block.endMin)}
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
        <Link
          href={primary.href}
          className={buttonClass("primary", "lg", "mt-6")}
          style={block.color ? { background: colors.bar, color: "white" } : undefined}
        >
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
              className="tap flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-sunken text-[12.5px] font-semibold text-ink disabled:opacity-60"
            >
              <AIcon className={cn("size-[18px]", loading && "animate-pulse")} strokeWidth={2} />
              {a.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => run("delete", () => deleteBlock(block.id))}
        className="tap mx-auto mt-4 mb-1 flex h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium text-bad disabled:opacity-60"
      >
        <Trash2 className="size-4" /> Delete block
      </button>
    </div>
  );
}
