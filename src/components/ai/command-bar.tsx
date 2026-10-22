"use client";

import { ArrowUp, Loader2, Mic } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRef, useState, type Ref } from "react";
import { Timi } from "@/components/ai/timi";
import { startRun } from "@/lib/ai/runs-client";
import { cn } from "@/lib/cn";
import { useClientValue } from "@/lib/hooks";

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

export type SendState = "idle" | "sending" | "sent" | "error";

/**
 * Hands text to Timi as a background run. `send` resolves true once the run
 * has started; a card appears when it's done.
 */
export function useTimiSend(onSent?: () => void) {
  const [state, setState] = useState<SendState>("idle");
  const send = async (value: string) => {
    const v = value.trim();
    if (!v || state === "sending") return false;
    setState("sending");
    try {
      await startRun(v);
      setState("sent");
      onSent?.();
      setTimeout(() => setState("idle"), 1800);
      return true;
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
      return false;
    }
  };
  return { state, send };
}

/**
 * Type (or say) anything. Controlled: the parent owns the text (to filter
 * actions as you type) and the sender. Submitting sends the text to Timi.
 */
export function CommandBar({
  value,
  onChange,
  timi,
  placeholder,
  inputRef,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  timi: ReturnType<typeof useTimiSend>;
  placeholder: string;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
  className?: string;
}) {
  const { state } = timi;
  const [listening, setListening] = useState(false);
  const canListen = useClientValue(() => !!getRecognition(), false);
  const recRef = useRef<SpeechRec | null>(null);

  const send = async (text: string) => {
    if (await timi.send(text)) onChange("");
  };

  const toggleMic = () => {
    if (listening) return recRef.current?.stop();
    const rec = getRecognition();
    if (!rec) return;
    recRef.current = rec;
    rec.lang = navigator.language || "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    const base = value ? `${value.trim()} ` : "";
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onChange(base + finalText + interim);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) send(base + finalText);
    };
    rec.onerror = () => setListening(false);
    setListening(true);
    navigator.vibrate?.(10);
    rec.start();
  };

  const hint = listening
    ? "Listening…"
    : state === "sent"
      ? "Sent. Timi is on it."
      : state === "error"
        ? "Couldn't send. Try again."
        : placeholder;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(value);
      }}
      className={cn("focus-shell flex items-center gap-1 rounded-[14px] border border-line-strong bg-surface p-1 pl-1", className)}
    >
      <Link href="/app/assistant" aria-label="Open chat with Timi" className="tap grid size-10 shrink-0 place-items-center rounded-[10px]">
        <Timi size={30} mood={state === "sending" ? "thinking" : state === "sent" ? "happy" : state === "error" ? "error" : "idle"} />
      </Link>
      <div className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Ask Timi or find an action"
          enterKeyHint="send"
          autoComplete="off"
          autoFocus={autoFocus}
          className="block h-10 w-full bg-transparent text-[16px] text-ink outline-none"
        />
        {!value && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden text-[16px] text-ink-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={hint}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className={cn("truncate", state === "sent" && "text-accent", state === "error" && "text-warn")}
              >
                {hint}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </div>
      {value.trim() ? (
        <button type="submit" aria-label="Send to Timi" disabled={state === "sending"} className="tap grid size-10 shrink-0 place-items-center rounded-[10px] bg-accent text-accent-ink">
          {state === "sending" ? <Loader2 className="size-[18px] animate-spin" /> : <ArrowUp className="size-[18px]" strokeWidth={2.4} />}
        </button>
      ) : canListen ? (
        <button
          type="button"
          onClick={toggleMic}
          aria-label={listening ? "Stop listening" : "Speak"}
          className={cn("tap relative grid size-10 shrink-0 place-items-center rounded-[10px]", listening ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-sunken")}
        >
          {listening && <span className="absolute inset-0 animate-ping rounded-[10px] bg-accent/30" />}
          <Mic className="relative size-[18px]" />
        </button>
      ) : null}
    </form>
  );
}
