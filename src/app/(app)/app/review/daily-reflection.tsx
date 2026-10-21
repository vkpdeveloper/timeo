"use client";

import { Check, CircleAlert, Pencil } from "lucide-react";
import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { springs } from "@/components/ui/motion";
import type { Reflection } from "@/db/schema";
import { saveDailyReflection } from "./actions";

const PROMPTS = [
  { key: "wins", label: "What moved?", placeholder: "e.g. Finished the draft" },
  { key: "slipped", label: "What slipped?", placeholder: "e.g. Skipped the run" },
  { key: "next", label: "Tomorrow's one thing", placeholder: "e.g. Send the beta invites" },
] as const;

/** One row: label, then five tappable steps filled up to the chosen value. */
function ScaleRow({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 pr-2 pl-4" role="radiogroup" aria-label={label}>
      <div className="w-[64px] shrink-0">
        <div className="text-[14.5px] font-medium text-ink">{label}</div>
        {value != null && <div className="truncate text-[11.5px] text-ink-3">{value <= 2 ? low : value >= 4 ? high : "Okay"}</div>}
      </div>
      <div className="flex flex-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value != null && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${label} ${n} of 5`}
              onClick={() => onChange(n)}
              className="tap flex h-11 flex-1 items-center justify-center"
            >
              <motion.span
                className="block size-[22px] rounded-full border-[1.75px]"
                initial={false}
                animate={{
                  backgroundColor: on ? "var(--accent)" : "rgba(0,0,0,0)",
                  borderColor: on ? "var(--accent)" : "var(--line-strong)",
                  opacity: on ? 0.4 + (n / 5) * 0.6 : 1,
                  scale: value === n ? [1, 1.18, 1] : 1,
                }}
                transition={springs.snappy}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The evening check-in as one light card: two taps (mood, energy) and three
 * short lines. Once saved it folds into a summary with an Edit button.
 */
export function DailyReflection({
  today,
  saved,
  primary = true,
}: {
  today: string;
  saved: Reflection | null;
  /** Save is the screen's main action (accent) unless something else leads. */
  primary?: boolean;
}) {
  const [editing, setEditing] = useState(!saved);
  const [mood, setMood] = useState<number | null>(saved?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(saved?.energy ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (saved && !editing) {
    const lines = PROMPTS.filter((p) => saved[p.key]);
    return (
      <div className="card card-list animate-pop overflow-hidden">
        <div className="flex min-h-[52px] items-center gap-3 py-2 pr-2 pl-4">
          <Check className="size-5 shrink-0 text-ok" strokeWidth={2.2} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium text-ink">Checked in</div>
            {(saved.mood || saved.energy) && (
              <div className="tnum text-[13px] text-ink-3">
                {[saved.mood && `Mood ${saved.mood}/5`, saved.energy && `Energy ${saved.energy}/5`].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
        {lines.map((p) => (
          <div key={p.key} className="px-4 py-2.5">
            <div className="text-[12.5px] font-medium text-ink-3">{p.label}</div>
            <p className="mt-0.5 text-[15px] leading-snug whitespace-pre-line text-ink">{saved[p.key]}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <form
      className="card card-list overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          try {
            await saveDailyReflection(fd);
            setEditing(false);
          } catch {
            setError("Couldn't save. Try again.");
          }
        });
      }}
    >
      <input type="hidden" name="date" value={today} />
      <input type="hidden" name="mood" value={mood ?? ""} />
      <input type="hidden" name="energy" value={energy ?? ""} />
      <ScaleRow label="Mood" low="Low" high="Good" value={mood} onChange={setMood} />
      <ScaleRow label="Energy" low="Drained" high="Charged" value={energy} onChange={setEnergy} />
      {PROMPTS.map((p) => (
        <label key={p.key} className="block cursor-text px-4 py-2.5">
          <span className="block text-[12.5px] font-medium text-ink-3">{p.label}</span>
          <textarea
            name={p.key}
            rows={1}
            defaultValue={saved?.[p.key] ?? ""}
            placeholder={p.placeholder}
            maxLength={1000}
            className="field-sizing-content mt-0.5 block min-h-6 w-full resize-none bg-transparent text-[16px] leading-snug text-ink outline-none placeholder:text-ink-3/70"
          />
        </label>
      ))}
      <div className="p-3">
        {error && (
          <p role="alert" className="mb-2.5 flex items-start gap-2 px-1 text-[13.5px] font-medium text-warn">
            <CircleAlert className="mt-px size-4 shrink-0" />
            {error}
          </p>
        )}
        <div className="flex gap-2">
          {saved && (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant={primary ? "accent" : "secondary"} loading={pending} className="flex-1">
            Save check-in
          </Button>
        </div>
      </div>
    </form>
  );
}
