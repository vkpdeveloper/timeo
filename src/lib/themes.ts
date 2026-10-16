// Colour themes. Client-safe: imported by the boot script, the appearance
// screen and server actions alike.
//
// Each built-in theme is mirrored by a `:root[data-theme="<id>"]` block in
// src/app/globals.css (same values). Tokens a theme leaves out (surface-2,
// sunken, ink-3, lines, glass, soft tints) are derived there with color-mix.

export type ColorMode = "system" | "light" | "dark";
export const COLOR_MODES: readonly ColorMode[] = ["system", "light", "dark"];

/** The colours a theme sets for one mode. Optional keys are derived when absent. */
export type ThemeColors = {
  bg: string;
  surface: string;
  ink: string;
  /** Muted text */
  ink2: string;
  accent: string;
  /** Text on the accent */
  accentInk: string;
  surface2?: string;
  sunken?: string;
  ink3?: string;
  line?: string;
  lineStrong?: string;
};

export type ThemeDef = {
  id: string;
  name: string;
  light: ThemeColors;
  dark: ThemeColors;
};

export const DEFAULT_THEME = "paper";

export const THEMES: readonly ThemeDef[] = [
  {
    id: "paper",
    name: "Paper",
    light: {
      bg: "#f5f4f0",
      surface: "#ffffff",
      ink: "#18171a",
      ink2: "#5b5852",
      accent: "#e5603b",
      accentInk: "#ffffff",
      surface2: "#fafaf7",
      sunken: "#eceae4",
      ink3: "#9a968e",
      line: "rgb(24 22 18 / 0.07)",
      lineStrong: "rgb(24 22 18 / 0.13)",
    },
    dark: {
      bg: "#0b0b0c",
      surface: "#151517",
      ink: "#f3f2ee",
      ink2: "#aaa69f",
      accent: "#ff7a52",
      accentInk: "#1a0d08",
      surface2: "#1b1b1e",
      sunken: "#101012",
      ink3: "#6c6963",
      line: "rgb(255 255 255 / 0.065)",
      lineStrong: "rgb(255 255 255 / 0.12)",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    light: { bg: "#f2f3f5", surface: "#ffffff", ink: "#16181d", ink2: "#535a66", accent: "#4f56d6", accentInk: "#ffffff" },
    dark: { bg: "#0e0f12", surface: "#17191d", ink: "#eceef2", ink2: "#a2a8b4", accent: "#8d95ff", accentInk: "#0f1133" },
  },
  {
    id: "mono",
    name: "Mono",
    light: { bg: "#f3f3f3", surface: "#ffffff", ink: "#141414", ink2: "#575757", accent: "#141414", accentInk: "#ffffff" },
    dark: { bg: "#0a0a0a", surface: "#161616", ink: "#f0f0f0", ink2: "#a3a3a3", accent: "#f0f0f0", accentInk: "#111111" },
  },
  {
    id: "nord",
    name: "Nord",
    light: { bg: "#e5e9f0", surface: "#f4f6f9", ink: "#2e3440", ink2: "#4c566a", accent: "#44658f", accentInk: "#ffffff", sunken: "#d8dee9" },
    dark: { bg: "#2e3440", surface: "#3b4252", ink: "#eceff4", ink2: "#b4bccb", accent: "#96d0e0", accentInk: "#242933", sunken: "#292e39", surface2: "#434c5e" },
  },
  {
    id: "solarized",
    name: "Solarized",
    light: { bg: "#eee8d5", surface: "#fdf6e3", ink: "#073642", ink2: "#4f646b", accent: "#1b6499", accentInk: "#fdf6e3" },
    dark: { bg: "#002b36", surface: "#073642", ink: "#eee8d5", ink2: "#93a1a1", accent: "#6ab8f0", accentInk: "#002b36", sunken: "#00252e" },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    light: { bg: "#e6e9ef", surface: "#eff1f5", ink: "#4c4f69", ink2: "#5c5f77", accent: "#7a2bdc", accentInk: "#ffffff", sunken: "#dce0e8" },
    dark: { bg: "#181825", surface: "#1e1e2e", ink: "#cdd6f4", ink2: "#a6adc8", accent: "#cba6f7", accentInk: "#1e1e2e", sunken: "#11111b", surface2: "#262637" },
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    light: { bg: "#f2e5bc", surface: "#fbf1c7", ink: "#3c3836", ink2: "#5f5650", accent: "#a03502", accentInk: "#fbf1c7", sunken: "#ebdbb2" },
    dark: { bg: "#1d2021", surface: "#282828", ink: "#ebdbb2", ink2: "#a89984", accent: "#fe8019", accentInk: "#1d2021", surface2: "#32302f" },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    light: { bg: "#e1e2e7", surface: "#f2f2f5", ink: "#343b58", ink2: "#4f5a85", accent: "#2a56b8", accentInk: "#ffffff", sunken: "#d6d8df" },
    dark: { bg: "#1a1b26", surface: "#24283b", ink: "#c0caf5", ink2: "#a9b1d6", accent: "#7aa2f7", accentInk: "#1a1b26", sunken: "#16161e", surface2: "#292e42" },
  },
  {
    id: "rose-pine",
    name: "Rosé Pine",
    light: { bg: "#faf4ed", surface: "#fffaf3", ink: "#464261", ink2: "#625e7c", accent: "#9f4d65", accentInk: "#fffaf3", sunken: "#f2e9e1" },
    dark: { bg: "#191724", surface: "#1f1d2e", ink: "#e0def4", ink2: "#a9a5c2", accent: "#ebbcba", accentInk: "#191724", surface2: "#26233a" },
  },
  {
    id: "dracula",
    name: "Dracula",
    light: { bg: "#f6f5ef", surface: "#fffdf7", ink: "#1f1f2b", ink2: "#5b5c70", accent: "#6c4fd1", accentInk: "#ffffff" },
    dark: { bg: "#21222c", surface: "#282a36", ink: "#f8f8f2", ink2: "#b6b9cf", accent: "#bd93f9", accentInk: "#21222c", surface2: "#303341" },
  },
  {
    id: "github",
    name: "GitHub",
    light: { bg: "#f6f8fa", surface: "#ffffff", ink: "#1f2328", ink2: "#59636e", accent: "#085ec4", accentInk: "#ffffff", sunken: "#eef1f4" },
    dark: { bg: "#0d1117", surface: "#151b23", ink: "#f0f6fc", ink2: "#9198a1", accent: "#4493f8", accentInk: "#0d1117" },
  },
  {
    id: "one",
    name: "One",
    light: { bg: "#f0f0f1", surface: "#fafafa", ink: "#383a42", ink2: "#5c5f6b", accent: "#2f5ec9", accentInk: "#ffffff", sunken: "#e5e5e6" },
    dark: { bg: "#21252b", surface: "#282c34", ink: "#dcdfe4", ink2: "#abb2bf", accent: "#61afef", accentInk: "#1b1f24", surface2: "#2f343e" },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function themeById(id: string | null | undefined): ThemeDef | undefined {
  return THEMES.find((t) => t.id === id);
}

export function isColorMode(v: unknown): v is ColorMode {
  return v === "system" || v === "light" || v === "dark";
}

export const CUSTOM_PREFIX = "custom:";

/** True for a built-in id or "custom:<id>". */
export function isThemeValue(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (v.startsWith(CUSTOM_PREFIX)) return /^custom:[\w-]{1,64}$/.test(v);
  return THEME_IDS.includes(v);
}

// ─────────────────────────── Custom themes ───────────────────────────

/** Keys a user picks per mode. `line` is optional. */
export const CUSTOM_KEYS = ["bg", "surface", "ink", "ink2", "accent", "line"] as const;
export type CustomKey = (typeof CUSTOM_KEYS)[number];
/** Stored as JSON in user_themes.light / .dark */
export type CustomColors = Partial<Record<CustomKey, string>>;

const NUM = String.raw`-?(?:\d+\.?\d*|\.\d+)(?:%|deg|turn|rad)?`;
const FN_ARGS = String.raw`\(\s*(?:${NUM}|none)(?:\s*[,\s/]\s*(?:${NUM}|none)){2,3}\s*\)`;
const SAFE_COLOR = new RegExp(String.raw`^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgba?|hsla?|oklch|oklab)${FN_ARGS})$`, "i");

/** Accepts hex, rgb(), hsl(), oklch() and oklab() only, so nothing can escape into CSS. */
export function isSafeColor(v: unknown): v is string {
  return typeof v === "string" && v.length <= 64 && SAFE_COLOR.test(v.trim());
}

/** Keeps the known keys with safe values. Returns null when a required key is missing. */
export function cleanCustomColors(raw: unknown): CustomColors | null {
  if (!raw || typeof raw !== "object") return null;
  const out: CustomColors = {};
  for (const k of CUSTOM_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (v == null || v === "") continue;
    if (!isSafeColor(v)) return null;
    out[k] = v.trim().toLowerCase();
  }
  return out.bg && out.surface && out.ink && out.ink2 && out.accent ? out : null;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3,8})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]) {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio of two hex colours, or null if either isn't hex. */
export function contrast(a: string, b: string): number | null {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return null;
  const [l1, l2] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** White or near-black, whichever reads better on the accent. */
export function inkOn(color: string): string {
  const light = contrast(color, "#ffffff");
  const dark = contrast(color, "#111114");
  if (light == null || dark == null) return "#ffffff";
  return light >= dark ? "#ffffff" : "#111114";
}

/** Starting colours for the editor, taken from a built-in theme. */
export function customFromTheme(theme: ThemeDef): { light: CustomColors; dark: CustomColors } {
  const pick = (c: ThemeColors): CustomColors => ({ bg: c.bg, surface: c.surface, ink: c.ink, ink2: c.ink2, accent: c.accent });
  return { light: pick(theme.light), dark: pick(theme.dark) };
}

/** CSS custom properties for a custom theme, as `light-dark()` pairs set on <html>. */
export function customVars(light: CustomColors, dark: CustomColors): Record<string, string> {
  const pair = (l?: string, d?: string) => `light-dark(${l}, ${d})`;
  const vars: Record<string, string> = {
    "--bg": pair(light.bg, dark.bg),
    "--surface": pair(light.surface, dark.surface),
    "--ink": pair(light.ink, dark.ink),
    "--ink-2": pair(light.ink2, dark.ink2),
    "--accent": pair(light.accent, dark.accent),
    "--accent-ink": pair(inkOn(light.accent ?? ""), inkOn(dark.accent ?? "")),
  };
  if (light.line || dark.line) {
    const line = (c: CustomColors) => c.line ?? `color-mix(in srgb, ${c.ink} 8%, transparent)`;
    const strong = (c: CustomColors) =>
      c.line ? `color-mix(in oklab, ${c.line} 72%, ${c.ink})` : `color-mix(in srgb, ${c.ink} 14%, transparent)`;
    vars["--line"] = pair(line(light), line(dark));
    vars["--line-strong"] = pair(strong(light), strong(dark));
  }
  return vars;
}

// ─────────────────────────── Applying ───────────────────────────

export const STORAGE_KEYS = { theme: "timeo.theme", mode: "timeo.mode", custom: "timeo.custom" } as const;

/** What the boot script needs to paint a custom theme before React loads. */
export type CustomCache = { id: string; vars: Record<string, string>; bg: [string, string] };

/** id -> [light bg, dark bg] for the browser's theme-color. */
export const THEME_BGS: Record<string, [string, string]> = Object.fromEntries(
  THEMES.map((t) => [t.id, [t.light.bg, t.dark.bg]]),
);

/**
 * Sets data-theme / data-mode and a custom theme's variables on <html>, and
 * points the theme-color meta at the theme's background. Self-contained (no outer references) so its source can be
 * inlined into the boot script.
 */
export function applyAppearance(
  theme: string,
  mode: string,
  bgs: Record<string, [string, string]>,
  custom: { id: string; vars: Record<string, string>; bg: [string, string] } | null,
) {
  const root = document.documentElement;
  const style = root.style;
  for (let i = style.length - 1; i >= 0; i--) {
    const prop = style[i];
    if (prop.indexOf("--") === 0) style.removeProperty(prop);
  }
  let bg: [string, string];
  if (custom && theme === "custom:" + custom.id) {
    for (const k in custom.vars) style.setProperty(k, custom.vars[k]);
    root.setAttribute("data-theme", "custom");
    bg = custom.bg;
  } else {
    const id = bgs[theme] ? theme : "paper";
    root.setAttribute("data-theme", id);
    bg = bgs[id];
  }
  const m = mode === "light" || mode === "dark" ? mode : "system";
  root.setAttribute("data-mode", m);
  // Our own theme-color meta, outside React's metadata so re-renders leave it alone
  let meta = document.head.querySelector('meta[name="theme-color"][data-timeo]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("data-timeo", "");
    document.head.appendChild(meta);
  }
  const dark = m === "dark" || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  meta.setAttribute("content", dark ? bg[1] : bg[0]);
}

/** Reads localStorage; tolerant of anything missing or malformed. */
export function readStoredAppearance(): { theme: string; mode: ColorMode; custom: CustomCache | null } {
  let theme = DEFAULT_THEME;
  let mode: ColorMode = "system";
  let custom: CustomCache | null = null;
  try {
    theme = localStorage.getItem(STORAGE_KEYS.theme) || DEFAULT_THEME;
    const m = localStorage.getItem(STORAGE_KEYS.mode);
    if (isColorMode(m)) mode = m;
    const raw = localStorage.getItem(STORAGE_KEYS.custom);
    if (raw) custom = JSON.parse(raw) as CustomCache;
  } catch {}
  return { theme, mode, custom };
}

/** When the user last changed appearance on this device (so a sync never undoes it). */
export const LOCAL_CHANGE_KEY = "timeo.appearance.changedAt";

/** Applies now and remembers it on this device. `local` marks a change the user just made here. */
export function setAppearance(theme: string, mode: ColorMode, custom: CustomCache | null, local = false) {
  applyAppearance(theme, mode, THEME_BGS, custom);
  try {
    if (local) localStorage.setItem(LOCAL_CHANGE_KEY, String(Date.now()));
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    localStorage.setItem(STORAGE_KEYS.mode, mode);
    if (custom) localStorage.setItem(STORAGE_KEYS.custom, JSON.stringify(custom));
    else localStorage.removeItem(STORAGE_KEYS.custom);
  } catch {}
}

export function customCache(id: string, light: CustomColors, dark: CustomColors): CustomCache {
  return { id, vars: customVars(light, dark), bg: [light.bg ?? "#ffffff", dark.bg ?? "#000000"] };
}

/** Inline <head> script: applies the stored appearance before first paint. */
export function themeBootScript() {
  return `(function(){try{var s=localStorage,c=null;try{c=JSON.parse(s.getItem(${JSON.stringify(STORAGE_KEYS.custom)})||"null")}catch(e){}(${applyAppearance.toString()})(s.getItem(${JSON.stringify(STORAGE_KEYS.theme)})||"paper",s.getItem(${JSON.stringify(STORAGE_KEYS.mode)})||"system",${JSON.stringify(THEME_BGS)},c)}catch(e){}})()`;
}
