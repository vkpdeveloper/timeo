"use client";

import { Bell, BellOff, Share, SquarePlus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, saveNotifyPrefs, savePushSubscription, sendTestPush } from "@/actions/push";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/pickers";
import { Card, RowIcon, Section } from "@/components/ui/primitives";
import { toTimeInput, parseTime } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { currentSubscription, pushSupport, subscribePush, unsubscribePush, type PushSupport } from "@/lib/push/client";
import type { NotifyPrefs } from "@/lib/push/types";

type Item = { key: keyof NotifyPrefs; title: string; hint: string; time?: keyof NotifyPrefs; lead?: boolean };

const ITEMS: Item[] = [
  { key: "blocks", title: "Time blocks", hint: "Before each block starts", lead: true },
  { key: "morning", title: "Morning read", hint: "Your coach's one-line plan", time: "morningMin" },
  { key: "workout", title: "Gym", hint: "30 min before your session" },
  { key: "evening", title: "Evening check-in", hint: "If you haven't reflected", time: "eveningMin" },
  { key: "weekly", title: "Weekly review", hint: "Sunday at 7 PM" },
  { key: "water", title: "Water", hint: "When you're behind, 3× a day" },
];

export function NotificationSettings({
  prefs: initial,
  endpoints,
  configured,
}: {
  prefs: NotifyPrefs;
  endpoints: string[];
  configured: boolean;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [support, setSupport] = useState<PushSupport>("default");
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    // read browser state after mount (permission, existing subscription)
    let alive = true;
    const s = pushSupport();
    currentSubscription()
      .then((sub) => {
        if (!alive) return;
        setSupport(s);
        setThisDevice(sub?.endpoint ?? null);
      })
      .catch(() => alive && setSupport(s));
    return () => {
      alive = false;
    };
  }, []);

  const enabledHere = !!thisDevice && endpoints.includes(thisDevice);

  const enable = () =>
    start(async () => {
      setNote(null);
      try {
        const sub = await subscribePush();
        setSupport(pushSupport());
        if (!sub) return setNote("Notifications are blocked. Allow them in your browser settings.");
        await savePushSubscription(sub, navigator.userAgent);
        setThisDevice(sub.endpoint ?? null);
        const { reached } = await sendTestPush();
        setNote(reached ? "On. We sent a test notification." : "On, but the test didn't arrive. Try again.");
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Couldn't turn on notifications");
      }
    });

  const disable = () =>
    start(async () => {
      const endpoint = await unsubscribePush();
      if (endpoint) await removePushSubscription(endpoint);
      setThisDevice(null);
      setNote("Off on this device.");
    });

  const update = (patch: Partial<NotifyPrefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    start(() => saveNotifyPrefs(patch));
  };

  return (
    <div className="pt-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <RowIcon color={enabledHere ? "sage" : undefined} className="size-10! rounded-[12px]!">
            {enabledHere ? <Bell /> : <BellOff />}
          </RowIcon>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold tracking-tight text-ink">{enabledHere ? "On for this device" : "Off on this device"}</div>
            <p className="text-[13px] leading-snug text-ink-3">
              {endpoints.length > 0
                ? `${endpoints.length} device${endpoints.length > 1 ? "s" : ""} get reminders.`
                : "A nudge before blocks, workouts and check-ins."}
            </p>
          </div>
        </div>

        {!configured ? (
          <p className="mt-3.5 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13.5px] font-medium text-warn">
            Push isn&apos;t configured on the server yet (VAPID keys missing).
          </p>
        ) : support === "needs-install" ? (
          <div className="mt-3.5 rounded-2xl bg-sunken p-3.5 text-[14px] leading-relaxed text-ink-2">
            On iPhone, notifications work once Timeo is on your Home Screen:
            <ol className="mt-2 space-y-1.5">
              <li className="flex items-center gap-2">
                1. Tap <Share className="size-4 text-accent" /> Share in Safari
              </li>
              <li className="flex items-center gap-2">
                2. Choose <SquarePlus className="size-4 text-accent" /> Add to Home Screen
              </li>
              <li>3. Open Timeo from the Home Screen and come back here</li>
            </ol>
          </div>
        ) : support === "unsupported" ? (
          <p className="mt-3.5 text-[13.5px] text-ink-3">This browser doesn&apos;t support push notifications.</p>
        ) : support === "denied" ? (
          <p className="mt-3.5 rounded-xl bg-bad-soft px-3.5 py-2.5 text-[13.5px] font-medium text-bad">
            Notifications are blocked for this site. Allow them in browser settings, then come back.
          </p>
        ) : enabledHere ? (
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const { reached } = await sendTestPush();
                  setNote(reached ? "Sent. Check your notifications." : "Nothing arrived. Try turning it off and on.");
                })
              }
            >
              Send test
            </Button>
            <Button variant="ghost" onClick={disable} disabled={pending}>
              Turn off
            </Button>
          </div>
        ) : (
          <Button variant="accent" size="lg" className="mt-4" onClick={enable} loading={pending}>
            Turn on notifications
          </Button>
        )}
        {note && <p className="mt-3 animate-rise text-[13px] text-ink-3">{note}</p>}
      </Card>

      <Section title="Remind me about" card stagger>
        {ITEMS.map((item) => {
          const on = prefs[item.key] as boolean;
          return (
            <div key={item.key} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-ink">{item.title}</div>
                <div className="text-[12.5px] leading-snug text-ink-3">{item.hint}</div>
              </div>
              {on && item.time && (
                <TimePicker
                  aria-label={`${item.title} time`}
                  value={toTimeInput(prefs[item.time] as number)}
                  onChange={(v) => {
                    const m = parseTime(v);
                    if (m != null) update({ [item.time!]: m } as Partial<NotifyPrefs>);
                  }}
                  step={900}
                  className="min-h-10 w-[118px] shrink-0 py-2 text-[15px]"
                />
              )}
              {on && item.lead && (
                <select
                  aria-label="Minutes before"
                  value={prefs.blockLeadMin}
                  onChange={(e) => update({ blockLeadMin: Number(e.target.value) })}
                  className="field w-[104px] py-2 text-[15px]"
                >
                  {[0, 5, 10, 15, 30].map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? "At start" : `${m} min`}
                    </option>
                  ))}
                </select>
              )}
              <Toggle checked={on} onChange={(v) => update({ [item.key]: v } as Partial<NotifyPrefs>)} label={item.title} />
            </div>
          );
        })}
      </Section>
      <p className="mt-2.5 px-1 text-[12.5px] leading-relaxed text-ink-3">
        Nothing is sent outside your planner day, except blocks you scheduled. Timi also tells you when a background task finishes.
      </p>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("tap relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200", checked ? "bg-ok" : "bg-line-strong")}
    >
      <span
        className={cn(
          "absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.2)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
