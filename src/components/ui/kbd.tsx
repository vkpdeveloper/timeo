"use client";

import { detectPlatform, formatForDisplay, useAppHotkeys, type Hotkey } from "@tanstack/react-hotkeys";
import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { useClientValue, useMediaQuery } from "@/lib/hooks";
import type { AppHotkeyId } from "@/lib/hotkeys";

export type Platform = "mac" | "windows" | "linux";

/** This device's keyboard platform; null while server rendering. */
export function usePlatform(): Platform | null {
  return useClientValue<Platform | null>(detectPlatform, null);
}

/** True on devices with a real pointer (and so, almost always, a keyboard). */
export function useHasKeyboard() {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}

const LABELS: Record<Platform, Record<string, string>> = {
  mac: { Space: "Space" },
  windows: { Space: "Space", Enter: "Enter" },
  linux: { Space: "Space", Enter: "Enter" },
};

/** One label per key, one array per step: Mod+K → [["⌘", "K"]] on a Mac, [["Ctrl", "K"]] elsewhere. */
export function hotkeyParts(hotkey: Hotkey, platform: Platform): string[][] {
  const opts = { platform, keyLabels: LABELS[platform], parts: true } as const;
  if (typeof hotkey === "string" || !Array.isArray(hotkey)) return [formatForDisplay(hotkey as string, opts)];
  return formatForDisplay(hotkey, opts);
}

/** Plain text for titles and aria labels: "⌘K", "Ctrl+K", "G then N". */
export function hotkeyText(hotkey: Hotkey, platform: Platform) {
  return hotkeyParts(hotkey, platform)
    .map((step) => step.join(platform === "mac" ? "" : "+"))
    .join(" then ");
}

/** An app hotkey's text with the user's custom key applied, for `title` attributes. */
export function useHotkeyText(id: AppHotkeyId) {
  const hotkey = useAppHotkeys()[id].hotkey;
  const platform = usePlatform();
  return hotkey && platform ? hotkeyText(hotkey, platform) : null;
}

const SIZES = {
  xs: "h-[18px] min-w-[18px] rounded-[5px] px-1 text-[10.5px]",
  sm: "h-[22px] min-w-[22px] rounded-[6px] px-1.5 text-[12px]",
  md: "h-7 min-w-7 rounded-[8px] px-2 text-[13px]",
  lg: "h-14 min-w-14 rounded-[14px] px-4 text-[24px] border-b-[3px]",
};

/** A single keycap: hairline border with a heavier bottom edge. */
export function Keycap({ children, size = "sm", className }: { children: React.ReactNode; size?: keyof typeof SIZES; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-grid shrink-0 place-items-center border border-b-2 border-line-strong bg-surface font-sans leading-none font-medium text-ink-2",
        SIZES[size],
        className,
      )}
    >
      {children}
    </kbd>
  );
}

type KbdProps = {
  hotkey: Hotkey | null | undefined;
  size?: keyof typeof SIZES;
  /** Show another platform's notation (Settings preview). */
  platform?: Platform;
  className?: string;
};

/**
 * A shortcut as keycaps, in this device's notation (⌘ on a Mac, Ctrl on
 * Windows and Linux). Sequences read "G then N". Renders nothing on the
 * server, or when `hotkey` is null.
 */
export function Kbd({ hotkey, size = "sm", platform: forced, className }: KbdProps) {
  const detected = usePlatform();
  const platform = forced ?? detected;
  if (!hotkey || !platform) return null;
  const steps = hotkeyParts(hotkey, platform);
  const gap = size === "lg" ? "gap-2" : size === "md" ? "gap-1" : "gap-[3px]";
  return (
    <span className={cn("inline-flex items-center", gap, className)} aria-label={hotkeyText(hotkey, platform)}>
      {steps.map((keys, i) => (
        <Fragment key={i}>
          {i > 0 && <span className={cn("text-ink-3", size === "lg" ? "px-1 text-[15px]" : "px-0.5 text-[11.5px]")}>then</span>}
          {keys.map((k, j) => (
            <Keycap key={j} size={size}>
              {k}
            </Keycap>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

/** An app hotkey's keycaps, with the user's custom key applied. */
export function AppKbd({ id, ...props }: { id: AppHotkeyId } & Omit<KbdProps, "hotkey">) {
  return <Kbd hotkey={useAppHotkeys()[id].hotkey} {...props} />;
}
