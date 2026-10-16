"use client";

import { Plus, Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { deleteBodyMetric } from "@/actions/health";
import { WeighInSheet } from "@/components/forms/sheets";
import { Button } from "@/components/ui/button";
import type { BodyMetric } from "@/db/schema";
import { formatMonthDay, formatWeekdayShort } from "@/lib/dates";
import { fmtKg } from "@/lib/fitness-math";

export function WeighInButton({ today, lastWeight }: { today: string; lastWeight?: number | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Weigh-in
      </Button>
      <WeighInSheet open={open} onClose={() => setOpen(false)} today={today} lastWeight={lastWeight} />
    </>
  );
}

export function BodyEntries({ entries }: { entries: BodyMetric[] }) {
  const [list, remove] = useOptimistic(entries, (l, id: string) => l.filter((e) => e.id !== id));
  const [, start] = useTransition();
  return (
    <div className="card overflow-hidden">
      {list.map((e) => (
        <div key={e.id} className="flex items-center gap-3 border-b border-line py-2.5 pr-2 pl-4 last:border-0">
          <div className="w-24 shrink-0 text-[13px] text-ink-3">
            {formatWeekdayShort(e.date)}, {formatMonthDay(e.date)}
          </div>
          <div className="tnum min-w-0 flex-1 text-[15px] text-ink">
            {e.weightKg != null && (
              <>
                <span className="font-semibold">{fmtKg(e.weightKg)}</span>
                <span className="text-ink-3"> kg</span>
              </>
            )}
            {(e.bodyFatPct != null || e.waistCm != null) && (
              <span className="text-[12.5px] text-ink-3">
                {e.bodyFatPct != null && ` · ${e.bodyFatPct}%`}
                {e.waistCm != null && ` · ${e.waistCm} cm`}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="Delete entry"
            onClick={() =>
              start(async () => {
                remove(e.id);
                await deleteBodyMetric(e.id);
              })
            }
            className="tap grid size-11 shrink-0 place-items-center rounded-full text-ink-3"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
