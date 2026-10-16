"use client";

import {
  CalendarPlus,
  Check,
  ChevronLeft,
  Droplet,
  Dumbbell,
  Flag,
  Moon,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Undo2,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { undoTell } from "@/actions/ai";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageAction, MessageActions, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSpeechButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import type { AiPart } from "@/db/schema";
import { onRunFinished, startRun, useRuns } from "@/lib/ai/runs-client";
import type { AssistantRun, SavedItem } from "@/lib/ai/shared";
import { cn } from "@/lib/cn";

const SUGGESTIONS = [
  "Plan my week",
  "How are my goals doing?",
  "Log Push A: incline 20×10, 22.5×8",
  "2 rotis, dal and paneer for lunch",
  "Protein left today?",
  "Start a new season",
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

// Friendly names for tool calls.
const TOOL_LABEL: Record<string, string> = {
  log_workout: "Workout logged",
  log_meal: "Meal logged",
  add_water: "Water added",
  log_body: "Measurement saved",
  log_day: "Saved",
  add_task: "Task added",
  complete_task: "Task done",
  get_day: "Read your day",
  get_training: "Read training",
  get_nutrition: "Read nutrition",
  get_body: "Read body stats",
  get_focus: "Read focus",
  get_plan: "Read your plan",
  get_week: "Read your week",
  create_season: "Season created",
  add_goals: "Goals added",
  update_goal: "Goal updated",
  add_milestones: "Milestones added",
  complete_milestone: "Milestone done",
  add_weekly_steps: "Weekly steps added",
  add_blocks: "Time blocked",
  move_block: "Block moved",
  protect_time: "Time protected",
  set_gym_day: "Gym split updated",
  log_reflection: "Reflection saved",
};

// formatted in the account's timezone so server and client render the same text
const timeLabel = (ms: number, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(ms);

/**
 * Assistant history. Every message runs in the background on the server, so
 * you can leave this screen (or close the app) and come back to the result.
 */
export function Assistant({ initialRuns, modelName, timezone }: { initialRuns: AssistantRun[]; modelName: string; timezone: string }) {
  const router = useRouter();
  const [runs, setRuns] = useState<Record<string, AssistantRun>>(() => Object.fromEntries(initialRuns.map((r) => [r.id, r])));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { tracked } = useRuns();

  useEffect(() => onRunFinished((run) => setRuns((prev) => ({ ...prev, [run.id]: run }))), []);

  // jump to a run opened from a notification (/assistant#<id>)
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 300);
  }, []);

  // runs in progress (started here or on any other screen) overlay the saved history
  const list = useMemo(() => {
    const merged: Record<string, AssistantRun> = { ...runs };
    for (const r of Object.values(tracked)) merged[r.id] = "parts" in r ? r : (runs[r.id] ?? placeholder(r.id, r.input));
    return Object.values(merged).sort((a, b) => a.createdAt - b.createdAt);
  }, [runs, tracked]);
  const busy = list.some((r) => r.status === "running");

  const send = async (value: string) => {
    const v = value.trim();
    if (!v || sending) return;
    setSending(true);
    setText("");
    try {
      const id = await startRun(v);
      setRuns((prev) => ({ ...prev, [id]: placeholder(id, v) }));
    } catch {
      setText(v);
    } finally {
      setSending(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col">
        <header className="glass sticky top-0 z-20 shrink-0 border-b border-line px-4 pt-safe">
          <div className="mx-auto flex h-14 max-w-[720px] items-center justify-between gap-3">
            <button type="button" onClick={() => (history.length > 1 ? router.back() : router.push("/"))} className="tap -ml-1.5 inline-flex items-center rounded-full px-1.5 py-1 text-[15px] font-medium text-accent">
              <ChevronLeft className="size-5" strokeWidth={2.2} />
              Back
            </button>
            <div className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              <Sparkles className="size-4 text-accent" />
              Timeo
            </div>
            <Link href="/settings/ai" className="tap max-w-[110px] truncate rounded-full px-2 py-1 text-right text-[13px] font-medium text-ink-3">
              {modelName}
            </Link>
          </div>
        </header>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-[720px] gap-7 px-4 pt-6 pb-8">
            {list.length === 0 && <EmptyState onPick={send} />}
            {list.map((run, i) => {
              const showDate = i === 0 || run.createdAt - list[i - 1].createdAt > 3 * 3600_000;
              return (
                <div key={run.id} id={run.id} className="flex scroll-mt-20 flex-col gap-3">
                  {showDate && <div className="text-center text-[11.5px] font-medium text-ink-3">{timeLabel(run.createdAt, timezone)}</div>}
                  <Message from="user" className="max-w-[85%]">
                    <MessageContent className="rounded-[20px] rounded-br-md px-4 py-2.5 text-[15px]">
                      <p className="whitespace-pre-wrap">{run.input}</p>
                    </MessageContent>
                  </Message>
                  <RunReply run={run} onUndone={() => setRuns((p) => ({ ...p, [run.id]: { ...run, undone: true } }))} />
                </div>
              );
            })}
          </ConversationContent>
          <ConversationScrollButton className="bottom-4" />
        </Conversation>

        <div className="shrink-0 border-t border-line bg-bg px-3 pt-2.5 pb-[max(12px,var(--safe-bottom))]">
          <div className="mx-auto max-w-[720px]">
            <PromptInput onSubmit={(msg) => send(msg.text ?? "")} className="rounded-[24px] border-line bg-surface shadow-soft [&_[data-slot=input-group]]:rounded-[24px]">
              <PromptInputBody>
                <PromptInputTextarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Log, plan or ask…"
                  className="min-h-12 text-[16px] focus-visible:outline-none"
                  enterKeyHint="send"
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputSpeechButton textareaRef={textareaRef} onTranscriptionChange={setText} />
                  {busy && <span className="px-1 text-[12.5px] text-ink-3">Runs in the background. You can leave.</span>}
                </PromptInputTools>
                <PromptInputSubmit status={sending ? "submitted" : "ready"} disabled={!text.trim() || sending} className="rounded-full" />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function placeholder(id: string, input: string): AssistantRun {
  return { id, input, reply: null, status: "running", error: null, parts: [], saved: 0, undone: false, model: "", ms: null, createdAt: Date.now() };
}

function RunReply({ run, onUndone }: { run: AssistantRun; onUndone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const parts = run.parts as AiPart[];
  const lastText = parts.map((p, i) => (p.type === "text" ? i : -1)).filter((i) => i >= 0).pop();

  return (
    <Message from="assistant" className="max-w-full">
      <MessageContent className={cn("w-full gap-2.5 text-[15.5px] leading-relaxed", run.undone && "opacity-55")}>
        {parts.map((p, i) => {
          if (p.type === "reasoning")
            return (
              <Reasoning key={i} isStreaming={false} defaultOpen={false} className="mb-0">
                <ReasoningTrigger className="text-[13px]" />
                <ReasoningContent className="text-[13px]">{p.text}</ReasoningContent>
              </Reasoning>
            );
          if (p.type === "tool") return <ToolCard key={i} part={p} />;
          // intermediate text between tool steps is shown small; the final answer full size
          return i === lastText ? <MessageResponse key={i}>{p.text}</MessageResponse> : <p key={i} className="text-[13.5px] text-ink-3">{p.text}</p>;
        })}
        {run.status === "running" && <Shimmer className="text-[14px]">{parts.length ? "Still working…" : "Working on it…"}</Shimmer>}
        {run.status === "error" && <p className="rounded-2xl bg-bad-soft px-4 py-3 text-[14px] font-medium text-bad">Couldn&apos;t finish. {run.error?.slice(0, 160)}</p>}
        {run.status === "done" && !parts.some((p) => p.type === "text") && run.reply && <MessageResponse>{run.reply}</MessageResponse>}
      </MessageContent>
      {run.status !== "running" && (
        <MessageActions className="-mt-1 justify-between text-[11.5px] text-ink-3">
          <span>{run.ms != null ? `${(run.ms / 1000).toFixed(1)}s` : ""}</span>
          {!!run.saved && run.status === "done" &&
            (run.undone ? (
              <span className="text-[12px] font-medium">Undone</span>
            ) : (
              <MessageAction
                label="Undo"
                tooltip="Undo everything this saved"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await undoTell(run.id);
                    onUndone();
                    router.refresh();
                  })
                }
                className="h-7 gap-1 rounded-full px-2.5 text-[12.5px] font-semibold text-ink-2"
              >
                <Undo2 className="size-3.5" /> Undo
              </MessageAction>
            ))}
        </MessageActions>
      )}
    </Message>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex flex-1 flex-col justify-end gap-6 pt-[12vh]">
      <div>
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Sparkles className="size-5" />
        </div>
        <h1 className="display text-[34px] text-ink">What&apos;s up?</h1>
        <p className="mt-1.5 max-w-[34ch] text-[15px] leading-relaxed text-ink-2">
          Log a workout or meal, plan your week, set goals, or ask about your data. It runs in the background.
        </p>
      </div>
      <Suggestions className="-mx-4 px-4">
        {SUGGESTIONS.map((s) => (
          <Suggestion key={s} suggestion={s} onClick={onPick} className="h-9 rounded-full border-line bg-surface px-3.5 text-[13.5px] font-medium text-ink-2" />
        ))}
      </Suggestions>
    </div>
  );
}

function ToolCard({ part }: { part: Extract<AiPart, { type: "tool" }> }) {
  const label = TOOL_LABEL[part.name] ?? part.name.replace(/_/g, " ");
  const output = part.output as { saved?: SavedItem[]; ok?: boolean; error?: string } | undefined;
  const saved = output?.saved ?? [];
  const failed = part.state === "error" || output?.ok === false;
  const isRead = part.name.startsWith("get_");
  const state = failed ? "output-error" : "output-available";

  return (
    <Tool className={cn("mb-0 overflow-hidden rounded-[18px] border-line bg-surface", isRead && !failed && "border-transparent bg-transparent")}>
      <ToolHeader
        type={`tool-${part.name}`}
        state={state}
        title={failed ? `${label.split(" ")[0]} failed` : label}
        className={cn("px-3.5 py-2.5 text-ink [&_.font-medium]:text-[13.5px]", isRead && "px-1 py-1 text-ink-3 [&_.font-medium]:font-normal")}
      />
      {saved.length > 0 && (
        <ul className="space-y-1.5 border-t border-line px-3.5 py-3">
          {saved.map((s, i) => {
            const Icon = ICONS[s.icon ?? "check"] ?? Check;
            return (
              <li key={i} className="flex items-center gap-2.5 text-[13.5px] text-ink-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-ok-soft text-ok">
                  <Icon className="size-3" strokeWidth={2.4} />
                </span>
                <span className="min-w-0 truncate">{s.label}</span>
              </li>
            );
          })}
        </ul>
      )}
      {failed && (output?.error || part.error) && <p className="border-t border-line px-3.5 py-2.5 text-[13px] text-bad">{output?.error ?? part.error}</p>}
      <ToolContent className="border-t border-line text-[12px]">
        <ToolInput input={part.input} />
        <ToolOutput output={part.output} errorText={part.error} />
      </ToolContent>
    </Tool>
  );
}
