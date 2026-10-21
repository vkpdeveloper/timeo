"use client";

import { ArrowUp, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useClientValue } from "@/lib/hooks";

/** Screen position of the first line of text when it was sent, so the bubble can fly up from there. */
export type SendOrigin = { x: number; y: number };

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
 * The assistant's input: auto-growing text, voice, and a round send button. Enter sends; Shift+Enter is a new line.
 * Sending is optimistic: the input clears at once and only refills if the send fails.
 */
export function Composer({
  onSend,
  autoFocus,
}: {
  onSend: (text: string, origin?: SendOrigin) => Promise<boolean>;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const canListen = useClientValue(() => !!getRecognition(), false);

  // grow with content, up to ~8 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const send = () => {
    const v = text.trim();
    if (!v) return;
    const box = ref.current?.getBoundingClientRect();
    if (listening && recRef.current) {
      recRef.current.onresult = null; // a late transcript mustn't refill the cleared input
      recRef.current.stop();
    }
    setText("");
    ref.current?.focus();
    // px-2.5 / py-2.5 on the textarea: where the first line of text starts
    onSend(v, box && { x: box.left + 10, y: box.top + 10 }).then((ok) => {
      if (!ok) setText((cur) => cur || v);
    });
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
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText(base + t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    navigator.vibrate?.(10);
    rec.start();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="focus-shell flex items-end gap-1 rounded-[24px] border border-line bg-surface/85 p-1.5 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.18)] backdrop-blur-xl"
    >
      <textarea
        ref={ref}
        rows={1}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={listening ? "Listening…" : "Ask what fits, plan or log"}
        aria-label="Message Timi"
        enterKeyHint="send"
        className="block max-h-[200px] min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[16px] leading-6 text-ink outline-none placeholder:text-ink-3"
      />
      {canListen && (
        <button
          type="button"
          onClick={toggleMic}
          aria-label={listening ? "Stop listening" : "Speak"}
          className={cn(
            "tap relative grid size-11 shrink-0 place-items-center rounded-full",
            listening ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-sunken",
          )}
        >
          {listening && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />}
          <Mic className="relative size-[18px]" />
        </button>
      )}
      <button
        type="submit"
        aria-label="Send"
        disabled={!text.trim()}
        className="tap grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-colors disabled:bg-sunken disabled:text-ink-3"
      >
        <ArrowUp className="size-[18px]" strokeWidth={2.4} />
      </button>
    </form>
  );
}
