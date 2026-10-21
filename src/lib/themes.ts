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
export const MODE_BG: Record<ColorMode, string> = { light: "#F6F6F3", dark: "#0C0E0D" };

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

/** Inline <head> script: applies the stored mode (or the OS mode, once) before first paint. */
export function themeBootScript() {
  const key = JSON.stringify(MODE_KEY);
  return `(function(){try{var s=localStorage,m=s.getItem(${key});if(m!=="light"&&m!=="dark"){m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";s.setItem(${key},m)}s.removeItem("timeo.theme");s.removeItem("timeo.custom");(${applyMode.toString()})(m,${JSON.stringify(MODE_BG)})}catch(e){}})()`;
}
