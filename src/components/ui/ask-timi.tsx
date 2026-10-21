"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Timi } from "@/components/ai/timi";
import { startRun } from "@/lib/ai/runs-client";
import { cn } from "@/lib/cn";

type State = "idle" | "sending" | "sent" | "error";

const LABEL: Record<Exclude<State, "idle">, string> = {
  sending: "Asking Timi",
  sent: "Timi is on it",
  error: "Couldn't reach Timi",
};

/**
 * A quiet chip that hands a pre-written prompt to Timi as a background run.
 * The answer arrives through the run toast / push, so the chip only confirms.
 */
export function AskTimi({
  prompt,
  label = "Ask Timi",
  className,
  onSent,
}: {
  /** What Timi is asked to do, written as the user would say it. */
  prompt: string;
  /** Chip text. Keep it short: "Plan my day", "Fill my week". */
  label?: string;
  className?: string;
  onSent?: (runId: string) => void;
}) {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (state !== "sent" && state !== "error") return;
    const t = setTimeout(() => setState("idle"), state === "sent" ? 3200 : 2600);
    return () => clearTimeout(t);
  }, [state]);

  const ask = async () => {
    if (state === "sending") return;
    setState("sending");
    try {
      const id = await startRun(prompt);
      setState("sent");
      onSent?.(id);
    } catch {
      setState("error");
    }
  };

  const text = state === "idle" ? label : LABEL[state];

  return (
    <button
      type="button"
      onClick={ask}
      aria-busy={state === "sending"}
      aria-live="polite"
      title={prompt}
      className={cn(
        "tap relative inline-flex h-9 max-w-full shrink-0 items-center gap-1.5 rounded-full before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] border border-line-strong bg-surface pr-3.5 pl-1.5 text-[13.5px] font-medium text-ink-2",
        "hover:text-ink",
        state === "sent" && "text-ink",
        state === "error" && "text-warn",
        className,
      )}
    >
      <span className="relative grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft">
        <AnimatePresence mode="popLayout" initial={false}>
          {state === "sent" ? (
            <motion.span
              key="ok"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              className="grid size-6 place-items-center rounded-full bg-accent text-accent-ink"
            >
              <Check className="size-3.5" strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.span key="timi" className="grid place-items-center" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
              <Timi size={24} mood={state === "sending" ? "thinking" : state === "error" ? "error" : "idle"} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className="truncate"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
