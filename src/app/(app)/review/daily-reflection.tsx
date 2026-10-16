"use client";

import { Check, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import type { Reflection } from "@/db/schema";
import { cn } from "@/lib/cn";
import { saveDailyReflection } from "./actions";

const PROMPTS = [
  { key: "wins", label: "What moved?", placeholder: "One thing that went forward" },
  { key: "slipped", label: "What slipped?", placeholder: "No judgement, just notice" },
  { key: "next", label: "Tomorrow's one thing", placeholder: "The thing that matters most" },
] as const;

/** Five tappable steps, filled up to the chosen value. */
export function Scale({
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
    <div role="radiogroup" aria-label={label}>
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <span className="tnum text-[12px] text-ink-3">{value ? `${value}/5` : ""}</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value != null && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} of 5`}
              onClick={() => onChange(n)}
              className="tap group flex h-11 flex-1 items-center justify-center"
            >
              <span
                className={cn("h-2.5 w-full rounded-full transition-colors duration-200", on ? "bg-accent" : "bg-sunken")}
                style={on ? { opacity: 0.45 + (n / 5) * 0.55 } : undefined}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-0.5 flex justify-between px-0.5 text-[11.5px] text-ink-3">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function DailyReflection({ today, saved }: { today: string; saved: Reflection | null }) {
  const [editing, setEditing] = useState(!saved);
  const [mood, setMood] = useState<number | null>(saved?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(saved?.energy ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (saved && !editing) {
    const lines = PROMPTS.filter((p) => saved[p.key]);
    return (
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ok">
              <Check className="size-4" strokeWidth={2.6} />
              Checked in
            </div>
            <div className="mt-1 text-[17px] font-semibold tracking-tight text-ink">Tonight</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
        {(saved.mood || saved.energy) && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniMeter label="Mood" value={saved.mood} />
            <MiniMeter label="Energy" value={saved.energy} />
          </div>
        )}
        {lines.length > 0 && (
          <dl className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
            {lines.map((p) => (
              <div key={p.key}>
                <dt className="text-[12px] font-medium text-ink-3">{p.label}</dt>
                <dd className="mt-0.5 text-[15px] leading-snug whitespace-pre-line text-ink">{saved[p.key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="text-[17px] font-semibold tracking-tight text-ink">Evening check-in</div>
      <p className="mt-0.5 text-[14px] text-ink-3">Two taps, three lines.</p>
      <form
        className="mt-5"
        action={(fd) => {
          setError(null);
          start(async () => {
            try {
              await saveDailyReflection(fd);
              setEditing(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Couldn't save");
            }
          });
        }}
      >
        <input type="hidden" name="date" value={today} />
        <input type="hidden" name="mood" value={mood ?? ""} />
        <input type="hidden" name="energy" value={energy ?? ""} />
        <div className="flex flex-col gap-4">
          <Scale label="Mood" low="Low" high="Great" value={mood} onChange={setMood} />
          <Scale label="Energy" low="Drained" high="Charged" value={energy} onChange={setEnergy} />
        </div>
        <div className="mt-5 flex flex-col gap-3.5">
          {PROMPTS.map((p) => (
            <label key={p.key} className="block">
              <span className="mb-1.5 block px-1 text-[13px] font-medium text-ink-2">{p.label}</span>
              <textarea
                name={p.key}
                rows={1}
                defaultValue={saved?.[p.key] ?? ""}
                placeholder={p.placeholder}
                maxLength={1000}
                className="field field-sizing-content min-h-12"
              />
            </label>
          ))}
        </div>
        {error && <p className="mt-3 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{error}</p>}
        <div className="mt-5 flex gap-2">
          {saved && (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          <Button type="submit" loading={pending} className="flex-1">
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}

function MiniMeter({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-ink-3">{label}</span>
        <span className="tnum text-[13px] font-semibold text-ink">{value ? `${value}/5` : "–"}</span>
      </div>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={cn("h-1.5 flex-1 rounded-full", value != null && n <= value ? "bg-accent" : "bg-sunken")}
            style={value != null && n <= value ? { opacity: 0.45 + (n / 5) * 0.55 } : undefined}
          />
        ))}
      </div>
    </div>
  );
}
