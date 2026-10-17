"use client";

import { ArrowUp, Check, Loader2, Mic, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { startRun } from "@/lib/ai/runs-client";
import { cn } from "@/lib/cn";
import { useClientValue } from "@/lib/hooks";

const HINTS = [
  "Plan my week",
  "Bench 4×8 at 60, pull-ups 3×10",
  "2 rotis, dal and paneer for lunch",
  "How are my goals doing?",
  "Drank a litre of water",
  "Move gym to 8pm Friday",
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
 * Type (or say) anything; it's sent to the assistant and runs in the
 * background. You can keep using the app; a card appears when it's done.
 */
export function CommandBar({ className, onSent }: { className?: string; onSent?: () => void }) {
  const [text, setText] = useState("");
  const [hint, setHint] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [listening, setListening] = useState(false);
  const canListen = useClientValue(() => !!getRecognition(), false);
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    const id = setInterval(() => setHint((h) => (h + 1) % HINTS.length), 3500);
    return () => clearInterval(id);
  }, []);

  const send = async (value = text) => {
    const v = value.trim();
    if (!v || state === "sending") return;
    setState("sending");
    try {
      await startRun(v);
      setText("");
      setState("sent");
      onSent?.();
      setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  const toggleMic = () => {
    if (listening) return recRef.current?.stop();
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
      if (finalText.trim()) send(base + finalText);
    };
    rec.onerror = () => setListening(false);
    setListening(true);
    navigator.vibrate?.(10);
    rec.start();
  };

  const placeholder = listening ? "Listening…" : state === "sent" ? "Sent. Timi is on it." : state === "error" ? "Couldn't send. Try again." : HINTS[hint];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={cn("card focus-shell flex items-center gap-2 rounded-[22px] p-1.5 pl-4", className)}
    >
      {state === "sent" ? (
        <Check className="size-[18px] shrink-0 text-ok" strokeWidth={2.4} />
      ) : (
        <Sparkles className="size-[18px] shrink-0 text-accent" strokeWidth={2} />
      )}
      <div className="relative min-w-0 flex-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Ask Timi"
          enterKeyHint="send"
          className="block h-10 w-full bg-transparent text-[16px] text-ink outline-none"
        />
        {!text && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center overflow-hidden text-[16px] text-ink-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={placeholder}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className={cn("truncate", state === "sent" && "text-ok", state === "error" && "text-bad")}
              >
                {placeholder}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </div>
      {text.trim() ? (
        <button type="submit" aria-label="Send" disabled={state === "sending"} className="tap grid size-10 shrink-0 place-items-center rounded-full bg-ink text-bg">
          {state === "sending" ? <Loader2 className="size-[18px] animate-spin" /> : <ArrowUp className="size-[18px]" strokeWidth={2.4} />}
        </button>
      ) : canListen ? (
        <button
          type="button"
          onClick={toggleMic}
          aria-label={listening ? "Stop listening" : "Speak"}
          className={cn("tap relative grid size-10 shrink-0 place-items-center rounded-full", listening ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-sunken")}
        >
          {listening && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />}
          <Mic className="relative size-[18px]" />
        </button>
      ) : null}
    </form>
  );
}
