"use client";

import { useAppHotkeyList, useAppHotkeys, useCustomHotkeys, useHotkeyRecorder, type Hotkey, type HotkeySequence } from "@tanstack/react-hotkeys";
import { Keyboard, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Segmented } from "@/components/ui/controls";
import { Kbd, Keycap, PLATFORM_NAME, useHasKeyboard, usePlatform, type Platform } from "@/components/ui/kbd";
import { Section } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { AppHotkeyId } from "@/lib/hotkeys";

const PLATFORMS: Platform[] = ["mac", "windows", "linux"];

/**
 * Every shortcut by group, in this device's notation (or another platform's,
 * to compare). Tap a row and press the new keys: a chord, or two steps like
 * G then N. Backspace removes it, Escape cancels.
 */
export function ShortcutSettings() {
  const detected = usePlatform();
  const [picked, setPicked] = useState<Platform | null>(null);
  const platform = picked ?? detected;
  const hasKeyboard = useHasKeyboard();
  const list = useAppHotkeyList();
  const ask = useAppHotkeys()["ask.open"];
  const { customHotkeys, setCustomHotkey, resetCustomHotkey, resetCustomHotkeys, findConflicts } = useCustomHotkeys();

  const [editing, setEditing] = useState<AppHotkeyId | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const stop = () => {
    setEditing(null);
    setProblem(null);
  };

  const recorder = useHotkeyRecorder({
    // A chord, or two steps (G then N); one step commits after a short pause
    maxSteps: 2,
    idleTimeoutMs: 1000,
    validate: (hotkey) => {
      if (!editing) return false;
      const [taken] = findConflicts(editing, hotkey);
      return taken ? `${taken.meta?.name ?? taken.id} already uses these keys` : true;
    },
    onReject: (r) => setProblem(r.reason === "validation" || r.reason === "conflict" ? r.message : "Those keys can't be used. Try another."),
    onRecord: (hotkey) => {
      if (editing) setCustomHotkey(editing, hotkey);
      stop();
    },
    onClear: () => {
      if (editing) setCustomHotkey(editing, null);
      stop();
    },
    onCancel: stop,
  });

  const edit = (id: AppHotkeyId) => {
    recorder.stopRecording();
    setEditing(id);
    setProblem(null);
    recorder.startRecording();
  };
  const cancel = () => {
    recorder.stopRecording();
    stop();
  };

  const groups = new Map<string, typeof list>();
  for (const item of list) {
    const g = item.appHotkey.meta?.group ?? "Other";
    groups.set(g, [...(groups.get(g) ?? []), item]);
  }
  const changed = Object.keys(customHotkeys).length;

  return (
    <div className="pt-2">
      <div className="card flex flex-col items-center px-5 pt-8 pb-6 text-center">
        <div className="flex min-h-14 items-center">
          {platform && ask.hotkey ? <Kbd hotkey={ask.hotkey} size="lg" platform={platform} /> : <Keycap size="lg">K</Keycap>}
        </div>
        <h2 className="mt-5 text-[17px] font-semibold tracking-tight text-ink">Ask Timi from anywhere</h2>
        <p className="mt-1 max-w-[340px] text-[13.5px] leading-snug text-ink-3">
          Type to find an action and press Enter. Anything that isn&rsquo;t an action goes to Timi.
        </p>
      </div>

      {platform && !hasKeyboard && (
        <p className="mt-3 flex items-center gap-2 px-1 text-[13px] text-ink-3">
          <Keyboard className="size-4 shrink-0" strokeWidth={1.8} />
          Shortcuts work when a keyboard is connected.
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 px-1">
        <span className="text-[13px] text-ink-3">
          {platform && detected && platform !== detected ? `Showing ${PLATFORM_NAME[platform]} keys` : "Keys for this device"}
        </span>
        {platform ? (
          <Segmented<Platform>
            size="sm"
            className="w-[228px] shrink-0"
            value={platform}
            onChange={setPicked}
            options={PLATFORMS.map((p) => ({ value: p, label: PLATFORM_NAME[p] }))}
          />
        ) : (
          // Same footprint until the device's platform is known
          <div className="h-[38px] w-[228px] shrink-0 rounded-[12px] bg-sunken" />
        )}
      </div>

      {[...groups].map(([group, items]) => (
        <Section key={group} title={group} card>
          {items.map(({ appHotkey, isCustom }) => {
            const id = appHotkey.id as AppHotkeyId;
            return (
              <ShortcutRow
                key={id}
                name={appHotkey.meta?.name ?? id}
                description={appHotkey.meta?.description}
                hotkey={appHotkey.hotkey}
                defaultHotkey={appHotkey.defaultHotkey}
                custom={isCustom}
                platform={platform}
                recording={editing === id && recorder.isRecording}
                steps={editing === id ? recorder.steps : []}
                problem={editing === id ? problem : null}
                onEdit={() => edit(id)}
                onCancel={cancel}
                onReset={() => resetCustomHotkey(id)}
              />
            );
          })}
        </Section>
      ))}

      <div className="mt-6 flex items-center justify-between gap-4 px-1">
        <p className="text-[13px] leading-snug text-ink-3">Saved on this device. Single keys pause while you type.</p>
        {changed > 0 && (
          <button
            type="button"
            onClick={() => {
              cancel();
              resetCustomHotkeys();
            }}
            className="tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13.5px] font-medium text-ink-2 hover:text-ink"
          >
            <RotateCcw className="size-3.5" strokeWidth={2} />
            Reset all
          </button>
        )}
      </div>
    </div>
  );
}

function ShortcutRow({
  name,
  description,
  hotkey,
  defaultHotkey,
  custom,
  platform,
  recording,
  steps,
  problem,
  onEdit,
  onCancel,
  onReset,
}: {
  name: string;
  description?: string;
  hotkey: Hotkey | null;
  defaultHotkey: Hotkey | null;
  custom: boolean;
  platform: Platform | null;
  recording: boolean;
  /** Steps pressed so far while recording. */
  steps: HotkeySequence;
  problem: string | null;
  onEdit: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const sub = recording ? (
    <span className={cn(problem && "text-warn")}>{problem ?? "Press the new keys. Esc cancels, ⌫ removes it."}</span>
  ) : custom ? (
    <span className="inline-flex items-center gap-1.5">
      Default {defaultHotkey && platform ? <Kbd hotkey={defaultHotkey} size="xs" platform={platform} /> : "none"}
    </span>
  ) : (
    description
  );

  return (
    <div className={cn("flex items-stretch", recording && "bg-surface-2")}>
      <button
        type="button"
        onClick={recording ? undefined : onEdit}
        aria-label={`Change the shortcut for ${name}`}
        className="tap-row flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2.5 pr-3 pl-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
            <span className="truncate">{name}</span>
            {custom && !recording && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label="Changed" />}
          </span>
          {sub && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{sub}</span>}
        </span>
        {recording ? (
          <span className="flex h-8 shrink-0 items-center gap-2 rounded-[10px] border border-accent bg-accent-soft px-2.5 text-[13px] font-medium text-accent">
            {steps.length > 0 && platform ? (
              <Kbd hotkey={steps.length === 1 ? steps[0] : steps} size="sm" platform={platform} />
            ) : (
              <>
                <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                Press keys
              </>
            )}
          </span>
        ) : hotkey ? (
          <Kbd hotkey={hotkey} size="md" platform={platform ?? undefined} className="shrink-0" />
        ) : (
          <span className="shrink-0 text-[13.5px] text-ink-3">Not set</span>
        )}
      </button>
      {recording ? (
        <button type="button" onClick={onCancel} className="tap shrink-0 px-3.5 text-[13.5px] font-medium text-ink-2 hover:text-ink">
          Cancel
        </button>
      ) : custom ? (
        <button
          type="button"
          onClick={onReset}
          aria-label={`Reset ${name} to its default`}
          title="Reset to default"
          className="tap grid w-11 shrink-0 place-items-center text-ink-3 hover:text-ink"
        >
          <RotateCcw className="size-4" strokeWidth={1.9} />
        </button>
      ) : null}
    </div>
  );
}
