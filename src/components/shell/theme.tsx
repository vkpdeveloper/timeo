"use client";

import { useEffect, useLayoutEffect } from "react";
import { fetchAppearance } from "@/app/(app)/settings/appearance/actions";
import {
  LOCAL_CHANGE_KEY,
  applyAppearance,
  readStoredAppearance,
  setAppearance,
  STORAGE_KEYS,
  THEME_BGS,
} from "@/lib/themes";

function applyStored() {
  const { theme, mode, custom } = readStoredAppearance();
  applyAppearance(theme, mode, THEME_BGS, custom);
}

/**
 * Root-level companion to the inline boot script. Re-applies the stored
 * appearance after hydration (React's dev remount clears <html> attributes)
 * and keeps other tabs and the OS light/dark switch in step.
 */
export function ThemeBoot() {
  useLayoutEffect(applyStored, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && (Object.values(STORAGE_KEYS) as string[]).includes(e.key)) applyStored();
    };
    // In "system" mode the browser bar colour follows the OS
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("storage", onStorage);
    mq.addEventListener("change", applyStored);
    return () => {
      window.removeEventListener("storage", onStorage);
      mq.removeEventListener("change", applyStored);
    };
  }, []);
  return null;
}

let synced = false;

/**
 * Brings this device in line with the account's saved appearance (e.g. after
 * changing it on another device). It asks the server once per app session,
 * instead of trusting values baked into the page (pages can be served from the
 * offline snapshot), and never overrides a change made here in the last 15 s.
 */
export function ThemeSync() {
  useEffect(() => {
    if (synced) return;
    synced = true;
    try {
      if (sessionStorage.getItem("timeo.appearance.synced")) return;
      sessionStorage.setItem("timeo.appearance.synced", "1");
    } catch {}
    fetchAppearance()
      .then(({ theme, mode, custom }) => {
        const changedAt = Number(localStorage.getItem(LOCAL_CHANGE_KEY) || 0);
        if (Date.now() - changedAt < 15_000) return;
        const stored = readStoredAppearance();
        const same = stored.theme === theme && stored.mode === mode && JSON.stringify(stored.custom) === JSON.stringify(custom);
        if (!same) setAppearance(theme, mode, custom);
      })
      .catch(() => {});
  }, []);
  return null;
}
