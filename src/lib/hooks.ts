"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** true after hydration, false during SSR. */
export function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Reads a browser-only value once on the client (e.g. feature detection). */
export function useClientValue<T>(read: () => T, server: T) {
  return useSyncExternalStore(noop, read, () => server);
}
