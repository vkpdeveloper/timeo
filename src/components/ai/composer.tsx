"use client";

import { ArrowUp, Brain, Check, ChevronDown, Cpu, Mic, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveAiSettings } from "@/actions/ai";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { EFFORT_LABEL, type CatalogModel, type Effort } from "@/lib/ai/shared";
import { cn } from "@/lib/cn";
import { useClientValue } from "@/lib/hooks";

export type ModelChoice = Pick<CatalogModel, "id" | "name" | "efforts" | "free">;

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

const chip =
  "tap inline-flex h-8 max-w-[46vw] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-sunken data-[state=open]:bg-sunken sm:max-w-[220px]";

/**
 * The assistant's input: auto-growing text, inline model and reasoning-effort
 * pickers, voice, and a round send button. Enter sends; Shift+Enter is a new line.
 * Sending is optimistic: the input clears at once and only refills if the send fails.
 */
export function Composer({
  models,
  modelId,
  effort,
  onSend,
  autoFocus,
}: {
  models: ModelChoice[];
  modelId: string;
  effort: Effort;
  onSend: (text: string, origin?: SendOrigin) => Promise<boolean>;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [model, setModel] = useState(modelId);
  const [eff, setEff] = useState<Effort>(effort);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const canListen = useClientValue(() => !!getRecognition(), false);

  const current = models.find((m) => m.id === model);
  const efforts = current?.efforts ?? ["auto"];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? models.filter((m) => m.name.toLowerCase().includes(q)) : models;
  }, [models, query]);

  // grow with content, up to ~8 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const pickModel = (m: ModelChoice) => {
    const nextEffort = m.efforts.includes(eff) ? eff : m.efforts.includes("low") ? "low" : "auto";
    setModel(m.id);
    setEff(nextEffort);
    start(() => saveAiSettings(m.id, nextEffort));
  };
  const pickEffort = (e: Effort) => {
    setEff(e);
    start(() => saveAiSettings(model, e));
  };

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
    // pt-4 / px-4 on the textarea: where the first line of text starts
    onSend(v, box && { x: box.left + 16, y: box.top + 16 }).then((ok) => {
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
      className="focus-shell rounded-[24px] border border-line bg-surface shadow-[0_8px_30px_-12px_rgb(0_0_0/0.18)]"
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
        placeholder={listening ? "Listening…" : "Log, plan or ask anything"}
        aria-label="Message Timi"
        enterKeyHint="send"
        className="block max-h-[200px] min-h-[52px] w-full resize-none bg-transparent px-4 pt-4 pb-1 text-[16px] leading-6 text-ink outline-none placeholder:text-ink-3"
      />
      <div className="flex items-center gap-0.5 px-2 pt-1 pb-2">
        <DropdownMenu onOpenChange={(o) => !o && setQuery("")}>
          <DropdownMenuTrigger className={chip} aria-label="Model">
            <Cpu className="size-3.5 shrink-0" />
            <span className="truncate">{current?.name ?? model}</span>
            <ChevronDown className="size-3 shrink-0 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-72 rounded-2xl p-1.5">
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search models"
                className="h-9 w-full rounded-xl bg-sunken pr-2 pl-8 text-[14px] text-ink outline-none placeholder:text-ink-3"
              />
            </div>
            <div className="max-h-[42vh] overflow-y-auto">
              {filtered.map((m) => (
                <DropdownMenuItem key={m.id} onSelect={() => pickModel(m)} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13.5px]">
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  {m.free && <span className="rounded-full bg-ok-soft px-1.5 py-px text-[10px] font-semibold text-ok">FREE</span>}
                  {m.id === model && <Check className="size-4 text-accent" />}
                </DropdownMenuItem>
              ))}
              {!filtered.length && <div className="px-2.5 py-3 text-[13px] text-ink-3">No match</div>}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="rounded-xl px-2.5 py-2 text-[13px] text-ink-3">
              <Link href="/settings/ai">All models and pricing</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {efforts.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger className={chip} aria-label="Reasoning effort">
              <Brain className="size-3.5 shrink-0" />
              {EFFORT_LABEL[eff]}
              <ChevronDown className="size-3 shrink-0 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-48 rounded-2xl p-1.5">
              <DropdownMenuLabel className="px-2.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Reasoning</DropdownMenuLabel>
              {efforts.map((e) => (
                <DropdownMenuItem key={e} onSelect={() => pickEffort(e)} className="flex items-center justify-between rounded-xl px-2.5 py-2 text-[13.5px]">
                  {EFFORT_LABEL[e]}
                  {e === eff && <Check className="size-4 text-accent" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="ml-auto flex items-center gap-1">
          {canListen && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? "Stop listening" : "Speak"}
              className={cn(
                "tap relative grid size-9 place-items-center rounded-full",
                listening ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-sunken",
              )}
            >
              {listening && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />}
              <Mic className="relative size-[17px]" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim()}
            className="tap grid size-9 place-items-center rounded-full bg-accent text-accent-ink transition-opacity disabled:bg-sunken disabled:text-ink-3"
          >
            <ArrowUp className="size-[18px]" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </form>
  );
}
