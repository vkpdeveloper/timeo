"use client";

import { HotkeysProvider, useHotkeys } from "@tanstack/react-hotkeys";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveColorMode } from "@/app/(app)/app/settings/actions";
import { appHotkeys, readCustomHotkeys, saveCustomHotkeys } from "@/lib/hotkeys";
import { readMode, setMode } from "@/lib/themes";
import { openAsk } from "./ask";

/** Holds the shortcut catalog and this device's custom keys (src/lib/hotkeys.ts). */
export function HotkeysRoot({ children }: { children: React.ReactNode }) {
  // The provider reads this once and owns it afterwards. null on the server.
  const [saved] = useState(readCustomHotkeys);
  return (
    <HotkeysProvider appHotkeys={appHotkeys} customHotkeys={saved} onCustomHotkeysChange={saveCustomHotkeys}>
      {children}
    </HotkeysProvider>
  );
}

/**
 * App-wide shortcuts: add something, go to a screen, switch light and dark.
 * ⌘K lives with the Ask sheet (AskHost). Any open sheet suspends these.
 */
export function GlobalHotkeys() {
  const router = useRouter();
  const go = (href: string) => () => router.push(href);
  const toggleMode = () => {
    const next = readMode() === "dark" ? "light" : "dark";
    setMode(next, true);
    saveColorMode(next).catch(() => {});
  };

  useHotkeys([
    { hotkey: appHotkeys["shortcuts.open"], callback: go("/app/settings/shortcuts") },
    { hotkey: appHotkeys["theme.toggle"], callback: toggleMode },
    { hotkey: appHotkeys["add.task"], callback: () => openAsk("task") },
    { hotkey: appHotkeys["add.block"], callback: () => openAsk("block") },
    { hotkey: appHotkeys["add.focus"], callback: go("/app/focus") },
    { hotkey: appHotkeys["add.meal"], callback: () => openAsk("meal") },
    { hotkey: appHotkeys["add.water"], callback: () => openAsk("water") },
    { hotkey: appHotkeys["add.weight"], callback: () => openAsk("weight") },
    { hotkey: appHotkeys["nav.now"], callback: go("/app") },
    { hotkey: appHotkeys["nav.week"], callback: go("/app/plan") },
    { hotkey: appHotkeys["nav.season"], callback: go("/app/goals") },
    { hotkey: appHotkeys["nav.body"], callback: go("/app/fitness") },
    { hotkey: appHotkeys["nav.review"], callback: go("/app/review") },
    { hotkey: appHotkeys["nav.chat"], callback: go("/app/assistant") },
    { hotkey: appHotkeys["nav.settings"], callback: go("/app/settings") },
  ]);
  return null;
}
