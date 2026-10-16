"use client";

import { CalendarPlus, CheckCircle2, Droplet, Plus, Scale, Timer, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getPickerContext, type GoalOption } from "@/actions/context";
import { addWater } from "@/actions/health";
import { CommandBar } from "@/components/ai/command-bar";
import { BlockSheet, MealSheet, TaskSheet, WeighInSheet } from "@/components/forms/sheets";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";

type Mode = null | "menu" | "task" | "block" | "meal" | "weight";

export function QuickAdd({ variant = "fab" }: { variant?: "fab" | "wide" }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [ctx, setCtx] = useState<{ today: string; goals: GoalOption[] } | null>(null);
  const [pending, start] = useTransition();
  const [waterAdded, setWaterAdded] = useState(false);

  const open = () => {
    setMode("menu");
    start(async () => setCtx(await getPickerContext()));
  };
  const close = () => setMode(null);

  const items = [
    { key: "task", label: "Task", icon: CheckCircle2, tint: "var(--c-coral)" },
    { key: "block", label: "Time block", icon: CalendarPlus, tint: "var(--c-indigo)" },
    { key: "focus", label: "Focus session", icon: Timer, tint: "var(--c-violet)" },
    { key: "meal", label: "Meal", icon: UtensilsCrossed, tint: "var(--c-amber)" },
    { key: "water", label: waterAdded ? "+250 ml added" : "Water +250 ml", icon: Droplet, tint: "var(--c-sky)" },
    { key: "weight", label: "Weigh-in", icon: Scale, tint: "var(--c-sage)" },
  ] as const;

  return (
    <>
      {variant === "fab" ? (
        <button
          type="button"
          onClick={open}
          aria-label="Quick add"
          className="tap grid size-[var(--tabbar-h)] place-items-center rounded-[24px] bg-ink text-bg shadow-float"
        >
          <Plus className="size-6" strokeWidth={2.4} />
        </button>
      ) : (
        <button type="button" onClick={open} className="tap flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[14px] font-semibold text-bg">
          <Plus className="size-4" strokeWidth={2.4} /> Quick add
        </button>
      )}

      <Sheet open={mode === "menu"} onClose={close} title="Add">
        <CommandBar className="mb-4" onSent={close} />
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.key}
                type="button"
                disabled={pending && it.key !== "focus" && it.key !== "water"}
                onClick={() => {
                  if (it.key === "focus") {
                    close();
                    router.push("/focus");
                  } else if (it.key === "water") {
                    setWaterAdded(true);
                    start(async () => {
                      await addWater(250);
                      setTimeout(() => setWaterAdded(false), 1600);
                    });
                  } else setMode(it.key);
                }}
                className={cn("tap flex h-[88px] flex-col items-start justify-between rounded-[20px] border border-line bg-surface-2 p-3.5 text-left")}
              >
                <span className="grid size-8 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${it.tint} 15%, var(--surface))`, color: it.tint }}>
                  <Icon className="size-[18px]" strokeWidth={2} />
                </span>
                <span className="text-[14px] font-semibold text-ink">{it.label}</span>
              </button>
            );
          })}
        </div>
      </Sheet>

      {ctx && (
        <>
          <TaskSheet open={mode === "task"} onClose={close} goals={ctx.goals} today={ctx.today} />
          <BlockSheet open={mode === "block"} onClose={close} goals={ctx.goals} today={ctx.today} />
          <MealSheet open={mode === "meal"} onClose={close} today={ctx.today} />
          <WeighInSheet open={mode === "weight"} onClose={close} today={ctx.today} />
        </>
      )}
    </>
  );
}
