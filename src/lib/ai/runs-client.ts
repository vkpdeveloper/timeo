"use client";

import { useSyncExternalStore } from "react";
import type { AssistantRun } from "./shared";

/*
 * Client side of background assistant runs. Any screen can start a run; this
 * store remembers which runs are still going (localStorage, so it survives a
 * reload), polls them while the app is visible, and tells listeners when one
 * finishes. Polling also tells the server the app is open, so it won't push.
 */

const KEY = "timeo.runs.v1";
const POLL_MS = 1500;

type State = { tracked: Record<string, AssistantRun | { id: string; status: "running"; input: string }>; finished: AssistantRun[] };

const EMPTY: State = { tracked: {}, finished: [] };
let state: State = EMPTY;
const listeners = new Set<() => void>();
const doneListeners = new Set<(run: AssistantRun) => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || "[]") as { id: string; input: string }[];
    state = { ...state, tracked: Object.fromEntries(ids.map((r) => [r.id, { id: r.id, status: "running" as const, input: r.input }])) };
  } catch {}
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && schedule(0));
  schedule(0);
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.values(state.tracked).map((r) => ({ id: r.id, input: r.input }))));
  } catch {}
}

function set(next: State) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function schedule(ms = POLL_MS) {
  if (timer) clearTimeout(timer);
  if (!Object.keys(state.tracked).length) return;
  timer = setTimeout(poll, ms);
}

async function poll() {
  timer = null;
  if (document.visibilityState !== "visible") return; // resume on visibility
  const ids = Object.keys(state.tracked);
  const results = await Promise.all(
    ids.map((id) =>
      fetch(`/api/assistant/runs/${id}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<AssistantRun>) : r.status === 404 ? null : undefined))
        .catch(() => undefined),
    ),
  );
  const tracked = { ...state.tracked };
  const finished: AssistantRun[] = [];
  results.forEach((run, i) => {
    if (run === null) delete tracked[ids[i]]; // gone
    else if (run) {
      if (run.status === "running") tracked[run.id] = run;
      else {
        delete tracked[run.id];
        finished.push(run);
      }
    }
  });
  set({ tracked, finished: [...state.finished, ...finished].slice(-5) });
  finished.forEach((r) => doneListeners.forEach((l) => l(r)));
  schedule();
}

/** Send a message to the assistant; it runs in the background. */
export async function startRun(text: string): Promise<string> {
  load();
  const res = await fetch("/api/assistant/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(res.status === 401 ? "Signed out" : "Couldn't reach Timi");
  const { id } = (await res.json()) as { id: string };
  set({ ...state, tracked: { ...state.tracked, [id]: { id, status: "running", input: text } } });
  schedule(800);
  return id;
}

export function dismissFinished(id: string) {
  set({ ...state, finished: state.finished.filter((r) => r.id !== id) });
}

/** Runs still going + recently finished ones (for toasts). */
export function useRuns() {
  return useSyncExternalStore(
    (cb) => {
      load();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    // server render and hydration always start empty (no localStorage there)
    () => EMPTY,
  );
}

/** Subscribe to "a run just finished". */
export function onRunFinished(fn: (run: AssistantRun) => void) {
  load();
  doneListeners.add(fn);
  return () => {
    doneListeners.delete(fn);
  };
}
