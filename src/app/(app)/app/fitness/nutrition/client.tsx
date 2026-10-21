"use client";

import { Check, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useOptimistic, useState, useTransition } from "react";
import { deleteMealLog, logPlannedMeal } from "@/actions/health";
import { MealSheet } from "@/components/forms/sheets";
import { Button } from "@/components/ui/button";
import { listItem } from "@/components/ui/motion";
import { Sheet } from "@/components/ui/sheet";
import type { DietPlanMeal, MealLog } from "@/db/schema";
import { cn } from "@/lib/cn";
import { toTimeInput } from "@/lib/dates";
import { GOAL_LABEL, type LibraryPlan } from "@/lib/diet-library";
import { ConfirmDelete } from "../_components/confirm-delete";
import { addLibraryPlan, setActivePlan } from "./actions";

const macroLine = (m: { calories: number; proteinG: number; carbsG: number; fatG: number }) =>
  `${m.calories} kcal · P ${m.proteinG} · C ${m.carbsG} · F ${m.fatG}`;

export function LogMealButton({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="accent" size="lg" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Log a meal
      </Button>
      <MealSheet open={open} onClose={() => setOpen(false)} today={today} />
    </>
  );
}

export function PlanMeals({ meals, logged, today }: { meals: DietPlanMeal[]; logged: string[]; today: string }) {
  const [done, add] = useOptimistic(logged, (list, id: string) => [...list, id]);
  const [, start] = useTransition();
  return (
    <div className="card card-list stagger overflow-hidden">
      {meals.map((m) => {
        const ate = done.includes(m.id);
        return (
          <div key={m.id} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
            <div className="mono w-11 shrink-0 text-[12.5px] text-ink-3">
              {m.timeMin != null ? toTimeInput(m.timeMin) : ""}
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn("truncate text-[15px] font-medium transition-colors", ate ? "text-ink-3" : "text-ink")}>{m.name}</div>
              {m.items && (
                <div className="line-clamp-1 text-[13px] text-ink-3">{m.items.split("\n").filter(Boolean).join(" · ")}</div>
              )}
              <div className="tnum text-[12px] text-ink-3">{macroLine(m)}</div>
            </div>
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  add(m.id);
                  await logPlannedMeal(m.id, today);
                })
              }
              className={cn(
                "tap inline-flex h-11 shrink-0 items-center gap-1 rounded-[12px] px-3.5 text-[14px] font-medium transition-colors",
                ate ? "bg-ok-soft text-ok" : "bg-sunken text-ink",
              )}
              aria-label={ate ? `Log ${m.name} again` : `Log ${m.name}`}
            >
              {ate ? (
                <>
                  <Check className="size-3.5 animate-pop" strokeWidth={3} /> Ate
                </>
              ) : (
                "Ate this"
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function LoggedMeals({ meals }: { meals: MealLog[] }) {
  const [list, remove] = useOptimistic(meals, (l, id: string) => l.filter((m) => m.id !== id));
  const [, start] = useTransition();
  if (!list.length)
    return <div className="card px-4 py-5 text-[14px] text-ink-3">Nothing logged yet. Tap Ate this on a planned meal, or log one above.</div>;
  return (
    <div className="card card-list overflow-hidden">
      <AnimatePresence initial={false}>
        {list.map((m) => (
          <motion.div key={m.id} {...listItem} className="flex min-h-[52px] items-center gap-3 py-1.5 pr-1.5 pl-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium text-ink">{m.name}</div>
              <div className="tnum truncate text-[12.5px] text-ink-3">{macroLine(m)}</div>
            </div>
            <ConfirmDelete
              label={`Delete ${m.name}`}
              onDelete={() =>
                start(async () => {
                  remove(m.id);
                  await deleteMealLog(m.id);
                })
              }
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function SetActiveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={() => start(() => setActivePlan(id))}>
      Use
    </Button>
  );
}

export function LibraryCard({ plan, added }: { plan: LibraryPlan; added: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const add = () =>
    start(async () => {
      await addLibraryPlan(plan.slug);
      setOpen(false);
    });
  return (
    <>
      <div className="card flex w-[78%] max-w-[300px] shrink-0 snap-start flex-col p-4">
        <button type="button" onClick={() => setOpen(true)} className="tap flex-1 text-left">
          <div className="eyebrow">{GOAL_LABEL[plan.goal]}</div>
          <div className="mt-1 text-[17px] font-semibold tracking-tight text-ink">{plan.name}</div>
          <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-ink-2">{plan.description}</p>
          <div className="tnum mt-3 flex gap-3 text-[12px] text-ink-3">
            <span><b className="font-semibold text-ink">{plan.calories}</b> kcal</span>
            <span><b className="font-semibold text-ink">{plan.proteinG}</b> g P</span>
            <span>{plan.meals.length} meals</span>
          </div>
        </button>
        <Button variant={added ? "ghost" : "secondary"} size="sm" className="mt-3.5 w-full" loading={pending} disabled={added} onClick={add}>
          {added ? (
            <>
              <Check className="size-3.5" /> Added
            </>
          ) : (
            "Add plan"
          )}
        </Button>
      </div>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={plan.name}
        description={plan.description}
        footer={
          <Button size="lg" loading={pending} disabled={added} onClick={add}>
            {added ? "Already added" : "Add to my plans"}
          </Button>
        }
      >
        <div className="tnum mb-4 grid grid-cols-4 gap-2 text-center">
          {[
            ["kcal", plan.calories],
            ["Protein", `${plan.proteinG} g`],
            ["Carbs", `${plan.carbsG} g`],
            ["Fat", `${plan.fatG} g`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-[12px] bg-sunken px-2 py-2.5">
              <div className="text-[15px] font-semibold text-ink">{v}</div>
              <div className="text-[11px] text-ink-3">{l}</div>
            </div>
          ))}
        </div>
        {plan.meals.map((m) => (
          <div key={m.name} className="border-b border-line py-3 last:border-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold text-ink">{m.name}</span>
              <span className="mono text-[12.5px] text-ink-3">{m.time}</span>
            </div>
            <ul className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
              {m.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <div className="tnum mt-1 text-[12px] text-ink-3">{macroLine(m)}</div>
          </div>
        ))}
      </Sheet>
    </>
  );
}
