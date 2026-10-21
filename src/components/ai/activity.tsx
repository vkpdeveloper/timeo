"use client";

import { ArrowUpRight, Loader2, Undo2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { undoTell } from "@/actions/ai";
import { dismissFinished, onRunFinished, useRuns } from "@/lib/ai/runs-client";
import { Timi } from "./timi";

/**
 * Global status for background assistant runs: a small "working" pill while
 * something runs, then a "done" card with Open and Undo. Hidden on /assistant,
 * where the history shows the same thing in place.
 */
export function AssistantActivity() {
  const router = useRouter();
  const { tracked, finished } = useRuns();
  const [onAssistant, setOnAssistant] = useState(false);
  const [undoing, start] = useTransition();
  const [undone, setUndone] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setOnAssistant(location.pathname.startsWith("/app/assistant"));
    check();
    const id = setInterval(check, 800);
    return () => clearInterval(id);
  }, []);

  // refresh visible data when a run saved something
  useEffect(
    () =>
      onRunFinished((run) => {
        if (run.saved) router.refresh();
        navigator.vibrate?.(12);
      }),
    [router],
  );

  // auto-dismiss done cards
  const latest = finished[finished.length - 1];
  useEffect(() => {
    if (!latest) return;
    const id = setTimeout(() => dismissFinished(latest.id), 9000);
    return () => clearTimeout(id);
  }, [latest]);

  const running = Object.values(tracked);
  if (onAssistant) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+22px)] z-[55] flex flex-col items-center gap-2 px-3 lg:right-6 lg:bottom-6 lg:left-auto lg:items-end">
      <AnimatePresence>
        {latest && (
          <motion.div
            key={latest.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="card pointer-events-auto w-full max-w-[420px] p-3.5 shadow-float"
          >
            <div className="flex items-start gap-3">
              <Timi size={36} mood={latest.status === "error" ? "error" : "happy"} className="-my-0.5" />
              <div className="min-w-0 flex-1">
                <div className={latest.status === "error" ? "text-[14px] font-semibold text-warn" : "text-[14px] font-semibold text-ink"}>
                  {latest.status === "error" ? "Couldn't finish" : latest.saved ? `Done · ${latest.saved} saved` : "Done"}
                </div>
                <p className="line-clamp-2 text-[13px] leading-snug text-ink-2">{latest.status === "error" ? latest.input : latest.reply || latest.input}</p>
              </div>
              <button type="button" aria-label="Dismiss" onClick={() => dismissFinished(latest.id)} className="tap -mt-2 -mr-2 grid size-10 place-items-center rounded-full text-ink-3 hover:bg-sunken">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-2.5 flex justify-end gap-1.5">
              {!!latest.saved && latest.status === "done" && undone !== latest.id && (
                <button
                  type="button"
                  disabled={undoing}
                  onClick={() =>
                    start(async () => {
                      await undoTell(latest.id);
                      setUndone(latest.id);
                      router.refresh();
                    })
                  }
                  className="tap inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-sunken"
                >
                  {undoing ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />} Undo
                </button>
              )}
              {undone === latest.id && <span className="inline-flex h-9 items-center px-2 text-[13px] text-ink-3">Undone</span>}
              <Link
                href={`/app/assistant#${latest.id}`}
                onClick={() => dismissFinished(latest.id)}
                className="tap inline-flex h-9 items-center gap-1 rounded-full bg-ink px-3.5 text-[13px] font-medium text-bg"
              >
                Open <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {running.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <Link
              href="/app/assistant"
              className="tap pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface pr-4 pl-2.5 text-[13px] font-medium text-ink-2 shadow-float"
            >
              <Timi size={26} mood="thinking" />
              <span className="animate-pulse-soft">{running.length > 1 ? `Timi is working on ${running.length} things` : "Timi is working…"}</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
