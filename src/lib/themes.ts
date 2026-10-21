// Light / Dark. Client-safe: used by the boot script, the shell and server actions.
//
// There are exactly two modes. The first visit follows the OS once and
// remembers the result; after that the mode only changes when the user picks
// one in Settings. The account keeps its pick in users.color_mode (an old
// "system" value is resolved against the OS on this device).

export type ColorMode = "light" | "dark";
export const COLOR_MODES: readonly ColorMode[] = ["light", "dark"];

export function isColorMode(v: unknown): v is ColorMode {
  return v === "light" || v === "dark";
}

/** Browser bar colour per mode (matches --bg). */
export const MODE_BG: Record<ColorMode, string> = { light: "#F5F6F8", dark: "#0B0C0F" };

export const MODE_KEY = "timeo.mode";
/** When the user last changed the mode on this device (so a sync never undoes it). */
export const LOCAL_CHANGE_KEY = "timeo.appearance.changedAt";
/** Set once per app session after the account's mode has been checked. */
export const SYNCED_KEY = "timeo.appearance.synced";

/**
 * Sets data-mode on <html> and points the theme-color meta at the background.
 * Self-contained (no outer references) so its source can be inlined into the boot script.
 */
export function applyMode(mode: string, bgs: Record<string, string>) {
  const root = document.documentElement;
  const m = mode === "dark" ? "dark" : "light";
  root.setAttribute("data-mode", m);
  root.removeAttribute("data-theme");
  // Clear variables an older custom theme may have left inline
  const style = root.style;
  for (let i = style.length - 1; i >= 0; i--) {
    const prop = style[i];
    if (prop.indexOf("--") === 0) style.removeProperty(prop);
  }
  // Our own theme-color meta, outside React's metadata so re-renders leave it alone
  let meta = document.head.querySelector('meta[name="theme-color"][data-timeo]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("data-timeo", "");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", bgs[m]);
}

/** The OS preference right now. */
export function osMode(): ColorMode {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The mode stored on this device; on the first visit, the OS mode (remembered from then on). */
export function readMode(): ColorMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (isColorMode(m)) return m;
    const os = osMode();
    localStorage.setItem(MODE_KEY, os);
    return os;
  } catch {
    return osMode();
  }
}

/** Applies now and remembers it on this device. `local` marks a change the user just made here. */
export function setMode(mode: ColorMode, local = false) {
  applyMode(mode, MODE_BG);
  try {
    if (local) localStorage.setItem(LOCAL_CHANGE_KEY, String(Date.now()));
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
}

// ── Accent. Sky by default; the landing page always shows Sky (globals.css). ──

export type Accent = "sky" | "graphite" | "harbor" | "lagoon" | "volt" | "pine";
export const DEFAULT_ACCENT: Accent = "sky";

/** In picker order. `swatch` is [light, dark], matching --accent in globals.css. */
export const ACCENTS: readonly { id: Accent; label: string; swatch: [string, string] }[] = [
  { id: "sky", label: "Sky", swatch: ["#1F6FE5", "#5B9DFF"] },
  { id: "harbor", label: "Harbor", swatch: ["#2B5F8E", "#7EB2E2"] },
  { id: "lagoon", label: "Lagoon", swatch: ["#0F766E", "#4CC9BC"] },
  { id: "pine", label: "Pine", swatch: ["#1F6B50", "#5CC495"] },
  { id: "volt", label: "Volt", swatch: ["#4D7C0F", "#C5F04A"] },
  { id: "graphite", label: "Graphite", swatch: ["#18181B", "#F2F2F3"] },
];

export function isAccent(v: unknown): v is Accent {
  return typeof v === "string" && ACCENTS.some((a) => a.id === v);
}

export const ACCENT_KEY = "timeo.accent";

/** Sets data-accent on <html>. Self-contained so its source can be inlined into the boot script. */
export function applyAccent(accent: string) {
  document.documentElement.setAttribute("data-accent", accent);
}

/** The accent stored on this device (Sky until one is picked). */
export function readAccent(): Accent {
  try {
    const a = localStorage.getItem(ACCENT_KEY);
    return isAccent(a) ? a : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

/** Applies now and remembers it on this device. `local` marks a change the user just made here. */
export function setAccent(accent: Accent, local = false) {
  applyAccent(accent);
  try {
    if (local) localStorage.setItem(LOCAL_CHANGE_KEY, String(Date.now()));
    localStorage.setItem(ACCENT_KEY, accent);
  } catch {}
}

/** Inline <head> script: applies the stored mode (or the OS mode, once) and accent before first paint. */
export function themeBootScript() {
  const key = JSON.stringify(MODE_KEY);
  const accents = JSON.stringify(ACCENTS.map((a) => a.id));
  return `(function(){try{var s=localStorage,a=s.getItem(${JSON.stringify(ACCENT_KEY)});(${applyAccent.toString()})(${accents}.indexOf(a)>=0?a:${JSON.stringify(DEFAULT_ACCENT)});var m=s.getItem(${key});if(m!=="light"&&m!=="dark"){m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";s.setItem(${key},m)}s.removeItem("timeo.theme");s.removeItem("timeo.custom");(${applyMode.toString()})(m,${JSON.stringify(MODE_BG)})}catch(e){}})()`;
}
