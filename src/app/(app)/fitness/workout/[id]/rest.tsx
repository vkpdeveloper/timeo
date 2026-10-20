"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

type RestState = { end: number; total: number } | null;

const key = (logId: string) => `timeo-rest-${logId}`;

function read(logId: string): RestState {
  try {
    const raw = localStorage.getItem(key(logId));
    if (!raw) return null;
    const v = JSON.parse(raw) as RestState;
    return v && v.end > Date.now() ? v : null;
  } catch {
    return null;
  }
}

function write(logId: string, v: RestState) {
  try {
    if (v) localStorage.setItem(key(logId), JSON.stringify(v));
    else localStorage.removeItem(key(logId));
  } catch {}
}

export function useRestTimer(logId: string) {
  const [state, setState] = useState<RestState>(null);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const buzzed = useRef(false);

  // restore a running timer after a reload
  useEffect(() => {
    const saved = read(logId);
    if (saved) queueMicrotask(() => setState(saved));
  }, [logId]);

  useEffect(() => {
    if (!state) return;
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, [state]);

  const remaining = state ? Math.max(0, Math.ceil((state.end - now) / 1000)) : 0;

  useEffect(() => {
    if (!state || remaining > 0 || buzzed.current) return;
    buzzed.current = true;
    try {
      navigator.vibrate?.([180, 90, 180]);
    } catch {}
    write(logId, null);
    queueMicrotask(() => {
      setState(null);
      setFinished(true);
    });
  }, [remaining, state, logId]);

  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => setFinished(false), 3500);
    return () => clearTimeout(t);
  }, [finished]);

  const set = useCallback(
    (v: RestState) => {
      buzzed.current = false;
      setFinished(false);
      setNow(Date.now());
      setState(v);
      write(logId, v);
    },
    [logId],
  );

  return {
    remaining,
    total: state?.total ?? 0,
    active: !!state,
    finished,
    start: (sec: number) => set({ end: Date.now() + sec * 1000, total: sec }),
    adjust: (delta: number) =>
      state && set({ end: Math.max(Date.now() + 1000, state.end + delta * 1000), total: Math.max(1, state.total + delta) }),
    skip: () => set(null),
    dismiss: () => setFinished(false),
  };
}

export type RestTimer = ReturnType<typeof useRestTimer>;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Bottom bar with the rest countdown. */
export function RestBar({ rest }: { rest: RestTimer }) {
  const show = rest.active || rest.finished;
  const pct = rest.total ? rest.remaining / rest.total : 0;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", damping: 32, stiffness: 380 }}
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(10px,var(--safe-bottom))] lg:left-60"
        >
          <div className="mx-auto max-w-[620px] overflow-hidden rounded-[26px] border border-line bg-surface shadow-float">
            {rest.active ? (
              <>
                <div className="h-1 bg-sunken">
                  <div className="h-full bg-tint transition-[width] duration-300 ease-linear" style={{ width: `${pct * 100}%` }} />
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => rest.adjust(-15)}
                    className="tap h-12 w-16 rounded-2xl bg-sunken text-[15px] font-semibold text-ink"
                  >
                    −15
                  </button>
                  <div className="flex-1 text-center" aria-live="polite">
                    <div className="text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Rest</div>
                    <div className="tnum-live text-[28px] leading-none font-semibold tracking-tight text-ink">{mmss(rest.remaining)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => rest.adjust(15)}
                    className="tap h-12 w-16 rounded-2xl bg-sunken text-[15px] font-semibold text-ink"
                  >
                    +15
                  </button>
                  <button
                    type="button"
                    onClick={rest.skip}
                    className="tap h-12 rounded-2xl bg-ink px-4 text-[15px] font-semibold text-bg"
                  >
                    Skip
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={rest.dismiss}
                className="flex h-16 w-full items-center justify-center text-[16px] font-semibold text-ok"
              >
                Rest over. Next set.
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
