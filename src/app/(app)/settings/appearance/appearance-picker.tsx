"use client";

import { Check, Pencil, Plus, X } from "lucide-react";
import { useState, useTransition, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented } from "@/components/ui/controls";
import { Section } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/hooks";
import {
  CUSTOM_PREFIX,
  THEMES,
  contrast,
  customCache,
  customFromTheme,
  inkOn,
  isSafeColor,
  setAppearance,
  themeById,
  type ColorMode,
  type CustomColors,
  type ThemeColors,
} from "@/lib/themes";
import { createTheme, deleteTheme, saveAppearance, updateTheme } from "./actions";

type Custom = { id: string; name: string; light: CustomColors; dark: CustomColors };
type Scheme = "light" | "dark";

const MODES: { value: ColorMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** A theme's colours for one mode, filling in anything a custom theme leaves out. */
function swatchColors(c: CustomColors | ThemeColors): Required<Pick<ThemeColors, "bg" | "surface" | "ink" | "ink2" | "accent">> {
  return {
    bg: c.bg ?? "#ffffff",
    surface: c.surface ?? "#ffffff",
    ink: c.ink ?? "#000000",
    ink2: c.ink2 ?? "#666666",
    accent: c.accent ?? "#000000",
  };
}

/** Token overrides so the real UI classes render with a theme that isn't applied yet. */
function previewVars(c: CustomColors, scheme: Scheme): CSSProperties {
  const { bg, surface, ink, ink2, accent } = swatchColors(c);
  const line = c.line ?? `color-mix(in srgb, ${ink} 8%, transparent)`;
  return {
    colorScheme: scheme,
    ["--bg" as string]: bg,
    ["--surface" as string]: surface,
    ["--ink" as string]: ink,
    ["--ink-2" as string]: ink2,
    ["--ink-3" as string]: `color-mix(in oklab, ${ink2} 62%, ${bg})`,
    ["--sunken" as string]:
      scheme === "light" ? `color-mix(in oklab, ${bg} 95%, ${ink})` : `color-mix(in oklab, ${bg} 60%, ${surface})`,
    ["--line" as string]: line,
    ["--line-strong" as string]: c.line ? `color-mix(in oklab, ${line} 72%, ${ink})` : `color-mix(in srgb, ${ink} 14%, transparent)`,
    ["--accent" as string]: accent,
    ["--accent-ink" as string]: inkOn(accent),
    ["--accent-soft" as string]: `color-mix(in oklab, ${accent} 13%, ${surface})`,
  };
}

export function AppearancePicker({
  initialTheme,
  initialMode,
  customThemes,
}: {
  initialTheme: string;
  initialMode: ColorMode;
  customThemes: Custom[];
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [mode, setMode] = useState<ColorMode>(initialMode);
  const [editTarget, setEditTarget] = useState<Custom | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const osDark = useMediaQuery("(prefers-color-scheme: dark)");
  const scheme: Scheme = mode === "system" ? (osDark ? "dark" : "light") : mode;

  const cacheFor = (value: string, list = customThemes) => {
    if (!value.startsWith(CUSTOM_PREFIX)) return null;
    const c = list.find((x) => CUSTOM_PREFIX + x.id === value);
    return c ? customCache(c.id, c.light, c.dark) : null;
  };

  const openEditor = (target: Custom | null) => {
    setEditTarget(target);
    setEditorKey((k) => k + 1);
    setEditorOpen(true);
  };

  const choose = (nextTheme: string, nextMode: ColorMode) => {
    setTheme(nextTheme);
    setMode(nextMode);
    setError(null);
    setAppearance(nextTheme, nextMode, cacheFor(nextTheme), true);
    start(async () => {
      const res = await saveAppearance(nextTheme, nextMode);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="fade-up">
      <LivePreview />

      <Section title="Mode" className="mt-7">
        <Segmented options={MODES} value={mode} onChange={(m) => choose(theme, m)} className="[&>button]:h-11" />
      </Section>

      <Section title="Theme">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => (
            <Swatch
              key={t.id}
              name={t.name}
              colors={t[scheme]}
              selected={theme === t.id}
              onSelect={() => choose(t.id, mode)}
            />
          ))}
        </div>
      </Section>

      <Section title="Your themes">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {customThemes.map((c) => (
            <Swatch
              key={c.id}
              name={c.name}
              colors={c[scheme]}
              selected={theme === CUSTOM_PREFIX + c.id}
              onSelect={() => choose(CUSTOM_PREFIX + c.id, mode)}
              onEdit={() => openEditor(c)}
            />
          ))}
          <button
            type="button"
            onClick={() => openEditor(null)}
            className="tap flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-line-strong text-ink-2 active:bg-sunken"
          >
            <span className="grid size-9 place-items-center rounded-full bg-sunken">
              <Plus className="size-[18px]" />
            </span>
            <span className="text-[14px] font-medium">Create theme</span>
          </button>
        </div>
      </Section>

      {error && <p className="mt-4 px-1 text-[13.5px] font-medium text-bad">{error}</p>}

      <ThemeEditor
        key={editorKey}
        open={editorOpen}
        theme={editTarget}
        startFrom={themeById(theme) ?? THEMES[0]}
        scheme={scheme}
        onClose={() => setEditorOpen(false)}
        onSaved={(c, created) => {
          setEditorOpen(false);
          if (!created && theme !== CUSTOM_PREFIX + c.id) return;
          setTheme(CUSTOM_PREFIX + c.id);
          setAppearance(CUSTOM_PREFIX + c.id, mode, customCache(c.id, c.light, c.dark), true);
        }}
        onDeleted={(id) => {
          setEditorOpen(false);
          if (theme === CUSTOM_PREFIX + id) {
            setTheme("paper");
            setAppearance("paper", mode, null, true);
          }
        }}
      />
    </div>
  );
}

/** A fake goal card and buttons drawn with whatever tokens are in scope. */
function LivePreview({ style, compact }: { style?: CSSProperties; compact?: boolean }) {
  return (
    <div
      style={style}
      className={cn(
        "rounded-[22px] border border-line bg-bg text-ink transition-colors duration-300",
        compact ? "p-3" : "p-4",
      )}
      aria-hidden
    >
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent" />
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Goal · Week 6 of 12</div>
            <div className="mt-1 text-[16px] font-semibold tracking-tight text-ink">Run a half marathon</div>
            <div className="mt-0.5 text-[13.5px] text-ink-2">Three runs a week, one long</div>
          </div>
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">On track</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
            <div className="h-full w-[58%] rounded-full bg-accent" />
          </div>
          <span className="tnum text-[12.5px] font-medium text-ink-3">58%</span>
        </div>
        <div className="mt-4 flex gap-2 border-t border-line pt-4">
          <span className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-accent text-[14px] font-semibold text-accent-ink">
            Start focus
          </span>
          <span className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-sunken text-[14px] font-semibold text-ink">
            Plan week
          </span>
        </div>
      </div>
    </div>
  );
}

function Swatch({
  name,
  colors,
  selected,
  onSelect,
  onEdit,
}: {
  name: string;
  colors: CustomColors | ThemeColors;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
}) {
  const c = swatchColors(colors);
  return (
    <div
      className={cn(
        "relative rounded-[18px] border bg-surface p-1.5 transition-[border-color,box-shadow] duration-200",
        selected ? "border-accent shadow-[inset_0_0_0_1px_var(--accent)]" : "border-line",
      )}
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={name} className="tap block w-full text-left">
        <span
          className="relative block h-[78px] overflow-hidden rounded-[13px]"
          style={{ background: c.bg, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c.ink} 8%, transparent)` }}
        >
          <span
            className="absolute inset-x-2.5 top-2.5 block rounded-[9px] px-2.5 py-2"
            style={{ background: c.surface, boxShadow: `0 0 0 1px color-mix(in srgb, ${c.ink} 7%, transparent)` }}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: c.accent }} />
              <span className="block h-[5px] w-3/5 rounded-full" style={{ background: c.ink }} />
            </span>
            <span className="mt-1.5 block h-1 w-2/5 rounded-full opacity-70" style={{ background: c.ink2 }} />
          </span>
          <span className="absolute bottom-2.5 left-2.5 block h-[14px] w-10 rounded-full" style={{ background: c.accent }} />
        </span>
        <span className="flex h-9 items-center gap-1.5 px-1.5">
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{name}</span>
          {selected && (
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
              <Check className="size-3" strokeWidth={3} />
            </span>
          )}
        </span>
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${name}`}
          className="tap absolute top-3 right-3 grid size-11 place-items-center rounded-full"
        >
          <span className="grid size-8 place-items-center rounded-full bg-surface/90 text-ink-2 shadow-soft backdrop-blur">
            <Pencil className="size-3.5" />
          </span>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────── Editor ───────────────────────────

const FIELDS: { key: keyof CustomColors; label: string; hint?: string }[] = [
  { key: "bg", label: "Background" },
  { key: "surface", label: "Cards" },
  { key: "ink", label: "Text" },
  { key: "ink2", label: "Muted text" },
  { key: "accent", label: "Accent" },
  { key: "line", label: "Borders", hint: "Optional" },
];

/** #rgb / #rrggbb only, for <input type="color">. */
function hex6(v: string | undefined): string | null {
  if (!v) return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  return m[1].length === 3 ? "#" + [...m[1]].map((c) => c + c).join("").toLowerCase() : v.trim().toLowerCase();
}

/** sRGB mix of two hex colours, for a starting border colour. */
function mixHex(a: string, b: string, p: number) {
  const x = hex6(a);
  const y = hex6(b);
  if (!x || !y) return a;
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2].map((i) => Math.round(ch(x, i) * (1 - p) + ch(y, i) * p).toString(16).padStart(2, "0")).join("");
}

function ThemeEditor({
  open,
  theme,
  startFrom,
  scheme,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  theme: Custom | null;
  startFrom: (typeof THEMES)[number];
  scheme: Scheme;
  onClose: () => void;
  onSaved: (c: Custom, created: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const initial = theme ?? { id: "", name: "", ...customFromTheme(startFrom) };
  const [name, setName] = useState(initial.name);
  const [colors, setColors] = useState({ light: initial.light, dark: initial.dark });
  const [base, setBase] = useState(theme ? null : startFrom.id);
  const [tab, setTab] = useState<Scheme>(scheme);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const current = colors[tab];
  const set = (key: keyof CustomColors, value: string | undefined) =>
    setColors((c) => ({ ...c, [tab]: { ...c[tab], [key]: value } }));

  const ratio = (a?: string, b?: string) => (a && b ? contrast(a, b) : null);
  const textRatio = ratio(current.ink, current.surface);
  const mutedRatio = ratio(current.ink2, current.surface);
  const accentRatio = ratio(current.accent, current.surface);
  const warning =
    textRatio != null && textRatio < 4.5
      ? `Text is hard to read on cards (${textRatio.toFixed(1)}:1)`
      : mutedRatio != null && mutedRatio < 3
        ? `Muted text is faint (${mutedRatio.toFixed(1)}:1)`
        : accentRatio != null && accentRatio < 3
          ? `Accent is faint on cards (${accentRatio.toFixed(1)}:1)`
          : null;

  const save = () => {
    setError(null);
    start(async () => {
      const res = theme
        ? await updateTheme(theme.id, name, colors.light, colors.dark)
        : await createTheme(name, colors.light, colors.dark);
      if (res?.error || !res?.id) return setError(res?.error ?? "Could not save");
      onSaved({ id: res.id, name, light: colors.light, dark: colors.dark }, !theme);
    });
  };

  const remove = () => {
    if (!theme) return;
    if (!confirmDelete) return setConfirmDelete(true);
    start(async () => {
      const res = await deleteTheme(theme.id);
      if (res?.error) return setError(res.error);
      onDeleted(theme.id);
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title={theme ? "Edit theme" : "Create theme"}
      footer={
        <div className="flex gap-2">
          {theme && (
            <Button variant="danger" onClick={remove} disabled={pending} className="h-[52px] shrink-0 rounded-2xl px-5">
              {confirmDelete ? "Delete?" : "Delete"}
            </Button>
          )}
          <Button size="lg" onClick={save} loading={pending}>
            {theme ? "Save" : "Save and use"}
          </Button>
        </div>
      }
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My theme" maxLength={40} />
      </Field>

      <Field label="Start from">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {THEMES.map((t) => {
            const c = t[tab];
            const active = base === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setBase(t.id);
                  setColors(customFromTheme(t));
                }}
                className={cn(
                  "tap flex h-11 shrink-0 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-[13.5px] font-medium",
                  active ? "border-accent text-ink" : "border-line text-ink-2",
                )}
              >
                <span
                  className="grid size-8 place-items-center rounded-full"
                  style={{ background: c.bg, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c.ink} 12%, transparent)` }}
                >
                  <span className="size-3 rounded-full" style={{ background: c.accent }} />
                </span>
                {t.name}
              </button>
            );
          })}
        </div>
      </Field>

      <Segmented
        options={[
          { value: "light" as Scheme, label: "Light" },
          { value: "dark" as Scheme, label: "Dark" },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-4 [&>button]:h-10"
      />

      <LivePreview style={previewVars(current, tab)} compact />
      {warning && <p className="mt-2 px-1 text-[13px] font-medium text-warn">{warning}</p>}

      <div className="card mt-4 overflow-hidden">
        {FIELDS.map(({ key, label, hint }) => {
          const value = current[key];
          const fallback =
            key === "line" ? mixHex(current.surface ?? "#ffffff", current.ink ?? "#000000", 0.12) : "#000000";
          return (
            <div key={key} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <label className="relative grid size-11 shrink-0 cursor-pointer place-items-center">
                <span
                  className="size-9 rounded-full"
                  style={{
                    backgroundColor: value && isSafeColor(value) ? value : "transparent",
                    boxShadow: "inset 0 0 0 1px var(--line-strong)",
                    backgroundImage: value
                      ? undefined
                      : "repeating-linear-gradient(45deg, var(--line-strong) 0 2px, transparent 2px 6px)",
                  }}
                />
                <input
                  type="color"
                  aria-label={label}
                  value={hex6(value) ?? hex6(fallback) ?? "#000000"}
                  onChange={(e) => set(key, e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-ink">{label}</div>
                {hint && !value && <div className="text-[12.5px] text-ink-3">{hint}. Automatic</div>}
              </div>
              {value != null ? (
                <>
                  <input
                    value={value}
                    onChange={(e) => set(key, e.target.value)}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-label={`${label} hex`}
                    className={cn(
                      "field tnum w-[104px] px-3 py-2 font-mono text-[16px]",
                      !isSafeColor(value) && "border-bad",
                    )}
                  />
                  {key === "line" && (
                    <button
                      type="button"
                      onClick={() => set("line", undefined)}
                      aria-label="Use automatic borders"
                      className="tap -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-3"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => set(key, fallback)}
                  className="tap h-11 rounded-full px-3 text-[14px] font-medium text-accent"
                >
                  Set
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 px-1 text-[13px] leading-relaxed text-ink-3">
        Lighter cards, muted lines and soft accents are worked out from these.
      </p>
      {error && <p className="mt-3 px-1 text-[13.5px] font-medium text-bad">{error}</p>}
    </Sheet>
  );
}
