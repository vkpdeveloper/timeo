"use client";

import {
  ArrowUp,
  CalendarPlus,
  Check,
  Droplet,
  Dumbbell,
  Loader2,
  Mic,
  Moon,
  Plus,
  Scale,
  Sparkles,
  Undo2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { tellTimeo, undoTell } from "@/actions/ai";
import type { CommandResult } from "@/lib/ai/shared";
import { cn } from "@/lib/cn";
import { useClientValue } from "@/lib/hooks";

const ICONS = {
  dumbbell: Dumbbell,
  meal: UtensilsCrossed,
  water: Droplet,
  scale: Scale,
  moon: Moon,
  task: Check,
  check: Check,
  calendar: CalendarPlus,
  plus: Plus,
} as const;

const HINTS = [
  "Bench 4×8 at 60, pull-ups 3×10",
  "2 rotis, dal and paneer for lunch",
  "Drank a litre of water",
  "Weighed 74.6 this morning",
  "Skipped gym, too tired",
  "What did I lift on incline press last time?",
  "Protein left today?",
];

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognition(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * "Tell Timeo": one-shot natural-language logging and lookups.
 * Not a chat — each command stands alone, shows what it saved, and can be undone.
 */
export function CommandBar({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<CommandResult | null>(null);
  const [undoneId, setUndoneId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [undoing, startUndo] = useTransition();
  const [listening, setListening] = useState(false);
  const canListen = useClientValue(() => !!getRecognition(), false);
  const [hint, setHint] = useState(0);
  const recRef = useRef<SpeechRec | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const id = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 3500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const submit = (value = text) => {
    const v = value.trim();
    if (!v || pending) return;
    start(async () => {
      try {
        const r = await tellTimeo(v);
        setResult(r);
        if (!r.error) setText("");
      } catch (e) {
        setResult({ id: "", reply: "", actions: [], model: "", effort: "", ms: 0, error: e instanceof Error ? e.message : "Failed" });
      }
    });
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = getRecognition();
    if (!rec) return;
    recRef.current = rec;
    rec.lang = navigator.language || "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    const base = text ? `${text.trim()} ` : "";
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setText(base + finalText + interim);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) submit(base + finalText);
    };
    rec.onerror = () => setListening(false);
    setListening(true);
    navigator.vibrate?.(10);
    rec.start();
  };

  const undone = !!result && undoneId === result.id;
  const visible = result && !(result.actions.length === 0 && !result.reply && !result.error);
  const actions = result?.actions.filter((a) => a.label) ?? [];

  return (
    <div className={cn("relative", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          "card flex items-end gap-2 rounded-[22px] p-1.5 pl-4 transition-shadow",
          "focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_12%,transparent)]",
        )}
      >
        <Sparkles className="mb-[13px] size-[18px] shrink-0 text-accent" strokeWidth={2} />
        <div className="relative min-w-0 flex-1 self-center py-[9px]">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            autoFocus={autoFocus}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            aria-label="Tell Timeo"
            enterKeyHint="send"
            className="block w-full resize-none bg-transparent text-[16px] leading-[22px] text-ink outline-none placeholder:text-transparent"
            placeholder="Tell Timeo"
          />
          {!text && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden text-[16px] text-ink-3">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={listening ? "listening" : hint}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="truncate"
                >
                  {listening ? "Listening…" : HINTS[hint]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
        </div>
        {canListen && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? "Stop listening" : "Speak"}
            className={cn(
              "tap relative grid size-10 shrink-0 place-items-center rounded-full",
              listening ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-sunken",
            )}
          >
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />}
            <Mic className="relative size-[18px]" strokeWidth={2} />
          </button>
        )}
        <button
          type="submit"
          disabled={!text.trim() || pending}
          aria-label="Send"
          className="tap grid size-10 shrink-0 place-items-center rounded-full bg-ink text-bg disabled:bg-sunken disabled:text-ink-3"
        >
          {pending ? <Loader2 className="size-[18px] animate-spin" /> : <ArrowUp className="size-[18px]" strokeWidth={2.4} />}
        </button>
      </form>

      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 pt-3 text-[13px] text-ink-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1.5 rounded-full bg-ink-3"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </span>
              Working on it
            </div>
          </motion.div>
        )}
        {visible && !pending && result && (
          <motion.div
            key={result.id || "err"}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("card mt-2 overflow-hidden rounded-[20px]", undone && "opacity-60")}
          >
            <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
              <div className="min-w-0 flex-1">
                {result.error ? (
                  <p className="text-[14.5px] font-medium text-bad">Couldn&apos;t do that. {result.error}</p>
                ) : (
                  result.reply && <p className="text-[15px] leading-snug font-medium text-ink">{undone ? "Undone." : result.reply}</p>
                )}
                {actions.length > 0 && (
                  <ul className={cn("space-y-1.5", result.reply && "mt-2.5")}>
                    {actions.map((a, i) => {
                      const Icon = ICONS[(a.icon ?? "check") as keyof typeof ICONS] ?? Check;
                      return (
                        <li key={i} className={cn("flex items-center gap-2 text-[13.5px] text-ink-2", undone && "line-through")}>
                          <span className="grid size-5 shrink-0 place-items-center rounded-md bg-ok-soft text-ok">
                            <Icon className="size-3" strokeWidth={2.4} />
                          </span>
                          <span className="truncate">{a.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={() => setResult(null)}
                aria-label="Dismiss"
                className="tap -mt-0.5 -mr-1.5 grid size-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-sunken"
              >
                <X className="size-4" />
              </button>
            </div>
            {!result.error && (
              <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11.5px] text-ink-3">
                <span className="truncate">
                  {result.model} · {(result.ms / 1000).toFixed(1)}s
                </span>
                {actions.length > 0 && !undone && (
                  <button
                    type="button"
                    disabled={undoing}
                    onClick={() =>
                      startUndo(async () => {
                        await undoTell(result.id);
                        setUndoneId(result.id);
                      })
                    }
                    className="tap inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] font-semibold text-ink-2 hover:bg-sunken"
                  >
                    {undoing ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
                    Undo
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
