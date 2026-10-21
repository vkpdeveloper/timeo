"use client";

import { CalendarClock, Globe, LocateFixed, Trash2, User } from "lucide-react";
import { useId, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/controls";
import { TimePicker } from "@/components/ui/pickers";
import { Row, RowIcon } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { formatMin, toTimeInput } from "@/lib/dates";
import { deleteAccount, updateDayHours, updateName, updateTimezone, type Result } from "./actions";

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
  return <p role="alert" className="mb-3 animate-pop rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">{error}</p>;
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
      <Row onClick={s.show} icon={<User />} iconColor="slate" title="Name" value={name} />
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
        iconColor="sky"
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
        iconColor="indigo"
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
        icon={
          <RowIcon className="bg-bad-soft! text-bad!">
            <Trash2 />
          </RowIcon>
        }
        title="Delete account"
        tone="bad"
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
