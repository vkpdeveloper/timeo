"use client";

import { ArrowUp, Mic, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const HINTS = [
  "Plan my week",
  "Bench 4×8 at 60, pull-ups 3×10",
  "2 rotis, dal and paneer for lunch",
  "How are my goals doing?",
  "Drank a litre of water",
  "Move gym to 8pm Friday",
];

/** Entry point to the assistant: type here, it opens /assistant and sends. */
export function CommandBar({ className }: { className?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [hint, setHint] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 3500);
    router.prefetch("/assistant");
    return () => clearInterval(id);
  }, [router]);

  const go = () => {
    const v = text.trim();
    router.push(v ? `/assistant?q=${encodeURIComponent(v)}` : "/assistant");
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      className={cn(
        "card focus-shell flex items-center gap-2 rounded-[22px] p-1.5 pl-4",
        className,
      )}
    >
      <Sparkles className="size-[18px] shrink-0 text-accent" strokeWidth={2} />
      <div className="relative min-w-0 flex-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Ask Timeo"
          enterKeyHint="send"
          className="block h-10 w-full bg-transparent text-[16px] text-ink outline-none"
        />
        {!text && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden text-[16px] text-ink-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={hint}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="truncate"
              >
                {HINTS[hint]}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </div>
      {text.trim() ? (
        <button type="submit" aria-label="Send" className="tap grid size-10 shrink-0 place-items-center rounded-full bg-ink text-bg">
          <ArrowUp className="size-[18px]" strokeWidth={2.4} />
        </button>
      ) : (
        <button type="submit" aria-label="Open assistant" className="tap grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sunken">
          <Mic className="size-[18px]" />
        </button>
      )}
    </form>
  );
}
