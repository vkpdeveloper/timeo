"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import {
  Activity,
  CalendarDays,
  CalendarPlus,
  Check,
  CircleCheck,
  Clock,
  Droplet,
  Dumbbell,
  Keyboard,
  LineChart,
  MessagesSquare,
  NotebookPen,
  Plus,
  Scale,
  Settings2,
  Target,
  Timer,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { getPickerContext, type GoalOption } from "@/actions/context";
import { addWater } from "@/actions/health";
import { CommandBar, useTimiSend } from "@/components/ai/command-bar";
import { Timi } from "@/components/ai/timi";
import { BlockSheet, MealSheet, TaskSheet, WeighInSheet } from "@/components/forms/sheets";
import { AppKbd, Keycap, useHasKeyboard, useHotkeyText } from "@/components/ui/kbd";
import { Sheet } from "@/components/ui/sheet";
import { GUIDE_SUGGESTIONS } from "@/lib/ai/guide";
import { cn } from "@/lib/cn";
import { colorVar, softVar, type PaletteColor } from "@/lib/colors";
import { appHotkeys, type AppHotkeyId } from "@/lib/hotkeys";

/*
 * The one entry point for creating anything: Timi's input on top, quick
 * actions under it. Typing filters the actions; text that matches none goes
 * to Timi. One <AskHost /> lives in each app layout; ⌘K or openAsk() opens
 * it, openAsk("task") goes straight into a form.
 */

type Form = "task" | "block" | "meal" | "weight";
type Mode = null | "menu" | Form;
/** "water" logs 250 ml and shows it on the Water tile. */
type Target = Form | "water";

const EVENT = "timeo:ask";

/** Opens the Ask sheet, or one of its forms directly. */
export function openAsk(target?: Target) {
  window.dispatchEvent(new CustomEvent<Target | undefined>(EVENT, { detail: target }));
}

type Action = { form: Form } | { href: string } | { water: number } | { prompt: string };

type Item = {
  id: string;
  label: string;
  /** Other words that should find it. */
  keywords?: string;
  icon: LucideIcon | "timi";
  /** Palette colour for the icon tile; none is a neutral tile. */
  color?: PaletteColor;
  group: "Add" | "Go to" | "Ask Timi";
  hotkey?: AppHotkeyId;
  action: Action;
};

const ADD: Item[] = [
  { id: "task", label: "Task", keywords: "todo to-do new", icon: CircleCheck, color: "sky", group: "Add", hotkey: "add.task", action: { form: "task" } },
  { id: "block", label: "Time block", keywords: "schedule calendar event plan", icon: CalendarPlus, color: "teal", group: "Add", hotkey: "add.block", action: { form: "block" } },
  { id: "focus", label: "Focus session", keywords: "timer pomodoro deep work start", icon: Timer, color: "pine", group: "Add", hotkey: "add.focus", action: { href: "/app/focus" } },
  { id: "workout", label: "Workout", keywords: "gym training exercise lift start log", icon: Dumbbell, color: "olive", group: "Add", action: { href: "/app/fitness" } },
  { id: "meal", label: "Meal", keywords: "food eat log nutrition breakfast lunch dinner", icon: UtensilsCrossed, color: "sand", group: "Add", hotkey: "add.meal", action: { form: "meal" } },
  { id: "water", label: "Water +250 ml", keywords: "drink glass hydration", icon: Droplet, color: "sky", group: "Add", hotkey: "add.water", action: { water: 250 } },
  { id: "weight", label: "Weigh-in", keywords: "weight body scale kg", icon: Scale, color: "sage", group: "Add", hotkey: "add.weight", action: { form: "weight" } },
  { id: "reflect", label: "Reflection", keywords: "journal day note review", icon: NotebookPen, color: "stone", group: "Add", action: { href: "/app/review" } },
];

const GO: Item[] = [
  { id: "now", label: "Now", keywords: "today home", icon: Clock, group: "Go to", hotkey: "nav.now", action: { href: "/app" } },
  { id: "week", label: "Week", keywords: "plan calendar", icon: CalendarDays, group: "Go to", hotkey: "nav.week", action: { href: "/app/plan" } },
  { id: "season", label: "Season", keywords: "goals", icon: Target, group: "Go to", hotkey: "nav.season", action: { href: "/app/goals" } },
  { id: "body", label: "Body", keywords: "fitness health nutrition", icon: Activity, group: "Go to", hotkey: "nav.body", action: { href: "/app/fitness" } },
  { id: "review", label: "Review", keywords: "stats progress", icon: LineChart, group: "Go to", hotkey: "nav.review", action: { href: "/app/review" } },
  { id: "chat", label: "Chat", keywords: "timi assistant conversation history open", icon: MessagesSquare, group: "Go to", hotkey: "nav.chat", action: { href: "/app/assistant" } },
  { id: "settings", label: "Settings", keywords: "preferences account", icon: Settings2, group: "Go to", hotkey: "nav.settings", action: { href: "/app/settings" } },
  { id: "shortcuts", label: "Shortcuts", keywords: "keyboard keys hotkeys", icon: Keyboard, group: "Go to", hotkey: "shortcuts.open", action: { href: "/app/settings/shortcuts" } },
];

const PROMPTS: Item[] = GUIDE_SUGGESTIONS.map((s) => ({
  id: `timi:${s.label}`,
  label: s.label,
  icon: "timi",
  group: "Ask Timi",
  action: { prompt: s.prompt },
}));

const ALL = [...ADD, ...GO, ...PROMPTS];

/** 3: the label starts with the query; 2: every word starts a label word; 1: a keyword matches; 0: no match. */
function score(item: Item, query: string) {
  const label = item.label.toLowerCase();
  if (label.startsWith(query)) return 3;
  const tokens = query.split(/\s+/);
  const labelWords = label.split(/[\s+-]+/);
  if (tokens.every((t) => labelWords.some((w) => w.startsWith(t)))) return 2;
  const words = [...labelWords, ...(item.keywords?.split(/\s+/) ?? [])];
  return tokens.every((t) => words.some((w) => w.startsWith(t))) ? 1 : 0;
}

function search(query: string) {
  const q = query.trim().toLowerCase();
  return ALL.map((item) => ({ item, s: score(item, q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 6)
    .map((r) => r.item);
}

export function AskHost() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [ctx, setCtx] = useState<{ today: string; goals: GoalOption[] } | null>(null);
  const [, start] = useTransition();
  const [waterAdded, setWaterAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const later = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  const close = () => setMode(null);

  const logWater = (thenClose: boolean) => {
    setWaterAdded(true);
    start(async () => {
      await addWater(250);
    });
    later(() => {
      setWaterAdded(false);
      if (thenClose) close();
    }, 1500);
  };

  const open = (target?: Target) => {
    setMode(target && target !== "water" ? target : "menu");
    start(async () => setCtx(await getPickerContext()));
    if (target === "water") logWater(true);
  };

  const onOpen = useEffectEvent((e: Event) => open((e as CustomEvent<Target | undefined>).detail));
  useEffect(() => {
    window.addEventListener(EVENT, onOpen);
    return () => {
      window.removeEventListener(EVENT, onOpen);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // While the menu is open its own ⌘K closes it (the sheet suspends page shortcuts)
  useHotkey(appHotkeys["ask.open"], () => open());

  const run = (item: Item) => {
    const a = item.action;
    if ("form" in a) setMode(a.form);
    else if ("href" in a) {
      close();
      router.push(a.href);
    } else if ("water" in a) logWater(false);
  };

  return (
    <>
      <AskSheet open={mode === "menu"} onClose={close} ready={!!ctx} waterAdded={waterAdded} onRun={run} onSent={() => later(close, 900)} />
      {ctx && (
        <>
          <TaskSheet open={mode === "task"} onClose={close} goals={ctx.goals} today={ctx.today} />
          <BlockSheet open={mode === "block"} onClose={close} goals={ctx.goals} today={ctx.today} />
          <MealSheet open={mode === "meal"} onClose={close} today={ctx.today} />
          <WeighInSheet open={mode === "weight"} onClose={close} today={ctx.today} />
        </>
      )}
    </>
  );
}

function AskSheet({ open, onClose, ...menu }: { open: boolean; onClose: () => void } & Omit<MenuProps, "onClose">) {
  const hasKeyboard = useHasKeyboard();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          Ask Timi
          {hasKeyboard && <AppKbd id="ask.open" size="xs" className="opacity-80" />}
        </span>
      }
      footer={hasKeyboard ? <MenuKeys /> : undefined}
      className="md:max-w-[600px]!"
      top
    >
      <AskMenu onClose={onClose} {...menu} />
    </Sheet>
  );
}

type MenuProps = {
  /** The forms' goals and day have loaded. */
  ready: boolean;
  waterAdded: boolean;
  onRun: (item: Item) => void;
  onSent: () => void;
  onClose: () => void;
};

function AskMenu({ ready, waterAdded, onRun, onSent, onClose }: MenuProps) {
  const [query, setQuery] = useState("");
  // Index into `list` picked with the arrow keys (or the pointer, in results); -1 is none
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasKeyboard = useHasKeyboard();
  const timi = useTimiSend(onSent);

  const q = query.trim();
  const results = q ? search(q) : [];
  const list: (Item | "ask")[] = q ? [...results, "ask"] : [...ADD, ...GO];
  const current = active >= 0 ? list[active] : undefined;

  const onQuery = (v: string) => {
    setQuery(v);
    // The best match leads; with none, "Ask Timi" does
    setActive(v.trim() ? 0 : -1);
  };

  const pick = async (item: Item | "ask") => {
    if (item === "ask") {
      if (await timi.send(q)) setQuery("");
    } else if ("prompt" in item.action) {
      if (await timi.send(item.action.prompt)) setQuery("");
    } else onRun(item);
  };

  const move = (step: 1 | -1) =>
    setActive((i) => {
      const n = list.length;
      return i < 0 ? (step > 0 ? 0 : n - 1) : (i + step + n) % n;
    });

  const inInput = { target: inputRef, ignoreInputs: false } as const;
  useHotkey("ArrowDown", () => move(1), inInput);
  useHotkey("ArrowUp", () => move(-1), inInput);
  // On "Ask Timi" (or nothing) Enter falls through to the form, which sends the text
  useHotkey("Enter", () => current && pick(current), { ...inInput, enabled: !!current && current !== "ask" });
  useHotkey(appHotkeys["ask.open"], onClose);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, q]);

  const disabled = (item: Item) => "form" in item.action && !ready;

  return (
    <div ref={listRef}>
      <CommandBar value={query} onChange={onQuery} timi={timi} placeholder="Type or say anything" inputRef={inputRef} autoFocus={hasKeyboard} />

      {q ? (
        <div role="listbox" aria-label="Results" className="mt-3 flex flex-col gap-0.5">
          {results.map((item, i) => (
            <ResultRow
              key={item.id}
              item={item}
              active={active === i}
              disabled={disabled(item) || (item.group === "Ask Timi" && timi.state === "sending")}
              showKeys={hasKeyboard}
              onHover={() => setActive(i)}
              onPick={() => pick(item)}
            />
          ))}
          <AskRow query={q} active={active === results.length} lone={results.length === 0} sending={timi.state === "sending"} onHover={() => setActive(results.length)} onPick={() => pick("ask")} />
        </div>
      ) : (
        <>
          <div className="no-scrollbar -mx-5 mt-2.5 flex gap-1.5 overflow-x-auto px-5 py-1">
            {PROMPTS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={timi.state === "sending"}
                onClick={() => pick(p)}
                className="tap h-9 shrink-0 rounded-full border border-line-strong bg-surface px-3.5 text-[13.5px] font-medium whitespace-nowrap text-ink-2 hover:text-ink disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>

          <GroupTitle>Add</GroupTitle>
          <div className="stagger grid grid-cols-2 gap-2 [--stagger:20ms] md:grid-cols-4">
            {ADD.map((item, i) => (
              <Tile
                key={item.id}
                item={item}
                active={active === i}
                done={item.id === "water" && waterAdded}
                disabled={disabled(item)}
                showKeys={hasKeyboard}
                onPick={() => pick(item)}
              />
            ))}
          </div>

          <GroupTitle>Go to</GroupTitle>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {GO.map((item, i) => (
              <GoRow key={item.id} item={item} active={active === ADD.length + i} showKeys={hasKeyboard} onPick={() => pick(item)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 mb-2 px-1 text-[13px] font-medium text-ink-3">{children}</div>;
}

function ItemIcon({ item, done, size = "md" }: { item: Item; done?: boolean; size?: "sm" | "md" }) {
  const box = size === "md" ? "size-9 rounded-[11px]" : "size-8 rounded-[10px]";
  if (item.icon === "timi")
    return (
      <span className={cn("grid shrink-0 place-items-center bg-accent-soft", box)}>
        <Timi size={26} />
      </span>
    );
  const Icon = done ? Check : item.icon;
  return (
    <span
      className={cn("grid shrink-0 place-items-center", box, !item.color && "bg-sunken text-ink-2")}
      style={item.color ? { background: softVar(item.color), color: colorVar(item.color) } : undefined}
    >
      <Icon className="size-[18px]" strokeWidth={done ? 2.6 : 2} />
    </span>
  );
}

function ItemKeys({ item }: { item: Item }) {
  return item.hotkey ? <AppKbd id={item.hotkey} size="xs" /> : null;
}

/** The colourful square for an Add action, as before the redesign. */
function Tile({
  item,
  active,
  done,
  disabled,
  showKeys,
  onPick,
}: {
  item: Item;
  active: boolean;
  done: boolean;
  disabled: boolean;
  showKeys: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      data-active={active}
      className={cn(
        "tap relative flex h-[92px] flex-col items-start justify-between rounded-[16px] border border-line bg-surface-2 p-3 text-left",
        "transition-colors hover:border-line-strong disabled:opacity-60",
        "data-[active=true]:border-accent data-[active=true]:shadow-[inset_0_0_0_1px_var(--accent)]",
      )}
    >
      <ItemIcon item={item} done={done} />
      <span className="text-[14px] leading-tight font-semibold text-ink">{done ? "+250 ml added" : item.label}</span>
      {showKeys && (
        <span className="absolute top-3 right-3">
          <ItemKeys item={item} />
        </span>
      )}
    </button>
  );
}

function GoRow({ item, active, showKeys, onPick }: { item: Item; active: boolean; showKeys: boolean; onPick: () => void }) {
  const Icon = item.icon as LucideIcon;
  return (
    <button
      type="button"
      onClick={onPick}
      data-active={active}
      className="tap-row flex h-11 min-w-0 items-center gap-3 rounded-[12px] px-2.5 text-left data-[active=true]:bg-sunken"
    >
      <Icon className="size-[18px] shrink-0 text-ink-3" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink-2">{item.label}</span>
      {/* Half-width rows on a narrow screen need the room for their label */}
      {showKeys && (
        <span className="hidden shrink-0 sm:flex">
          <ItemKeys item={item} />
        </span>
      )}
    </button>
  );
}

function ResultRow({
  item,
  active,
  disabled,
  showKeys,
  onHover,
  onPick,
}: {
  item: Item;
  active: boolean;
  disabled: boolean;
  showKeys: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-active={active}
      disabled={disabled}
      onMouseMove={onHover}
      onClick={onPick}
      className="flex min-h-[52px] items-center gap-3 rounded-[12px] px-2 text-left disabled:opacity-60 data-[active=true]:bg-sunken"
    >
      <ItemIcon item={item} size="sm" />
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{item.label}</span>
      <span className="shrink-0 text-[12.5px] text-ink-3">{item.group}</span>
      {showKeys && (item.hotkey ? <ItemKeys item={item} /> : active && <Keycap size="xs">↵</Keycap>)}
    </button>
  );
}

/** Always last in the results: hand the text to Timi as it is. */
function AskRow({
  query,
  active,
  lone,
  sending,
  onHover,
  onPick,
}: {
  query: string;
  active: boolean;
  /** Nothing else matched. */
  lone: boolean;
  sending: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-active={active}
      disabled={sending}
      onMouseMove={onHover}
      onClick={onPick}
      className={cn("flex min-h-[60px] items-center gap-3 rounded-[12px] px-2 text-left data-[active=true]:bg-sunken", !lone && "mt-1.5 border-t border-line pt-1.5")}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft">
        <Timi size={26} mood={sending ? "thinking" : "idle"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">
          Ask Timi <span className="text-ink-2">“{query}”</span>
        </span>
        <span className="block truncate text-[12.5px] text-ink-3">{lone ? "No action matches. Timi will handle it in the background." : "Runs in the background"}</span>
      </span>
      {active && <Keycap size="xs">↵</Keycap>}
    </button>
  );
}

/** Footer on keyboard devices: how to drive the menu. */
function MenuKeys() {
  return (
    <div className="flex items-center gap-4 text-[12px] text-ink-3">
      <span className="flex items-center gap-1.5">
        <Keycap size="xs">↑</Keycap>
        <Keycap size="xs">↓</Keycap>
        Move
      </span>
      <span className="flex items-center gap-1.5">
        <Keycap size="xs">↵</Keycap>
        Open
      </span>
      <span className="flex items-center gap-1.5">
        <Keycap size="xs">Esc</Keycap>
        Close
      </span>
      <Link href="/app/settings/shortcuts" className="ml-auto font-medium hover:text-ink">
        All shortcuts
      </Link>
    </div>
  );
}

/**
 * The accent circle that opens the Ask sheet. `bar` sits at the right end of
 * the bottom bar; `rail` in the desktop rail, with its shortcut under it.
 */
export function AskButton({ variant = "bar", className }: { variant?: "bar" | "rail"; className?: string }) {
  const keys = useHotkeyText("ask.open");
  const button = (
    <button
      type="button"
      onClick={() => openAsk()}
      aria-label="Ask Timi or add something"
      title={keys ? `Ask Timi (${keys})` : "Ask Timi"}
      className={cn(
        "tap grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink hover:opacity-95",
        variant === "rail" && "mx-auto",
        className,
      )}
    >
      <Plus className="size-[22px]" strokeWidth={2.2} />
    </button>
  );
  if (variant === "bar") return button;
  return (
    <div className="flex flex-col items-center gap-1.5">
      {button}
      <AppKbd id="ask.open" size="xs" />
    </div>
  );
}
