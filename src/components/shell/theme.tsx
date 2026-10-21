"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { fetchAppearance } from "@/app/(app)/app/settings/actions";
import {
  ACCENT_KEY,
  LOCAL_CHANGE_KEY,
  MODE_BG,
  MODE_KEY,
  SYNCED_KEY,
  applyAccent,
  applyMode,
  readAccent,
  readMode,
  setAccent,
  setMode,
  type Accent,
  type ColorMode,
} from "@/lib/themes";

const applyStored = () => {
  applyMode(readMode(), MODE_BG);
  applyAccent(readAccent());
};

/**
 * Root-level companion to the inline boot script. Re-applies the stored mode
 * after hydration (React's dev remount clears <html> attributes) and keeps
 * other tabs in step.
 */
export function ThemeBoot() {
  useLayoutEffect(applyStored, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MODE_KEY || e.key === ACCENT_KEY) applyStored();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}

let synced = false;

/**
 * Brings this device in line with the account's saved mode and accent (e.g. after
 * changing it on another device). Asks the server once per app session
 * (pages can be served from the offline snapshot) and never overrides a
 * change made here in the last 15 s.
 */
export function ThemeSync() {
  useEffect(() => {
    if (synced) return;
    synced = true;
    try {
      if (sessionStorage.getItem(SYNCED_KEY)) return;
      sessionStorage.setItem(SYNCED_KEY, "1");
    } catch {}
    fetchAppearance()
      .then(({ mode, accent }) => {
        const changedAt = Number(localStorage.getItem(LOCAL_CHANGE_KEY) || 0);
        if (Date.now() - changedAt < 15_000) return;
        if (mode && readMode() !== mode) setMode(mode);
        if (accent && readAccent() !== accent) setAccent(accent);
      })
      .catch(() => {});
  }, []);
  return null;
}

function subscribeMode(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  return () => mo.disconnect();
}

/** The mode painted right now. `fallback` is used while server rendering. */
export function useColorMode(fallback: ColorMode = "light"): ColorMode {
  return useSyncExternalStore(
    subscribeMode,
    () => (document.documentElement.getAttribute("data-mode") === "dark" ? "dark" : "light"),
    () => fallback,
  );
}

function subscribeAccent(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-accent"] });
  return () => mo.disconnect();
}

/** The accent painted right now. `fallback` is used while server rendering. */
export function useAccent(fallback: Accent): Accent {
  return useSyncExternalStore(subscribeAccent, readAccent, () => fallback);
}
