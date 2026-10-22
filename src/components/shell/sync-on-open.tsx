"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { syncOnOpen } from "@/actions/integrations";

const EVERY_MS = 5 * 60_000;
let last = 0;

/**
 * Pulls in calendar events and tasks from connected apps when the app opens or comes back to
 * the front, at most every five minutes, and redraws the page when anything changed.
 */
export function SyncOnOpen() {
  const router = useRouter();
  useEffect(() => {
    const run = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < EVERY_MS) return;
      last = Date.now();
      syncOnOpen()
        .then((changed) => changed && router.refresh())
        .catch(() => {});
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [router]);
  return null;
}
