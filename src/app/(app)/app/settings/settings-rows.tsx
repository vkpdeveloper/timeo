"use client";

import { AlertCircle, CalendarClock, Check, Globe, LocateFixed, Moon, Palette, Sun, Trash2, User } from "lucide-react";
import { useId, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Select } from "@/components/ui/controls";
import { TimePicker } from "@/components/ui/pickers";
import { Row, RowIcon } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useAccent, useColorMode } from "@/components/shell/theme";
import { formatMin, toTimeInput } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { ACCENTS, DEFAULT_ACCENT, setAccent, setMode, type Accent, type ColorMode } from "@/lib/themes";
import { deleteAccount, saveAccent, saveColorMode, updateDayHours, updateName, updateTimezone, type Result } from "./actions";

/** Sheet open state plus a submit handler that keeps the form's values when saving fails. */
function useSheetForm(action: (fd: FormData) => Promise<Result>) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formId = useId();
  return {
    open,
    formId,
    show: () => {
      setError(null);
      setOpen(true);
    },
    close: () => setOpen(false),
    error,
    pending,
    onSubmit: (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      setError(null);
      start(async () => {
        try {
          const res = await action(fd);
          if (res?.error) setError(res.error);
          else setOpen(false);
        } catch {
          setError("Couldn't save. Try again.");
        }
      });
    },
  };
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mb-3 flex animate-pop items-start gap-2 px-1 text-[13.5px] leading-snug font-medium text-warn">
      <AlertCircle className="mt-px size-4 shrink-0" />
      {error}
    </p>
  );
}

/** The sheet's one action, submitting the form by id. */
function SaveButton({ formId, pending, children = "Save", ...props }: { formId: string; pending: boolean; children?: React.ReactNode } & Omit<React.ComponentProps<typeof Button>, "form">) {
  return (
    <Button type="submit" form={formId} variant="accent" size="lg" loading={pending} {...props}>
      {children}
    </Button>
  );
}

export function NameRow({ name }: { name: string }) {
  const s = useSheetForm(updateName);
  return (
    <>
      <Row onClick={s.show} icon={<User />} title="Name" value={name} />
      <Sheet open={s.open} onClose={s.close} title="Your name" footer={<SaveButton formId={s.formId} pending={s.pending} />}>
        <form id={s.formId} onSubmit={s.onSubmit}>
          <Field>
            <Input name="name" defaultValue={name} maxLength={80} autoComplete="name" aria-label="Name" required autoFocus />
          </Field>
          <ErrorNote error={s.error} />
        </form>
      </Sheet>
    </>
  );
}

const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

export function TimezoneRow({ timezone, zones }: { timezone: string; zones: string[] }) {
  const s = useSheetForm(updateTimezone);
  const [value, setValue] = useState(timezone);
  const device = useSyncExternalStore(
    () => () => {},
    deviceZone,
    () => null,
  );
  const options = zones.includes(timezone) ? zones : [timezone, ...zones];
  const label = (z: string) => z.replaceAll("_", " ");
  return (
    <>
      <Row
        onClick={() => {
          setValue(timezone);
          s.show();
        }}
        icon={<Globe />}
        title="Timezone"
        value={label(timezone)}
      />
      <Sheet
        open={s.open}
        onClose={s.close}
        title="Timezone"
        description="Days start and end here."
        footer={<SaveButton formId={s.formId} pending={s.pending} />}
      >
        <form id={s.formId} onSubmit={s.onSubmit}>
          <Field>
            <Select name="timezone" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Timezone">
              {device && !options.includes(device) && <option value={device}>{label(device)}</option>}
              {options.map((z) => (
                <option key={z} value={z}>
                  {label(z)}
                </option>
              ))}
            </Select>
          </Field>
          {device && device !== value && (
            <Button type="button" variant="secondary" className="mb-4 w-full" onClick={() => setValue(device)}>
              <LocateFixed className="size-4" />
              Use this device&apos;s timezone
            </Button>
          )}
          {device && device === value && <p className="mb-4 px-1 text-[13px] text-ink-3">Matches this device.</p>}
          <ErrorNote error={s.error} />
        </form>
      </Sheet>
    </>
  );
}

export function DayHoursRow({ startMin, endMin }: { startMin: number; endMin: number }) {
  const s = useSheetForm(updateDayHours);
  return (
    <>
      <Row
        onClick={s.show}
        icon={<CalendarClock />}
        title="Planner day"
        value={`${formatMin(startMin)} – ${formatMin(endMin)}`}
      />
      <Sheet
        open={s.open}
        onClose={s.close}
        title="Planner day"
        description="The hours your calendar shows."
        footer={<SaveButton formId={s.formId} pending={s.pending} />}
      >
        <form id={s.formId} onSubmit={s.onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <TimePicker name="start" defaultValue={toTimeInput(startMin)} step={900} aria-label="Day starts" />
            </Field>
            <Field label="Ends">
              <TimePicker name="end" defaultValue={toTimeInput(endMin)} step={900} aria-label="Day ends" />
            </Field>
          </div>
          <ErrorNote error={s.error} />
        </form>
      </Sheet>
    </>
  );
}

export function DeleteAccountRow() {
  const s = useSheetForm(deleteAccount);
  const [typed, setTyped] = useState("");
  return (
    <>
      <Row
        onClick={() => {
          setTyped("");
          s.show();
        }}
        icon={<Trash2 />}
        title="Delete account"
        chevron={false}
      />
      <Sheet
        open={s.open}
        onClose={s.close}
        title="Delete account"
        description="This removes your account and all your data. It can't be undone."
        footer={
          <SaveButton formId={s.formId} pending={s.pending} variant="danger" disabled={typed !== "DELETE"}>
            Delete everything
          </SaveButton>
        }
      >
        <form id={s.formId} onSubmit={s.onSubmit}>
          <Field label="Type DELETE to confirm">
            <Input
              name="confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="DELETE"
            />
          </Field>
          <ErrorNote error={s.error} />
        </form>
      </Sheet>
    </>
  );
}

/**
 * Light | Dark, inline. Flips the page at once and saves to the account, so
 * every device follows. `saved` is the account's mode (null = never picked).
 */
export function AppearanceRow({ saved }: { saved: ColorMode | null }) {
  const mode = useColorMode(saved ?? "light");
  const [, start] = useTransition();
  const pick = (m: ColorMode) => {
    setMode(m, true);
    start(async () => {
      await saveColorMode(m).catch(() => {});
    });
  };
  return (
    <Row icon={mode === "dark" ? <Moon /> : <Sun />} title="Appearance">
      <Segmented<ColorMode>
        size="sm"
        className="ml-auto w-[152px] shrink-0"
        value={mode}
        onChange={pick}
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
    </Row>
  );
}

/**
 * The accent, as a row of swatches. Flips the app at once and saves to the
 * account, so every device follows. The landing page always stays Sky.
 */
export function AccentRow({ saved }: { saved: Accent | null }) {
  const accent = useAccent(saved ?? DEFAULT_ACCENT);
  const [, start] = useTransition();
  const pick = (a: Accent) => {
    setAccent(a, true);
    start(async () => {
      await saveAccent(a).catch(() => {});
    });
  };
  const current = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];
  return (
    <div className="px-4 pt-2.5 pb-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
      <div className="flex min-h-8 items-center gap-3">
        <RowIcon>
          <Palette />
        </RowIcon>
        <div className="flex-1 text-[15px] font-medium text-ink">Accent</div>
        <div className="text-[14px] text-ink-3">{current.label}</div>
      </div>
      <div role="radiogroup" aria-label="Accent" className="mt-1.5 -mx-1 flex justify-between">
        {ACCENTS.map((a) => {
          const on = a.id === accent;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={a.label}
              onClick={() => pick(a.id)}
              className="tap grid size-11 place-items-center rounded-full"
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-shadow",
                  on ? "ring-2 ring-ink" : "ring-1 ring-line-strong",
                )}
                // light-dark() follows the painted mode, like the tokens do
                style={{ background: `light-dark(${a.swatch[0]}, ${a.swatch[1]})` }}
              >
                {on && <Check className="size-3.5" strokeWidth={3} style={{ color: "light-dark(#ffffff, #0b0c0f)" }} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
