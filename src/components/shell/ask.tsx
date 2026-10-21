"use client";

import { CalendarPlus, ChevronRight, CircleCheck, Plus, Scale, Timer, UtensilsCrossed, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { getPickerContext, type GoalOption } from "@/actions/context";
import { CommandBar } from "@/components/ai/command-bar";
import { BlockSheet, MealSheet, TaskSheet, WeighInSheet } from "@/components/forms/sheets";
import { Sheet } from "@/components/ui/sheet";
import { GUIDE_SUGGESTIONS } from "@/lib/ai/guide";
import { cn } from "@/lib/cn";

/*
 * The one entry point for creating anything: Timi's input on top, quick
 * actions under it. One <AskHost /> lives in the app layout; anything can open
 * it with openAsk() (or straight into a form with openAsk("task")).
 */

type Form = "task" | "block" | "meal" | "weight";
type Mode = null | "menu" | Form;

const EVENT = "timeo:ask";

/** Opens the Ask sheet, or one of its forms directly. */
export function openAsk(form?: Form) {
  window.dispatchEvent(new CustomEvent<Form | undefined>(EVENT, { detail: form }));
}

const ACTIONS: { key: Form | "focus"; label: string; icon: LucideIcon }[] = [
  { key: "task", label: "Task", icon: CircleCheck },
  { key: "block", label: "Time block", icon: CalendarPlus },
  { key: "focus", label: "Focus", icon: Timer },
  { key: "meal", label: "Meal", icon: UtensilsCrossed },
  { key: "weight", label: "Weigh-in", icon: Scale },
];

export function AskHost() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [ctx, setCtx] = useState<{ today: string; goals: GoalOption[] } | null>(null);
  const [pending, start] = useTransition();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const form = (e as CustomEvent<Form | undefined>).detail;
      setMode(form ?? "menu");
      start(async () => setCtx(await getPickerContext()));
    };
    window.addEventListener(EVENT, onOpen);
    return () => {
      window.removeEventListener(EVENT, onOpen);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const close = () => setMode(null);

  return (
    <>
      <Sheet open={mode === "menu"} onClose={close} title="Ask Timi">
        <CommandBar
          placeholder="Type or say anything"
          suggestions={GUIDE_SUGGESTIONS}
          // Leave the "Sent" confirmation up for a moment before closing
          onSent={() => {
            closeTimer.current = setTimeout(close, 900);
          }}
        />

        <div className="mt-6 mb-2 px-1 text-[13px] font-medium text-ink-3">Add</div>
        <div className="stagger grid grid-cols-5 gap-1.5 [--stagger:25ms]">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                type="button"
                disabled={pending && a.key !== "focus"}
                onClick={() => {
                  if (a.key === "focus") {
                    close();
                    router.push("/app/focus");
                  } else setMode(a.key);
                }}
                className="tap flex min-h-[84px] flex-col items-center justify-start gap-2 rounded-[12px] px-1 pt-1.5 text-center hover:bg-sunken disabled:opacity-60"
              >
                <span className="grid size-11 place-items-center rounded-full border border-line-strong bg-surface text-ink">
                  <Icon className="size-[19px]" strokeWidth={1.8} />
                </span>
                <span className="text-[12.5px] leading-tight font-medium text-ink-2">{a.label}</span>
              </button>
            );
          })}
        </div>

        <Link
          href="/app/assistant"
          onClick={close}
          className="tap-row mt-5 -mx-1 flex h-11 items-center justify-between rounded-[12px] px-2 text-[14px] font-medium text-ink-2"
        >
          Open chat
          <ChevronRight className="size-4 text-ink-3" />
        </Link>
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

/**
 * The accent circle that opens the Ask sheet. `bar` sits at the right end of
 * the bottom bar; `rail` in the desktop rail.
 */
export function AskButton({ variant = "bar", className }: { variant?: "bar" | "rail"; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openAsk()}
      aria-label="Ask Timi or add something"
      className={cn(
        "tap grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink hover:opacity-95",
        variant === "rail" && "mx-auto",
        className,
      )}
    >
      <Plus className="size-[22px]" strokeWidth={2.2} />
    </button>
  );
}
