"use client";

import {
  AlertCircle,
  BookOpen,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Droplet,
  Dumbbell,
  Flag,
  Moon,
  Plus,
  Scale,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Undo2,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { undoTell } from "@/actions/ai";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import type { AiPart } from "@/db/schema";
import { onRunFinished, startRun, useRuns } from "@/lib/ai/runs-client";
import type { AssistantRun, Effort, SavedItem } from "@/lib/ai/shared";
import { cn } from "@/lib/cn";
import { Composer, type ModelChoice } from "./composer";

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
};

/**
 * Assistant history. Every message runs in the background on the server, so
 * you can leave (or close the app) and come back to the result. A run opened
 * from a notification (/assistant#<id>) is scrolled into view.
 */
export function Assistant({ initialRuns, timezone, models, modelId, effort }: Props) {
  const router = useRouter();
  const [runs, setRuns] = useState<Record<string, AssistantRun>>(() => Object.fromEntries(initialRuns.map((r) => [r.id, r])));
  const [sending, setSending] = useState(false);
  const { tracked } = useRuns();

  useEffect(() => onRunFinished((run) => setRuns((prev) => ({ ...prev, [run.id]: run }))), []);

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

  // runs in progress (started here or on any other screen) overlay the saved history
  const list = useMemo(() => {
    const merged: Record<string, AssistantRun> = { ...runs };
    for (const r of Object.values(tracked)) merged[r.id] = "parts" in r ? r : (runs[r.id] ?? placeholder(r.id, r.input));
    return Object.values(merged).sort((a, b) => a.createdAt - b.createdAt);
  }, [runs, tracked]);

  const send = async (text: string) => {
    setSending(true);
    try {
      const id = await startRun(text);
      setRuns((prev) => ({ ...prev, [id]: placeholder(id, text) }));
      return true;
    } catch {
      return false;
    } finally {
      setSending(false);
    }
  };

  const day = fmt({ weekday: "short", month: "short", day: "numeric" }, timezone);

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="glass sticky top-0 z-20 shrink-0 border-b border-line px-3 pt-safe">
        <div className="mx-auto flex h-13 max-w-[760px] items-center justify-between gap-3 py-2">
          <button
            type="button"
            onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
            className="tap inline-flex h-9 items-center rounded-full pr-3 pl-1.5 text-[15px] font-medium text-ink-2 hover:bg-sunken"
          >
            <ChevronLeft className="size-5" strokeWidth={2} />
            Back
          </button>
          <div className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-ink">
            <Sparkles className="size-4 text-accent" />
            Timi
          </div>
          <Link href="/settings/ai" aria-label="AI settings" className="tap grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sunken">
            <Settings2 className="size-[18px]" />
          </Link>
        </div>
      </header>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-[760px] gap-0 px-4 pt-4 pb-10 sm:px-6">
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
                  onUndone={() => setRuns((p) => ({ ...p, [run.id]: { ...run, undone: true } }))}
                />
              </div>
            );
          })}
        </ConversationContent>
        <ConversationScrollButton className="bottom-4 border-line bg-surface shadow-soft" />
        <ScrollToRun focus={focus} />
      </Conversation>

      <div className="shrink-0 bg-gradient-to-t from-bg via-bg to-transparent px-3 pt-2 pb-[max(12px,var(--safe-bottom))]">
        <div className="mx-auto max-w-[760px]">
          <Composer models={models} modelId={modelId} effort={effort} onSend={send} sending={sending} autoFocus={list.length === 0} />
          <p className="mt-2 hidden text-center text-[11.5px] text-ink-3 sm:block">Runs in the background. You can close Timeo; you&apos;ll get a notification.</p>
        </div>
      </div>
    </div>
  );
}

/** Scrolls an opened run into view. Lives inside the chat scroller so it can release its stick-to-bottom hold first. */
function ScrollToRun({ focus }: { focus: { id: string; at: number } | null }) {
  const { stopScroll } = useStickToBottomContext();
  useEffect(() => {
    if (!focus) return;
    const go = () => {
      stopScroll();
      document.getElementById(`run-${focus.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    const timers = [setTimeout(go, 150), setTimeout(go, 700)];
    return () => timers.forEach(clearTimeout);
  }, [focus, stopScroll]);
  return null;
}

function placeholder(id: string, input: string): AssistantRun {
  return { id, input, reply: null, status: "running", error: null, parts: [], saved: 0, undone: false, model: "", ms: null, createdAt: Date.now() };
}

function RunView({
  run,
  timezone,
  onUndone,
}: {
  run: AssistantRun;
  timezone: string;
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
      {/* you */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-surface px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-ink shadow-soft ring-1 ring-line">
          {run.input}
        </div>
      </div>

      {/* Timi */}
      <div className="mt-4 space-y-3">
        {(steps.length > 0 || running) && (
          <Collapsible>
            <CollapsibleTrigger className="group tap flex max-w-full items-center gap-1.5 rounded-lg py-0.5 text-[13px] text-ink-3 hover:text-ink-2">
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
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
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
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Sparkles className="size-5" />
        </div>
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
