import { defineAppHotkeys, type CustomHotkeys } from "@tanstack/react-hotkeys";

/*
 * Every keyboard shortcut in Timeo, declared once. Components register them
 * with useHotkey(appHotkeys[id], ...); Settings → Keyboard shortcuts lists and
 * rebinds them. Ids are a storage contract: renaming one drops the user's
 * custom key for it.
 *
 * Keys are physical ([KeyK]) so a recorded shortcut compares equal to its
 * default and Option+letter on a Mac records the letter, not "˚".
 */
export const appHotkeys = defineAppHotkeys({
  "ask.open": {
    hotkey: "Mod+[KeyK]",
    meta: { group: "General", name: "Ask Timi", description: "Open the menu from anywhere" },
    options: { requireReset: true },
  },
  "shortcuts.open": { hotkey: "Mod+[Slash]", meta: { group: "General", name: "Keyboard shortcuts", description: "This list" } },
  "theme.toggle": { hotkey: "Mod+Shift+[KeyL]", meta: { group: "General", name: "Light or dark" }, options: { requireReset: true } },

  // Alt (⌥) so extensions that take bare letters, like Vimium, leave them alone
  "add.task": { hotkey: "Alt+[KeyT]", meta: { group: "Add", name: "Task" } },
  "add.block": { hotkey: "Alt+[KeyB]", meta: { group: "Add", name: "Time block" } },
  "add.focus": { hotkey: "Alt+[KeyF]", meta: { group: "Add", name: "Focus session" } },
  "add.meal": { hotkey: "Alt+[KeyM]", meta: { group: "Add", name: "Meal" } },
  "add.water": { hotkey: "Alt+[KeyW]", meta: { group: "Add", name: "Water", description: "250 ml" } },
  "add.weight": { hotkey: "Alt+[KeyS]", meta: { group: "Add", name: "Weigh-in" } },

  "nav.now": { hotkey: "Alt+Shift+[KeyN]", meta: { group: "Go to", name: "Now" } },
  "nav.week": { hotkey: "Alt+Shift+[KeyW]", meta: { group: "Go to", name: "Week" } },
  "nav.season": { hotkey: "Alt+Shift+[KeyS]", meta: { group: "Go to", name: "Season" } },
  "nav.body": { hotkey: "Alt+Shift+[KeyB]", meta: { group: "Go to", name: "Body" } },
  "nav.review": { hotkey: "Alt+Shift+[KeyR]", meta: { group: "Go to", name: "Review" } },
  "nav.chat": { hotkey: "Alt+Shift+[KeyC]", meta: { group: "Go to", name: "Chat with Timi" } },
  "nav.settings": { hotkey: "Alt+Shift+[Comma]", meta: { group: "Go to", name: "Settings" } },

  // Registered by the focus screen, so they only work while a session runs
  "focus.toggle": { hotkey: "[Space]", meta: { group: "Focus", name: "Pause or resume" }, options: { requireReset: true } },
  "focus.extend": { hotkey: "[Equal]", meta: { group: "Focus", name: "5 more minutes" } },
});

export type AppHotkeyId = keyof typeof appHotkeys;

declare module "@tanstack/react-hotkeys" {
  interface Register {
    appHotkeys: typeof appHotkeys;
  }
}

/** The user's changes on this device (only what differs from the defaults). */
export const HOTKEYS_KEY = "timeo.hotkeys";

export function readCustomHotkeys(): CustomHotkeys | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HOTKEYS_KEY);
    return raw ? (JSON.parse(raw) as CustomHotkeys) : null;
  } catch {
    return null;
  }
}

export function saveCustomHotkeys(custom: CustomHotkeys) {
  try {
    if (Object.keys(custom).length) localStorage.setItem(HOTKEYS_KEY, JSON.stringify(custom));
    else localStorage.removeItem(HOTKEYS_KEY);
  } catch {}
}
