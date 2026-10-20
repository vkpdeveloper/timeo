"use client";

import {
  AlertCircle,
  ArrowDown,
  BookOpen,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Droplet,
  Dumbbell,
  Flag,
  ListChecks,
  Moon,
  Plus,
  Scale,
  Settings2,
  ShieldCheck,
  Target,
  Undo2,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { animate } from "motion/react";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode, type RefObject } from "react";
import { undoTell } from "@/actions/ai";
import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Sheet } from "@/components/ui/sheet";
import type { AiPart } from "@/db/schema";
import { onRunFinished, startRun, useRuns } from "@/lib/ai/runs-client";
import type { AssistantRun, Effort, SavedItem } from "@/lib/ai/shared";
import { cn } from "@/lib/cn";
import { Timi } from "./timi";
import { Composer, type ModelChoice, type SendOrigin } from "./composer";

const SUGGESTIONS = [
  "Plan my week",
  "How are my goals doing?",
  "Log Push A: incline 20×10, 22.5×8",
  "2 rotis, dal and paneer for lunch",
  "Protein left today?",
  "What's my day like?",
];

const ICONS: Record<string, typeof Check> = {
  dumbbell: Dumbbell,
  meal: UtensilsCrossed,
  water: Droplet,
  scale: Scale,
  moon: Moon,
  task: Check,
  check: Check,
  calendar: CalendarPlus,
  plus: Plus,
  target: Target,
  flag: Flag,
  shield: ShieldCheck,
};

// What each tool did, in plain words (running, done).
const TOOL_LABEL: Record<string, [string, string]> = {
  log_workout: ["Logging workout", "Logged workout"],
  log_meal: ["Logging meal", "Logged meal"],
  add_water: ["Adding water", "Added water"],
  log_body: ["Saving measurement", "Saved measurement"],
  log_day: ["Saving", "Saved"],
  add_task: ["Adding task", "Added task"],
  complete_task: ["Completing task", "Completed task"],
  get_day: ["Reading your day", "Read your day"],
  get_training: ["Reading training", "Read training"],
  get_nutrition: ["Reading nutrition", "Read nutrition"],
  get_body: ["Reading body stats", "Read body stats"],
  get_focus: ["Reading focus", "Read focus sessions"],
  get_plan: ["Reading your plan", "Read your plan"],
  get_week: ["Reading your week", "Read your week"],
  create_season: ["Creating season", "Created season"],
  add_goals: ["Adding goals", "Added goals"],
  update_goal: ["Updating goal", "Updated goal"],
  add_milestones: ["Adding milestones", "Added milestones"],
  complete_milestone: ["Completing milestone", "Completed milestone"],
  add_weekly_steps: ["Adding weekly steps", "Added weekly steps"],
  add_blocks: ["Blocking time", "Blocked time"],
  move_block: ["Moving block", "Moved block"],
  protect_time: ["Protecting time", "Protected time"],
  set_gym_day: ["Updating gym split", "Updated gym split"],
  log_reflection: ["Saving reflection", "Saved reflection"],
};
const toolLabel = (name: string, done = true) => TOOL_LABEL[name]?.[done ? 1 : 0] ?? name.replace(/_/g, " ");

/**
 * With the Today panel showing (xl), keep the 760px chat column centred on the screen,
 * and slide it left only when the screen is too narrow to fit it beside the panel
 * (panel 300 + 16 gap each side = 332; 760 + 332 = 1092).
 */
const BESIDE_PANEL = "xl:pr-[332px] xl:pl-[max(24px,min(332px,calc(100%_-_1092px)))]";

const fmt = (opts: Intl.DateTimeFormatOptions, timeZone: string) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone });
const secs = (ms: number) => (ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`);

/** Ticks every second while `active`, for "Working · 4s". */
function useNow(active: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

type Props = {
  initialRuns: AssistantRun[];
  timezone: string;
  models: ModelChoice[];
  modelId: string;
  effort: Effort;
  /** Today's plan and tasks: a floating panel on wide screens, a sheet on phones */
  today: ReactNode;
};

/**
 * Assistant history. Every message runs in the background on the server, so
 * you can leave (or close the app) and come back to the result. A run opened
 * from a notification (/assistant#<id>) is scrolled into view.
 */
export function Assistant({ initialRuns, timezone, models, modelId, effort, today }: Props) {
  const router = useRouter();
  const [runs, setRuns] = useState<Record<string, AssistantRun>>(() => Object.fromEntries(initialRuns.map((r) => [r.id, r])));
  // the message just sent: it flies up from the composer (or rises in, if sent from a suggestion)
  const [sent, setSent] = useState<{ id: string; from: SendOrigin | null } | null>(null);
  const { tracked } = useRuns();

  const [todayOpen, setTodayOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const { atBottom, toBottom, release } = useStickToBottom(contentRef);
  const composerH = useHeight(composerRef);

  // a finished run may have changed today's plan or tasks
  useEffect(
    () =>
      onRunFinished((run) => {
        setRuns((prev) => ({ ...prev, [run.id]: run }));
        router.refresh();
      }),
    [router],
  );

  // the run opened from a notification / "Done" card (/assistant#<id>);
  // read after mount and on every hash change (client navigations don't reload)
  const [focus, setFocus] = useState<{ id: string; at: number } | null>(null);
  useEffect(() => {
    const read = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id) setFocus({ id, at: Date.now() });
    };
    const first = setTimeout(read, 60);
    window.addEventListener("hashchange", read);
    return () => {
      clearTimeout(first);
      window.removeEventListener("hashchange", read);
    };
  }, []);

  useEffect(() => {
    if (!focus) return;
    const go = () => {
      release();
      document.getElementById(`run-${focus.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    const timers = [setTimeout(go, 150), setTimeout(go, 700)];
    return () => timers.forEach(clearTimeout);
  }, [focus, release]);

  // a just-sent message comes into view, even if you'd scrolled up
  useEffect(() => {
    if (sent) toBottom();
  }, [sent, toBottom]);

  // runs in progress (started here or on any other screen) overlay the saved history
  const list = useMemo(() => {
    const merged: Record<string, AssistantRun> = { ...runs };
    for (const r of Object.values(tracked)) merged[r.id] = "parts" in r ? r : (runs[r.id] ?? placeholder(r.id, r.input));
    return Object.values(merged).sort((a, b) => a.createdAt - b.createdAt);
  }, [runs, tracked]);

  // optimistic: the message is in the history right away, the request catches up behind it
  const send = async (text: string, origin?: SendOrigin) => {
    const id = nanoid(21);
    setRuns((prev) => ({ ...prev, [id]: placeholder(id, text) }));
    setSent({ id, from: origin ?? null });
    try {
      await startRun(text, id);
      return true;
    } catch {
      setRuns((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return false;
    }
  };

  const day = fmt({ weekday: "short", month: "short", day: "numeric" }, timezone);

  // the chat scrolls the page itself; header and composer float over it, the panel sits on the right (xl)
  return (
    <div className="min-h-dvh bg-bg" style={{ "--composer-h": `${composerH || 140}px` } as CSSProperties}>
      <header className={cn("glass fixed inset-x-0 top-0 z-30 border-b border-line px-3 pt-safe", BESIDE_PANEL)}>
        <div className="mx-auto grid h-13 max-w-[760px] grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
          <button
            type="button"
            onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
            className="tap inline-flex h-9 items-center justify-self-start rounded-full pr-3 pl-1.5 text-[15px] font-medium text-ink-2 hover:bg-sunken"
          >
            <ChevronLeft className="size-5" strokeWidth={2} />
            Back
          </button>
          <div className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-ink">
            <Timi size={26} mood={list.some((r) => r.status === "running") ? "thinking" : "idle"} />
            Timi
          </div>
          <div className="flex items-center gap-1 justify-self-end">
            <button
              type="button"
              onClick={() => setTodayOpen(true)}
              aria-label="Today's plan and tasks"
              className="tap grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sunken xl:hidden"
            >
              <ListChecks className="size-[18px]" />
            </button>
            <Link href="/settings/ai" aria-label="AI settings" className="tap grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sunken">
              <Settings2 className="size-[18px]" />
            </Link>
          </div>
        </div>
      </header>

      <div
        ref={contentRef}
        role="log"
        className={cn("px-4 pt-[calc(var(--safe-top)+68px)] pb-[calc(var(--composer-h)+20px)] sm:px-6", BESIDE_PANEL)}
      >
        <div className="mx-auto w-full max-w-[760px]">
          {list.length === 0 && <EmptyState onPick={send} />}
          {list.map((run, i) => {
            const newDay = i === 0 || day.format(run.createdAt) !== day.format(list[i - 1].createdAt);
            return (
              <div key={run.id}>
                {newDay && (
                  <div className="my-6 flex items-center gap-3 text-[11.5px] font-medium tracking-wide text-ink-3 uppercase">
                    <span className="h-px flex-1 bg-line" />
                    {day.format(run.createdAt)}
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <RunView
                  run={run}
                  timezone={timezone}
                  sentFrom={sent?.id === run.id ? sent.from : undefined}
                  onUndone={() => setRuns((p) => ({ ...p, [run.id]: { ...run, undone: true } }))}
                />
              </div>
            );
          })}
        </div>
      </div>

      <aside className="fixed top-[calc(var(--safe-top)+68px)] right-4 z-20 hidden w-[300px] xl:block">
        <div className="no-scrollbar max-h-[calc(100dvh-var(--safe-top)-84px)] overflow-y-auto overscroll-contain rounded-[18px] border border-line bg-surface/80 p-1.5 shadow-float backdrop-blur-xl">
          {today}
        </div>
      </aside>
      <Sheet open={todayOpen} onClose={() => setTodayOpen(false)} tall>
        {today}
      </Sheet>

      {/* messages blur out as they pass under the composer */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[calc(var(--composer-h)+36px)] bg-gradient-to-t from-bg via-bg/60 to-transparent backdrop-blur-md [mask-image:linear-gradient(to_top,#000_50%,transparent)]"
      />

      <div
        ref={composerRef}
        className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pt-2 pb-[max(12px,var(--safe-bottom))]", BESIDE_PANEL)}
      >
        <div className="pointer-events-auto relative mx-auto max-w-[760px]">
          {!atBottom && (
            <button
              type="button"
              onClick={() => toBottom()}
              aria-label="Scroll to latest"
              className="tap absolute bottom-full left-1/2 mb-3 grid size-9 -translate-x-1/2 place-items-center rounded-full border border-line bg-surface text-ink-2 shadow-soft animate-in fade-in"
            >
              <ArrowDown className="size-4" />
            </button>
          )}
          <Composer models={models} modelId={modelId} effort={effort} onSend={send} autoFocus={list.length === 0} />
          <p className="mt-2 hidden text-center text-[11.5px] text-ink-3 sm:block">Runs in the background. You can close Timeo; you&apos;ll get a notification.</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Keeps the page pinned to the bottom while replies stream in. Scrolling up lets go;
 * coming back to the bottom (or sending) holds again.
 */
function useStickToBottom(contentRef: RefObject<HTMLElement | null>) {
  const stick = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const toBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    stick.current = true;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
  }, []);
  const release = useCallback(() => {
    stick.current = false;
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let last = root.scrollTop;
    const check = () => {
      const top = root.scrollTop;
      const gap = root.scrollHeight - top - window.innerHeight;
      if (gap < 80) stick.current = true;
      else if (top < last - 2) stick.current = false; // you scrolled up
      last = top;
      setAtBottom(gap < 80);
    };
    const ro = new ResizeObserver(() => {
      if (stick.current) window.scrollTo({ top: root.scrollHeight, behavior: "instant" });
      check();
    });
    if (contentRef.current) ro.observe(contentRef.current);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    if (!location.hash) window.scrollTo({ top: root.scrollHeight, behavior: "instant" });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [contentRef]);

  return { atBottom, toBottom, release };
}

/** An element's live height. */
function useHeight(ref: RefObject<HTMLElement | null>) {
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return h;
}

/** Your message. A just-sent one animates in: from where its text sat in the composer, or rising from below. */
function UserBubble({ text, sentFrom }: { text: string; sentFrom?: SendOrigin | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef<SendOrigin | null>(undefined);
  useLayoutEffect(() => {
    const el = ref.current;
    // once per send (Strict Mode re-runs effects, and a second measure would include the transform)
    if (!el || sentFrom === undefined || played.current === sentFrom) return;
    played.current = sentFrom;
    const spring = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 } as const;
    if (!sentFrom) {
      animate(el, { y: [28, 0], opacity: [0, 1], scale: [0.96, 1] }, spring);
      return;
    }
    // px-4 / py-2.5 on the bubble: line its text up with the composer's, then let it go
    const box = el.getBoundingClientRect();
    animate(el, { x: [sentFrom.x - (box.left + 16), 0], y: [sentFrom.y - (box.top + 10), 0], opacity: [0.5, 1] }, spring);
  }, [sentFrom]);

  return (
    <div className="flex justify-end">
      <div
        ref={ref}
        className="max-w-[85%] rounded-[20px] rounded-br-md bg-surface px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-ink shadow-soft ring-1 ring-line will-change-transform"
      >
        {text}
      </div>
    </div>
  );
}

function placeholder(id: string, input: string): AssistantRun {
  return { id, input, reply: null, status: "running", error: null, parts: [], saved: 0, undone: false, model: "", ms: null, createdAt: Date.now() };
}

function RunView({
  run,
  timezone,
  sentFrom,
  onUndone,
}: {
  run: AssistantRun;
  timezone: string;
  sentFrom?: SendOrigin | null;
  onUndone: () => void;
}) {
  const parts = run.parts as AiPart[];
  const running = run.status === "running";
  const now = useNow(running);
  const finalIdx = parts.map((p, i) => (p.type === "text" ? i : -1)).filter((i) => i >= 0).pop();
  const answer = running ? undefined : finalIdx != null ? (parts[finalIdx] as { text: string }).text : (run.reply ?? undefined);
  const steps = parts.filter((p, i) => !(p.type === "text" && i === finalIdx && !running));
  const saved = parts.flatMap((p) => (p.type === "tool" ? (((p.output as { saved?: SavedItem[] } | undefined)?.saved) ?? []) : []));
  const lastTool = [...parts].reverse().find((p) => p.type === "tool") as Extract<AiPart, { type: "tool" }> | undefined;
  const elapsed = running ? (now ? Math.max(0, now - run.createdAt) : 0) : (run.ms ?? 0);
  const time = fmt({ hour: "numeric", minute: "2-digit" }, timezone).format(run.createdAt);

  return (
    <article id={`run-${run.id}`} className="scroll-mt-24 py-4">
      <UserBubble text={run.input} sentFrom={sentFrom} />

      {/* Timi */}
      <div className={cn("mt-4 space-y-3", sentFrom !== undefined && "animate-in fade-in fill-mode-both delay-150 duration-300")}>
        {(steps.length > 0 || running) && (
          <Collapsible>
            <CollapsibleTrigger className="group tap flex max-w-full items-center gap-1.5 rounded-lg py-0.5 text-[13px] text-ink-3 hover:text-ink-2">
              <Timi size={22} mood={running ? "thinking" : run.status === "error" ? "error" : "idle"} className="-my-1" />
              {running ? (
                <Shimmer className="text-[13px]">{`Working${elapsed ? ` · ${Math.round(elapsed / 1000)}s` : ""}${lastTool ? ` · ${toolLabel(lastTool.name, false)}` : ""}`}</Shimmer>
              ) : (
                <span>Worked for {secs(elapsed)}</span>
              )}
              {steps.length > 0 && <ChevronRight className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <ol className="mt-2.5 space-y-2 border-l border-line pl-3.5">
                {steps.map((p, i) => (
                  <Step key={i} part={p} />
                ))}
              </ol>
            </CollapsibleContent>
          </Collapsible>
        )}

        {run.status === "error" && (
          <p className="flex items-start gap-2 rounded-2xl bg-bad-soft px-4 py-3 text-[14px] font-medium text-bad">
            <Timi size={22} mood="error" className="-my-0.5" />
            Couldn&apos;t finish. {run.error?.slice(0, 180)}
          </p>
        )}

        {answer && (
          <div className={cn("text-[15.5px] leading-7 text-ink [&_li]:my-1 [&_strong]:font-semibold", run.undone && "opacity-50")}>
            <MessageResponse>{answer}</MessageResponse>
          </div>
        )}

        {saved.length > 0 && (
          <ul className={cn("space-y-1.5 rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-line", run.undone && "opacity-50")}>
            {saved.slice(0, 8).map((s, i) => {
              const Icon = ICONS[s.icon ?? "check"] ?? Check;
              return (
                <li key={i} className={cn("flex items-center gap-2.5 text-[13.5px] text-ink-2", run.undone && "line-through")}>
                  <span className="grid size-5 shrink-0 place-items-center rounded-md bg-ok-soft text-ok">
                    <Icon className="size-3" strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 truncate">{s.label}</span>
                </li>
              );
            })}
            {saved.length > 8 && <li className="pl-7.5 text-[12.5px] text-ink-3">+{saved.length - 8} more</li>}
          </ul>
        )}

        {!running && <Actions run={run} answer={answer} time={time} onUndone={onUndone} />}
      </div>
    </article>
  );
}

function Step({ part }: { part: AiPart }) {
  if (part.type === "reasoning")
    return (
      <li className="flex gap-2 text-[12.5px] leading-relaxed text-ink-3">
        <BookOpen className="mt-0.5 size-3.5 shrink-0" />
        <span className="line-clamp-4 whitespace-pre-wrap italic">{part.text}</span>
      </li>
    );
  if (part.type === "text") return <li className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink-3">{part.text}</li>;
  const output = part.output as { saved?: SavedItem[]; ok?: boolean; error?: string } | undefined;
  const failed = part.state === "error" || output?.ok === false;
  const n = output?.saved?.length ?? 0;
  return (
    <li className={cn("flex items-center gap-2 text-[13px]", failed ? "text-bad" : part.name.startsWith("get_") ? "text-ink-3" : "text-ink-2")}>
      {failed ? <AlertCircle className="size-3.5 shrink-0" /> : <Check className="size-3.5 shrink-0 text-ok" strokeWidth={2.6} />}
      <span className="truncate">
        {toolLabel(part.name)}
        {n > 0 && <span className="text-ink-3"> · {n}</span>}
        {failed && (output?.error || part.error) && <span> · {output?.error ?? part.error}</span>}
      </span>
    </li>
  );
}

function Actions({ run, answer, time, onUndone }: { run: AssistantRun; answer?: string; time: string; onUndone: () => void }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = async () => {
    const savedText = (run.parts as AiPart[])
      .flatMap((p) => (p.type === "tool" ? (((p.output as { saved?: SavedItem[] } | undefined)?.saved) ?? []) : []))
      .map((s) => `- ${s.label}`)
      .join("\n");
    await navigator.clipboard.writeText([answer, savedText].filter(Boolean).join("\n\n") || run.input).catch(() => {});
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  const btn = "tap inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-ink-3 hover:bg-sunken hover:text-ink-2";
  return (
    <div className="-ml-2.5 flex items-center gap-0.5">
      <button type="button" onClick={copy} className={btn} aria-label="Copy reply">
        {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      {run.saved > 0 &&
        run.status === "done" &&
        (run.undone ? (
          <span className="px-2.5 text-[12.5px] font-medium text-ink-3">Undone</span>
        ) : (
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() =>
              start(async () => {
                await undoTell(run.id);
                onUndone();
                router.refresh();
              })
            }
          >
            <Undo2 className="size-3.5" />
            Undo
          </button>
        ))}
      <span className="ml-auto pr-1 text-[11.5px] text-ink-3 tabular-nums">
        {time}
        {run.ms != null && ` · ${secs(run.ms)}`}
      </span>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => Promise<boolean> }) {
  return (
    <div className="flex min-h-[60dvh] flex-col justify-end gap-6 pb-4">
      <div>
        <Timi size={112} interactive className="-ml-2 mb-2" />
        <h1 className="display text-[36px] text-ink">What&apos;s up?</h1>
        <p className="mt-1.5 max-w-[36ch] text-[15px] leading-relaxed text-ink-2">
          Log a workout or a meal, plan your week, set goals, or ask about your data.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="tap h-9 rounded-full bg-surface px-3.5 text-[13.5px] font-medium text-ink-2 shadow-soft ring-1 ring-line hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
