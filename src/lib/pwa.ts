"use client";

import { useSyncExternalStore } from "react";

// Install prompt (Chrome, Edge, Android, desktop) + platform hints.

/** In development the worker skips page snapshots and asset caching. */
export const SW_URL = process.env.NODE_ENV === "development" ? "/sw.js?dev=1" : "/sw.js";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function capturePwaEvents() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

type InstallState = { canPrompt: boolean; installed: boolean; ios: boolean };
const SERVER: InstallState = { canPrompt: false, installed: false, ios: false };
let snapshot: InstallState = SERVER;

function read(): InstallState {
  const next = { canPrompt: !!deferred, installed: installed || isStandalone(), ios: isIOS() };
  if (next.canPrompt !== snapshot.canPrompt || next.installed !== snapshot.installed || next.ios !== snapshot.ios) snapshot = next;
  return snapshot;
}

/** Whether the app can be installed here, and a function that shows the browser's install dialog. */
export function useInstall() {
  const state = useSyncExternalStore(
    (cb) => {
      capturePwaEvents();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => SERVER,
  );
  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    emit();
    return outcome === "accepted";
  };
  return { ...state, install };
}
