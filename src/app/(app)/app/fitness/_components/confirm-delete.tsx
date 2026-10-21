"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** A trash button that asks first: the first tap shows "Delete?", the second deletes. Resets after 3.5s. */
export function ConfirmDelete({ label, onDelete, className }: { label: string; onDelete: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      aria-label={armed ? `Confirm: ${label}` : label}
      onClick={() => (armed ? onDelete() : setArmed(true))}
      className={cn(
        "tap grid h-11 shrink-0 place-items-center rounded-[12px] text-ink-3 hover:text-ink",
        armed ? "border border-line-strong px-3 text-[13.5px] font-medium text-ink" : "w-11",
        className,
      )}
    >
      {armed ? "Delete?" : <Trash2 className="size-4" />}
    </button>
  );
}
