"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, type ToolUIPart, type UIMessage } from "ai";
import {
  CalendarPlus,
  Check,
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
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
import type { AssistantMetadata, SavedItem } from "@/lib/ai/shared";
import { cn } from "@/lib/cn";

type AssistantMessage = UIMessage<AssistantMetadata>;

const STORAGE_KEY = "timeo.assistant.v1";

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

// Friendly names for tool calls, shown while running and when done.
const TOOL_LABEL: Record<string, [running: string, done: string]> = {
  log_workout: ["Logging workout", "Workout logged"],
  log_meal: ["Logging meal", "Meal logged"],
  add_water: ["Adding water", "Water added"],
  log_body: ["Saving measurement", "Measurement saved"],
  log_day: ["Saving", "Saved"],
  add_task: ["Adding task", "Task added"],
  complete_task: ["Completing task", "Task done"],
  get_day: ["Reading your day", "Read your day"],
  get_training: ["Reading training", "Read training"],
  get_nutrition: ["Reading nutrition", "Read nutrition"],
  get_body: ["Reading body stats", "Read body stats"],
  get_focus: ["Reading focus", "Read focus"],
  get_plan: ["Reading your plan", "Read your plan"],
  get_week: ["Reading your week", "Read your week"],
  create_season: ["Creating season", "Season created"],
  add_goals: ["Adding goals", "Goals added"],
  update_goal: ["Updating goal", "Goal updated"],
  add_milestones: ["Adding milestones", "Milestones added"],
  complete_milestone: ["Completing milestone", "Milestone done"],
  add_weekly_steps: ["Adding weekly steps", "Weekly steps added"],
  add_blocks: ["Blocking time", "Time blocked"],
  move_block: ["Moving block", "Block moved"],
  protect_time: ["Protecting time", "Time protected"],
  set_gym_day: ["Updating gym split", "Gym split updated"],
  log_reflection: ["Saving reflection", "Reflection saved"],
};

function loadMessages(): AssistantMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AssistantMessage[]) : [];
  } catch {
    return [];
  }
}

export function Assistant({ modelName }: { modelName: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [undone, setUndone] = useState<Set<string>>(() => new Set());

  const { messages, sendMessage, status, stop, setMessages, error } = useChat<AssistantMessage>({
    id: "timeo-assistant",
    transport: new DefaultChatTransport({
      api: "/api/assistant",
      prepareSendMessagesRequest: ({ id, messages }) => ({ body: { id, messages: messages.slice(-6) } }),
    }),
    onFinish: ({ message }) => {
      if (message.metadata?.saved) router.refresh();
    },
  });

  // restore this tab's conversation, then auto-send ?q= from the Today bar
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const saved = loadMessages();
    if (saved.length) setMessages(saved);
    const q = params.get("q");
    if (q) {
      sendMessage({ text: q });
      router.replace("/assistant", { scroll: false });
    }
  }, [params, router, sendMessage, setMessages]);

  useEffect(() => {
    if (status !== "ready" && status !== "error") return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages, status]);

  const send = (value: string) => {
    const v = value.trim();
    if (!v || status === "submitted" || status === "streaming") return;
    sendMessage({ text: v });
    setText("");
  };

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const waiting = status === "submitted" || (status === "streaming" && last?.role === "assistant" && last.parts.length <= 1);

  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col" data-status={status}>
        <header className="glass sticky top-0 z-20 shrink-0 border-b border-line px-4 pt-safe">
          <div className="mx-auto flex h-14 max-w-[720px] items-center justify-between gap-3">
            <button type="button" onClick={() => router.back()} className="tap -ml-1 rounded-full px-2 py-1 text-[15px] font-medium text-accent">
              Done
            </button>
            <div className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              <Sparkles className="size-4 text-accent" />
              Timeo
            </div>
            <button
              type="button"
              disabled={!messages.length || busy}
              onClick={() => {
                setMessages([]);
                sessionStorage.removeItem(STORAGE_KEY);
              }}
              className="tap rounded-full px-2 py-1 text-[15px] font-medium text-ink-2 disabled:opacity-30"
            >
              Clear
            </button>
          </div>
        </header>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-[720px] gap-6 px-4 pt-6 pb-8">
            {messages.length === 0 && <EmptyState onPick={send} />}
            {messages.map((m) => (
              <Message key={m.id} from={m.role} className={m.role === "user" ? "max-w-[85%]" : "max-w-full"}>
                <MessageContent className={cn(m.role === "user" ? "rounded-[20px] rounded-br-md px-4 py-2.5 text-[15px]" : "w-full gap-2.5 text-[15.5px] leading-relaxed")}>
                  {m.parts.map((part, i) => {
                    if (part.type === "text")
                      return m.role === "user" ? <p key={i} className="whitespace-pre-wrap">{part.text}</p> : <MessageResponse key={i}>{part.text}</MessageResponse>;
                    if (part.type === "reasoning" && part.text.trim())
                      return (
                        <Reasoning key={i} isStreaming={status === "streaming" && m.id === last?.id && i === m.parts.length - 1} className="mb-0">
                          <ReasoningTrigger className="text-[13px]" />
                          <ReasoningContent className="text-[13px]">{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    if (isToolUIPart(part)) return <ToolCard key={i} part={part as ToolUIPart} />;
                    return null;
                  })}
                </MessageContent>
                {m.role === "assistant" && m.metadata?.ms != null && (
                  <MessageActions className="-mt-1 justify-between text-[11.5px] text-ink-3">
                    <span>
                      {m.metadata.model} · {(m.metadata.ms / 1000).toFixed(1)}s
                    </span>
                    {!!m.metadata.saved && (
                      <UndoButton
                        commandId={m.metadata.commandId}
                        done={undone.has(m.metadata.commandId)}
                        onDone={(id) => setUndone((s) => new Set(s).add(id))}
                      />
                    )}
                  </MessageActions>
                )}
              </Message>
            ))}
            {waiting && (
              <div className="px-1">
                <Shimmer className="text-[14px]">Working on it…</Shimmer>
              </div>
            )}
            {error && (
              <p className="rounded-2xl bg-bad-soft px-4 py-3 text-[14px] font-medium text-bad">
                Couldn&apos;t finish that. {error.message.slice(0, 160)}
              </p>
            )}
          </ConversationContent>
          <ConversationScrollButton className="bottom-4" />
        </Conversation>

        <div className="shrink-0 border-t border-line bg-bg px-3 pt-2.5 pb-[max(12px,var(--safe-bottom))]">
          <div className="mx-auto max-w-[720px]">
            <PromptInput
              onSubmit={(msg) => send(msg.text ?? "")}
              className="rounded-[24px] border-line bg-surface shadow-soft [&_[data-slot=input-group]]:rounded-[24px]"
            >
              <PromptInputBody>
                <PromptInputTextarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Log, plan or ask…"
                  className="min-h-12 text-[16px] focus-visible:outline-none"
                  enterKeyHint="send"
                  autoFocus={!params.get("q")}
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputSpeechButton textareaRef={textareaRef} onTranscriptionChange={setText} />
                  <Link href="/settings/ai" className="tap truncate rounded-full px-2.5 py-1 text-[12.5px] font-medium text-ink-3 hover:bg-sunken">
                    {modelName}
                  </Link>
                </PromptInputTools>
                <PromptInputSubmit status={status} disabled={!busy && !text.trim()} onClick={busy ? (e) => (e.preventDefault(), stop()) : undefined} className="rounded-full" />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </TooltipProvider>
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
          Log a workout or meal, plan your week, set goals, or ask anything about your data.
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

function ToolCard({ part }: { part: ToolUIPart }) {
  const name = getToolName(part);
  const [running, done] = TOOL_LABEL[name] ?? [name.replace(/_/g, " "), name.replace(/_/g, " ")];
  const output = part.state === "output-available" ? (part.output as { saved?: SavedItem[]; ok?: boolean; error?: string } | undefined) : undefined;
  const saved = output?.saved ?? [];
  const failed = part.state === "output-error" || output?.ok === false;
  const isRead = name.startsWith("get_");

  return (
    <Tool className={cn("mb-0 overflow-hidden rounded-[18px] border-line bg-surface", isRead && !failed && "border-transparent bg-transparent")}>
      <ToolHeader
        type={part.type as ToolUIPart["type"]}
        state={part.state}
        title={part.state === "output-available" && !failed ? done : failed ? `${done.split(" ")[0]} failed` : running}
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
      {failed && output?.error && <p className="border-t border-line px-3.5 py-2.5 text-[13px] text-bad">{output.error}</p>}
      <ToolContent className="border-t border-line text-[12px]">
        <ToolInput input={part.input} />
        <ToolOutput output={part.state === "output-available" ? part.output : undefined} errorText={part.state === "output-error" ? part.errorText : undefined} />
      </ToolContent>
    </Tool>
  );
}

function UndoButton({ commandId, done, onDone }: { commandId: string; done: boolean; onDone: (id: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (done) return <span className="text-[12px] font-medium text-ink-3">Undone</span>;
  return (
    <MessageAction
      label="Undo"
      tooltip="Undo everything this reply saved"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await undoTell(commandId);
          onDone(commandId);
          router.refresh();
        })
      }
      className="h-7 gap-1 rounded-full px-2.5 text-[12.5px] font-semibold text-ink-2"
    >
      <Undo2 className="size-3.5" /> Undo
    </MessageAction>
  );
}
