"use client";

import { Loader2, RotateCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { AssistantActivity } from "@/components/ai/activity";
import { useClientValue } from "@/lib/hooks";
import { capturePwaEvents, SW_URL } from "@/lib/pwa";

type SwMessage = { type: "timeo:fresh" | "timeo:reload" | "timeo:offline"; url: string; changed?: boolean };

// Screens with their own scrolling or gestures: no pull-to-refresh there.
const NO_PULL = [/^\/assistant/, /^\/focus/, /^\/fitness\/workout\//, /^\/login/, /^\/signup/];

const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

/**
 * Auth screens wipe saved pages so the next person on this device can't read
 * them. This sits in the root layout, which stays mounted across client
 * navigations, so it keys off the pathname rather than running once.
 */
function ClearOnAuthScreens() {
  const pathname = usePathname();
  useEffect(() => {
    if (/^\/(login|signup|reset-password)/.test(pathname)) navigator.serviceWorker?.controller?.postMessage({ type: "timeo:clear" });
  }, [pathname]);
  return null;
}

/**
 * Registers the service worker and keeps cached pages honest:
 * - when a page was served from the offline snapshot, shows "Updated X ago"
 *   until the background copy lands, then refreshes the data in place
 * - pull down at the top of a page to refresh
 * - silently refreshes when the app comes back to the foreground
 */
export function ServiceWorkerRegister() {
  const router = useRouter();
  // set when this page was served from the offline snapshot
  const initialSnapshot = useClientValue(() => Number(document.querySelector('meta[name="timeo-snapshot"]')?.getAttribute("content")) || null, null);
  const [freshArrived, setFreshArrived] = useState(false);
  const snapshotAt = freshArrived ? null : initialSnapshot;
  const [now, setNow] = useState(0);
  const [offline, setOffline] = useState(false);
  const [refreshing, start] = useTransition();
  const [pull, setPull] = useState(0);
  const lastRefresh = useRef(0);

  const refresh = () => {
    lastRefresh.current = Date.now();
    start(() => router.refresh());
  };

  // service worker + messages
  useEffect(() => {
    capturePwaEvents();
    lastRefresh.current = Date.now();
    const meta = document.querySelector('meta[name="timeo-snapshot"]');
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" }).catch(() => {});
    const onMessage = (e: MessageEvent<SwMessage>) => {
      const msg = e.data;
      if (!msg?.type?.startsWith("timeo:")) return;
      if (msg.type === "timeo:reload") return location.reload();
      if (msg.type === "timeo:offline") return setOffline(true);
      if (msg.type === "timeo:fresh") {
        if (msg.changed) {
          lastRefresh.current = Date.now();
          start(() => router.refresh());
        }
        setFreshArrived(true);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    // the background refresh may have finished before we mounted
    if (meta) navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "timeo:hello", url: location.pathname + location.search }));
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  // refresh on return to the app (at most once a minute)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > 60_000) {
        lastRefresh.current = Date.now();
        start(() => router.refresh());
      }
    };
    const onOnline = () => {
      setOffline(false);
      onVisible();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  // pull to refresh (touch only, at the top of the page)
  useEffect(() => {
    let startY: number | null = null;
    let dist = 0;
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || NO_PULL.some((r) => r.test(location.pathname))) return;
      if ((e.target as Element)?.closest?.('[role="dialog"]')) return;
      startY = e.touches[0].clientY;
      dist = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (startY == null) return;
      dist = Math.max(0, e.touches[0].clientY - startY);
      if (window.scrollY > 0) dist = 0;
      setPull(Math.min(dist, 110));
    };
    const onEnd = () => {
      if (startY != null && dist > 72) {
        navigator.vibrate?.(10);
        lastRefresh.current = Date.now();
        start(() => router.refresh());
      }
      startY = null;
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  // tick the "Updated X ago" label while it's visible
  useEffect(() => {
    if (snapshotAt == null) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 30_000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [snapshotAt]);

  const showPill = snapshotAt != null || offline || refreshing;

  return (
    <>
      <AssistantActivity />
      {/* usePathname suspends on routes with request-time params */}
      <Suspense fallback={null}>
        <ClearOnAuthScreens />
      </Suspense>
      {pull > 8 && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+8px)] z-[70] flex justify-center">
          <span
            className="glass grid size-9 place-items-center rounded-full border border-line text-ink-2 shadow-soft"
            style={{ transform: `translateY(${pull * 0.4}px) rotate(${pull * 3}deg)`, opacity: Math.min(1, pull / 72) }}
          >
            <RotateCw className="size-4" />
          </span>
        </div>
      )}
      <AnimatePresence>
        {showPill && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+10px)] z-[70] flex justify-center"
          >
            <button
              type="button"
              onClick={refresh}
              className="glass tap pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-medium text-ink-2 shadow-soft"
            >
              {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
              {offline
                ? "Offline · showing saved"
                : refreshing
                  ? "Updating…"
                  : snapshotAt
                    ? `Updated ${ago(Math.max(0, (now || snapshotAt) - snapshotAt))} · Refresh`
                    : "Refresh"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
