"use client";

import { ChevronRight, LocateFixed, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/controls";
import { TimePicker } from "@/components/ui/pickers";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { formatMin, toTimeInput } from "@/lib/dates";
import { deleteAccount, updateDayHours, updateName, updateTimezone, type Result } from "./actions";

/** A Row-styled button that opens a sheet. */
function RowButton({
  label,
  value,
  onClick,
  danger,
  icon,
}: {
  label: ReactNode;
  value?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-sunken [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line"
    >
      {icon}
      <span className={cn("flex-1 text-[15px] font-medium", danger ? "text-bad" : "text-ink")}>{label}</span>
      {value != null && <span className="max-w-[55%] truncate text-[14px] text-ink-3">{value}</span>}
      {!danger && <ChevronRight className="size-4 shrink-0 text-ink-3" />}
    </button>
  );
}

/** Sheet open state plus a submit handler that keeps the form's values when saving fails. */
function useSheetForm(action: (fd: FormData) => Promise<Result>) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return {
    open,
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
  return <p className="mb-3 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{error}</p>;
}

export function NameRow({ name }: { name: string }) {
  const s = useSheetForm(updateName);
  return (
    <>
      <RowButton label="Name" value={name} onClick={s.show} />
      <Sheet open={s.open} onClose={s.close} title="Your name">
        <form onSubmit={s.onSubmit}>
          <Field>
            <Input name="name" defaultValue={name} maxLength={80} autoComplete="name" required autoFocus />
          </Field>
          <ErrorNote error={s.error} />
          <Button type="submit" size="lg" loading={s.pending}>
            Save
          </Button>
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
      <RowButton
        label="Timezone"
        value={label(timezone)}
        onClick={() => {
          setValue(timezone);
          s.show();
        }}
      />
      <Sheet open={s.open} onClose={s.close} title="Timezone" description="Days start and end here.">
        <form onSubmit={s.onSubmit}>
          <Field>
            <Select name="timezone" value={value} onChange={(e) => setValue(e.target.value)}>
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
          {device && device === value && (
            <p className="mb-4 px-1 text-[13px] text-ink-3">Matches this device.</p>
          )}
          <ErrorNote error={s.error} />
          <Button type="submit" size="lg" loading={s.pending}>
            Save
          </Button>
        </form>
      </Sheet>
    </>
  );
}

export function DayHoursRow({ startMin, endMin }: { startMin: number; endMin: number }) {
  const s = useSheetForm(updateDayHours);
  return (
    <>
      <RowButton label="Planner day" value={`${formatMin(startMin)} – ${formatMin(endMin)}`} onClick={s.show} />
      <Sheet open={s.open} onClose={s.close} title="Planner day" description="The hours your calendar shows.">
        <form onSubmit={s.onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <TimePicker name="start" defaultValue={toTimeInput(startMin)} step={900} aria-label="Day starts" />
            </Field>
            <Field label="Ends">
              <TimePicker name="end" defaultValue={toTimeInput(endMin)} step={900} aria-label="Day ends" />
            </Field>
          </div>
          <ErrorNote error={s.error} />
          <Button type="submit" size="lg" loading={s.pending}>
            Save
          </Button>
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
      <RowButton
        label="Delete account"
        danger
        icon={
          <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-bad-soft text-bad">
            <Trash2 className="size-[17px]" />
          </span>
        }
        onClick={() => {
          setTyped("");
          s.show();
        }}
      />
      <Sheet
        open={s.open}
        onClose={s.close}
        title="Delete account"
        description="This removes your account and all your data. It can't be undone."
      >
        <form onSubmit={s.onSubmit}>
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
          <Button type="submit" size="lg" variant="danger" loading={s.pending} disabled={typed !== "DELETE"}>
            Delete everything
          </Button>
        </form>
      </Sheet>
    </>
  );
}

