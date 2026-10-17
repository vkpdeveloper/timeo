"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button, SubmitButton } from "@/components/ui/button";
import { Field, Input, PillPicker, Textarea } from "@/components/ui/controls";
import { TimePicker } from "@/components/ui/pickers";
import { Sheet } from "@/components/ui/sheet";
import type { DietPlan, DietPlanMeal } from "@/db/schema";
import { formatMin, toTimeInput } from "@/lib/dates";
import { GOAL_LABEL } from "@/lib/diet-library";
import { sumMacros } from "@/lib/fitness-math";
import { ErrorNote } from "../../../_components/day-actions";
import {
  deactivatePlan,
  deletePlan,
  deletePlanMeal,
  savePlanMeal,
  setActivePlan,
  syncPlanTotals,
  updatePlan,
} from "../../actions";

function useFormAction(fn: (fd: FormData) => Promise<unknown>, done: () => void) {
  const [error, setError] = useState<string | null>(null);
  return {
    error,
    action: async (fd: FormData) => {
      setError(null);
      try {
        await fn(fd);
        done();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    },
  };
}

export function PlanEditor({ plan, meals, isNew }: { plan: DietPlan; meals: DietPlanMeal[]; isNew: boolean }) {
  const [details, setDetails] = useState(isNew);
  const [meal, setMeal] = useState<DietPlanMeal | "new" | null>(null);
  const [pending, start] = useTransition();
  const sum = sumMacros(meals);
  const mismatch =
    meals.length > 0 &&
    (Math.abs(sum.calories - plan.calories) > 50 || Math.abs(sum.proteinG - plan.proteinG) > 5);

  return (
    <div className="fade-up pb-8">
      <header className="pt-5 pb-5">
        <button type="button" onClick={() => setDetails(true)} className="tap block w-full text-left">
          <div className="eyebrow">
            {GOAL_LABEL[plan.goal]}
            {plan.active && <span className="text-ok"> · Active</span>}
          </div>
          <h1 className="display mt-1.5 text-[38px] text-ink">{plan.name}</h1>
          {plan.description && <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{plan.description}</p>}
          <span className="mt-2 inline-block text-[13px] font-semibold text-accent">Edit targets</span>
        </button>
      </header>

      <div className="card tnum grid grid-cols-4 divide-x divide-line text-center">
        {[
          ["kcal", plan.calories, sum.calories],
          ["Protein", plan.proteinG, sum.proteinG],
          ["Carbs", plan.carbsG, sum.carbsG],
          ["Fat", plan.fatG, sum.fatG],
        ].map(([l, v, s]) => (
          <div key={l} className="px-2 py-3">
            <div className="text-[17px] font-semibold text-ink">{v}</div>
            <div className="text-[11.5px] text-ink-3">{l}</div>
            {meals.length > 0 && <div className="mt-0.5 text-[10.5px] text-ink-3">meals {s}</div>}
          </div>
        ))}
      </div>
      {mismatch && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => syncPlanTotals(plan.id))}
          className="tap mt-2 w-full rounded-2xl px-4 py-2 text-left text-[13px] font-medium text-accent"
        >
          Meals add up differently. Use meal totals as targets.
        </button>
      )}

      <div className="mt-8 mb-2.5 flex items-baseline justify-between px-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Meals</h2>
        <span className="text-[12.5px] text-ink-3">Water {plan.waterMl / 1000} L</span>
      </div>
      <div className="card overflow-hidden">
        {meals.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMeal(m)}
            className="tap flex w-full items-start gap-3 border-b border-line px-4 py-3.5 text-left last:border-0 active:bg-sunken"
          >
            <div className="tnum w-14 shrink-0 pt-0.5 text-[12.5px] font-medium text-ink-3">
              {m.timeMin != null ? formatMin(m.timeMin, true) : ""}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-ink">{m.name}</div>
              {m.items && <div className="mt-0.5 text-[13px] leading-snug whitespace-pre-line text-ink-2">{m.items}</div>}
              <div className="tnum mt-1 text-[12px] text-ink-3">
                {m.calories} kcal · P {m.proteinG} · C {m.carbsG} · F {m.fatG}
              </div>
            </div>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMeal("new")}
          className={`tap flex w-full items-center justify-center gap-1.5 py-3.5 text-[14.5px] font-semibold text-accent ${meals.length ? "border-t border-line" : ""}`}
        >
          <Plus className="size-4" /> Add meal
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <Button
          variant={plan.active ? "secondary" : "primary"}
          size="lg"
          loading={pending}
          onClick={() => start(() => (plan.active ? deactivatePlan(plan.id) : setActivePlan(plan.id)))}
        >
          {plan.active ? "Stop using this plan" : "Use this plan"}
        </Button>
        <DeletePlan id={plan.id} />
      </div>

      <DetailsSheet open={details} onClose={() => setDetails(false)} plan={plan} />
      <MealEditSheet planId={plan.id} meal={meal} onClose={() => setMeal(null)} />
    </div>
  );
}

function DetailsSheet({ open, onClose, plan }: { open: boolean; onClose: () => void; plan: DietPlan }) {
  const { error, action } = useFormAction(updatePlan, onClose);
  return (
    <Sheet open={open} onClose={onClose} title="Plan">
      <form action={action}>
        <input type="hidden" name="id" value={plan.id} />
        <Field label="Name">
          <Input name="name" defaultValue={plan.name} required />
        </Field>
        <Field label="Goal">
          <PillPicker
            name="goal"
            defaultValue={plan.goal}
            options={(Object.keys(GOAL_LABEL) as (keyof typeof GOAL_LABEL)[]).map((g) => ({ value: g, label: GOAL_LABEL[g] }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories" hint="kcal">
            <Input name="calories" type="number" inputMode="numeric" defaultValue={plan.calories} />
          </Field>
          <Field label="Protein" hint="g">
            <Input name="proteinG" type="number" inputMode="numeric" defaultValue={plan.proteinG} />
          </Field>
          <Field label="Carbs" hint="g">
            <Input name="carbsG" type="number" inputMode="numeric" defaultValue={plan.carbsG} />
          </Field>
          <Field label="Fat" hint="g">
            <Input name="fatG" type="number" inputMode="numeric" defaultValue={plan.fatG} />
          </Field>
        </div>
        <Field label="Water" hint="ml">
          <Input name="waterMl" type="number" inputMode="numeric" step={250} defaultValue={plan.waterMl} />
        </Field>
        <Field label="Description" hint="optional">
          <Textarea name="description" rows={2} defaultValue={plan.description ?? ""} />
        </Field>
        <ErrorNote error={error} />
        <SubmitButton size="lg">Save</SubmitButton>
      </form>
    </Sheet>
  );
}

function MealEditSheet({ planId, meal, onClose }: { planId: string; meal: DietPlanMeal | "new" | null; onClose: () => void }) {
  const { error, action } = useFormAction(savePlanMeal, onClose);
  const [pending, start] = useTransition();
  const m = meal && meal !== "new" ? meal : null;
  return (
    <Sheet open={meal != null} onClose={onClose} title={m ? "Edit meal" : "New meal"}>
      {meal != null && (
        <form action={action} key={m?.id ?? "new"}>
          <input type="hidden" name="planId" value={planId} />
          {m && <input type="hidden" name="id" value={m.id} />}
          <div className="grid grid-cols-[1fr_148px] gap-3">
            <Field label="Name">
              <Input name="name" defaultValue={m?.name ?? ""} placeholder="e.g. Lunch" required />
            </Field>
            <Field label="Time">
              <TimePicker name="time" defaultValue={toTimeInput(m?.timeMin)} placeholder="Any" clearable aria-label="Meal time" />
            </Field>
          </div>
          <Field label="What to eat" hint="one per line">
            <Textarea name="items" rows={3} defaultValue={m?.items ?? ""} placeholder={"Dal, 1 katori\n2 phulkas"} />
          </Field>
          <div className="grid grid-cols-4 gap-2">
            <Field label="kcal">
              <Input name="calories" type="number" inputMode="numeric" defaultValue={m?.calories ?? ""} placeholder="0" />
            </Field>
            <Field label="P">
              <Input name="proteinG" type="number" inputMode="numeric" defaultValue={m?.proteinG ?? ""} placeholder="0" />
            </Field>
            <Field label="C">
              <Input name="carbsG" type="number" inputMode="numeric" defaultValue={m?.carbsG ?? ""} placeholder="0" />
            </Field>
            <Field label="F">
              <Input name="fatG" type="number" inputMode="numeric" defaultValue={m?.fatG ?? ""} placeholder="0" />
            </Field>
          </div>
          <ErrorNote error={error} />
          <div className="flex gap-2.5">
            {m && (
              <Button
                type="button"
                variant="danger"
                size="icon"
                className="size-[52px] rounded-2xl"
                loading={pending}
                aria-label="Delete meal"
                onClick={() =>
                  start(async () => {
                    await deletePlanMeal(planId, m.id);
                    onClose();
                  })
                }
              >
                <Trash2 className="size-[18px]" />
              </Button>
            )}
            <SubmitButton size="lg" className="flex-1">
              Save
            </SubmitButton>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function DeletePlan({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (confirm ? start(() => deletePlan(id)) : setConfirm(true))}
      className="tap h-11 w-full rounded-2xl text-[14px] font-semibold text-bad"
    >
      {pending ? "Deleting…" : confirm ? "Tap again to delete this plan" : "Delete plan"}
    </button>
  );
}
