"use client";

import { AlertCircle, ArrowUpRight, Check, RefreshCw } from "lucide-react";
import { useEffect, useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { IntegrationLogo } from "@/components/integrations/integration-logo";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Segmented, Toggle } from "@/components/ui/controls";
import { Row, RowIcon, Section } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import type { CatalogEntry, ProviderId } from "@/lib/integrations/catalog";
import type { Choice, TokenField } from "@/lib/integrations/types";
import {
  connectWithToken,
  disconnectIntegration,
  listCalendars,
  listNotionSources,
  saveCalendars,
  saveNotionSource,
  saveScope,
  syncIntegrationNow,
} from "./actions";

export type ListItem = {
  entry: CatalogEntry;
  /** how it connects on this server; null when it isn't set up */
  method: "oauth" | "fragment" | "token" | null;
  token: { fields: TokenField[]; help: string; helpUrl: string | null } | null;
  fragmentUrl: string | null;
  defaultScope: "dated" | "all" | null;
  connection: {
    id: string;
    account: string | null;
    status: "ok" | "error" | "reconnect";
    error: string | null;
    syncedAt: number | null;
    scope: "dated" | "all" | null;
    notion: string | null;
  } | null;
};

type Flash = { connected: string | null; error: string | null; reason: string | null; connect: string | null };

const TRELLO_STATE = "timeo:trello-state";

export function IntegrationList({ items, flash }: { items: ListItem[]; flash: Flash }) {
  const [openId, setOpenId] = useState<ProviderId | null>(
    () => (items.find((i) => [flash.connected, flash.error, flash.connect].includes(i.entry.id))?.entry.id ?? null) as ProviderId | null,
  );
  const [note, setNote] = useState<string | null>(() => {
    if (!flash.error) return null;
    if (flash.reason === "scopes") return "Allow everything on the consent screen, then connect again.";
    return "Connecting didn't finish. Try again.";
  });
  const [, start] = useTransition();

  useEffect(() => {
    const url = new URL(window.location.href);
    // Trello sends the token back in the fragment, with the state we sent along in the query
    const token = new URLSearchParams(url.hash.slice(1)).get("token");
    const state = url.searchParams.get("trello");
    if (state) {
      const expected = sessionStorage.getItem(TRELLO_STATE);
      sessionStorage.removeItem(TRELLO_STATE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the page's own URL once
      setOpenId("trello");
      if (token && expected === state) {
        start(async () => {
          const res = await connectWithToken("trello", { token }).catch(() => ({ error: "Couldn't connect. Try again." }));
          if (res?.error) setNote(res.error);
        });
      } else setNote("Connecting didn't finish. Try again.");
    }
    if (url.search || url.hash) window.history.replaceState(null, "", url.pathname);
  }, []);

  const open = items.find((i) => i.entry.id === openId) ?? null;
  const calendars = items.filter((i) => i.entry.kind === "calendar");
  const tasks = items.filter((i) => i.entry.kind === "tasks");
  const row = (item: ListItem) => (
    <IntegrationRow
      key={item.entry.id}
      item={item}
      onOpen={() => {
        setNote(null);
        setOpenId(item.entry.id);
      }}
    />
  );

  return (
    <div className="pt-2">
      <p className="mb-5 px-1 text-[14px] leading-snug text-ink-2">
        Bring your calendars and tasks into Timeo. Nothing connects until you choose it here.
      </p>
      <Section title="Calendars" hint="Events show on your planner as busy time." card stagger>
        {calendars.map(row)}
      </Section>
      <Section title="Tasks" hint="Open tasks come in. Check one off here and it's done there too." card stagger>
        {tasks.map(row)}
      </Section>
      {open && <IntegrationSheet key={open.entry.id} item={open} note={note} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function IntegrationRow({ item, onOpen }: { item: ListItem; onOpen: () => void }) {
  const c = item.connection;
  const value = c ? (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", c.status === "ok" ? "bg-ok" : "bg-warn")} />
      {c.status === "reconnect" ? "Reconnect" : "On"}
    </span>
  ) : item.method ? null : (
    "Not set up"
  );
  return (
    <Row
      onClick={onOpen}
      icon={
        <RowIcon className="size-8">
          <IntegrationLogo id={item.entry.id} size={32} />
        </RowIcon>
      }
      title={item.entry.name}
      subtitle={c ? (c.account ?? "Connected") : item.entry.blurb}
      value={value}
    />
  );
}

function ago(ms: number) {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(ms);
}

function Note({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "quiet" }) {
  return (
    <p
      role={tone === "warn" ? "alert" : undefined}
      className={cn(
        "mb-4 flex items-start gap-2 px-1 text-[13.5px] leading-snug",
        tone === "warn" ? "animate-pop font-medium text-warn" : "text-ink-3",
      )}
    >
      {tone === "warn" && <AlertCircle className="mt-px size-4 shrink-0" />}
      {children}
    </p>
  );
}

function IntegrationSheet({ item, note, onClose }: { item: ListItem; note: string | null; onClose: () => void }) {
  const { entry, connection } = item;
  const [reconnecting, setReconnecting] = useState(false);
  const title = (
    <span className="flex items-center gap-3">
      <IntegrationLogo id={entry.id} size={36} />
      {entry.name}
    </span>
  );
  // after reconnecting, the refreshed connection is fine again and shows as connected
  if (connection && !(reconnecting && connection.status === "reconnect")) {
    return (
      <Sheet open onClose={onClose} title={title} description={connection.account ?? undefined}>
        <Connected item={item} connection={connection} note={note} onClose={onClose} onReconnect={() => setReconnecting(true)} />
      </Sheet>
    );
  }
  return <ConnectSheet item={item} title={title} note={note} onClose={onClose} />;
}

// ───────────────────────────── Connecting ─────────────────────────────

function ConnectSheet({ item, title, note, onClose }: { item: ListItem; title: ReactNode; note: string | null; onClose: () => void }) {
  const { entry, method } = item;
  const formId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [leaving, setLeaving] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)]));
    setError(null);
    start(async () => {
      try {
        const res = await connectWithToken(entry.id, values);
        if (res?.error) setError(res.error);
      } catch {
        setError("Couldn't connect. Try again.");
      }
    });
  };

  const toTrello = () => {
    if (!item.fragmentUrl) return;
    const state = crypto.randomUUID();
    sessionStorage.setItem(TRELLO_STATE, state);
    const url = new URL(item.fragmentUrl);
    const back = new URL(url.searchParams.get("return_url")!);
    back.searchParams.set("trello", state);
    url.searchParams.set("return_url", back.toString());
    setLeaving(true);
    window.location.href = url.toString();
  };

  const footer =
    method === "oauth" ? (
      <a href={`/api/integrations/${entry.id}/connect`} onClick={() => setLeaving(true)} className={buttonClass("accent", "lg")}>
        {leaving ? <RefreshCw className="size-4 animate-spin" /> : `Connect ${entry.name}`}
      </a>
    ) : method === "fragment" ? (
      <Button variant="accent" size="lg" loading={leaving || pending} onClick={toTrello}>
        Connect {entry.name}
      </Button>
    ) : method === "token" ? (
      <Button type="submit" form={formId} variant="accent" size="lg" loading={pending}>
        Connect
      </Button>
    ) : undefined;

  return (
    <Sheet open onClose={onClose} title={title} description={entry.about} footer={footer}>
      {(error ?? note) && <Note>{error ?? note}</Note>}
      {pending && method === "fragment" && <Note tone="quiet">Connecting…</Note>}
      {!method && <Note tone="quiet">Connecting {entry.name} isn&apos;t set up on this server yet.</Note>}
      {method === "token" && item.token && (
        <form id={formId} onSubmit={submit}>
          {item.token.fields.map((f, i) => (
            <Field key={f.name} label={f.label}>
              <Input
                name={f.name}
                type={f.type === "password" ? "password" : f.type === "email" ? "email" : f.type === "url" ? "url" : "text"}
                placeholder={f.placeholder}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus={i === 0}
                required
              />
            </Field>
          ))}
          <p className="px-1 text-[13px] leading-snug text-ink-3">
            {item.token.help}
            {item.token.helpUrl && (
              <>
                {" "}
                <a href={item.token.helpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center font-medium text-ink-2 underline-offset-2 hover:underline">
                  Open {entry.name}
                  <ArrowUpRight className="size-3.5" />
                </a>
              </>
            )}
          </p>
        </form>
      )}
    </Sheet>
  );
}

// ───────────────────────────── Connected ─────────────────────────────

type Connection = NonNullable<ListItem["connection"]>;

function Connected({
  item,
  connection: c,
  note,
  onClose,
  onReconnect,
}: {
  item: ListItem;
  connection: Connection;
  note: string | null;
  onClose: () => void;
  onReconnect: () => void;
}) {
  const { entry } = item;
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [syncing, startSync] = useTransition();
  const [leaving, startLeave] = useTransition();

  const sync = () =>
    startSync(async () => {
      setError(null);
      const res = await syncIntegrationNow(c.id).catch(() => ({ error: "Couldn't sync. Try again." }));
      if (res?.error) setError(res.error);
    });
  const disconnect = () =>
    startLeave(async () => {
      await disconnectIntegration(c.id);
      onClose();
    });

  return (
    <>
      {(error ?? note) && <Note>{error ?? note}</Note>}
      {c.status === "reconnect" ? (
        <div className="mb-5 rounded-[14px] bg-sunken p-4">
          <p className="text-[14px] leading-snug text-ink-2">{c.error ?? "Access ended. Reconnect to keep syncing."}</p>
          <Button variant="accent" size="md" className="mt-3 w-full" onClick={onReconnect}>
            Reconnect
          </Button>
        </div>
      ) : (
        <div className="mb-5 flex min-h-11 items-center gap-3 px-1">
          <p className={cn("flex-1 text-[13.5px] leading-snug", c.status === "error" ? "text-warn" : "text-ink-3")}>
            {c.status === "error" && c.error ? c.error : c.syncedAt ? `Synced ${ago(c.syncedAt)}` : "Syncing…"}
          </p>
          <Button variant="secondary" size="sm" onClick={sync} loading={syncing}>
            <RefreshCw className="size-3.5" />
            Sync now
          </Button>
        </div>
      )}

      {entry.kind === "calendar" && <CalendarPicker id={c.id} />}
      {entry.id === "notion" && <NotionPicker id={c.id} current={c.notion} />}
      {entry.kind === "tasks" && <ScopePicker id={c.id} scope={c.scope ?? item.defaultScope ?? "dated"} />}

      <div className="mt-6 border-t border-line pt-4">
        {confirming ? (
          <div className="animate-pop">
            <p className="mb-3 px-1 text-[13.5px] leading-snug text-ink-2">
              {entry.kind === "calendar"
                ? `Events from ${entry.name} leave your planner.`
                : `Open tasks from ${entry.name} leave Timeo. Finished ones stay.`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Keep
              </Button>
              <Button variant="danger" onClick={disconnect} loading={leaving}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setConfirming(true)}>
            Disconnect {entry.name}
          </Button>
        )}
      </div>
    </>
  );
}

function PickerSkeleton() {
  return <div className="skeleton h-[104px] rounded-[14px]" />;
}

function CalendarPicker({ id }: { id: string }) {
  const [calendars, setCalendars] = useState<Choice[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    listCalendars(id)
      .then((res) => {
        if (!alive) return;
        if (res.error) setError(res.error);
        setCalendars(res.calendars ?? []);
        setSaved((res.calendars ?? []).filter((c) => c.on).map((c) => c.id));
      })
      .catch(() => alive && setError("Couldn't load your calendars"));
    return () => {
      alive = false;
    };
  }, [id]);

  const on = calendars?.filter((c) => c.on).map((c) => c.id) ?? [];
  const dirty = on.length !== saved.length || on.some((x) => !saved.includes(x));
  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveCalendars(id, on).catch(() => ({ error: "Couldn't save. Try again." }));
      if (res?.error) setError(res.error);
      else setSaved(on);
    });

  return (
    <Section title="Show on planner" className="mt-0">
      {error && <Note>{error}</Note>}
      {!calendars ? (
        <PickerSkeleton />
      ) : calendars.length > 1 || error ? (
        <>
          <div className="card card-list overflow-hidden">
            {calendars.map((cal) => (
              <Row key={cal.id} title={cal.name}>
                <Toggle
                  checked={cal.on}
                  label={cal.name}
                  onChange={(v) => setCalendars((list) => list?.map((x) => (x.id === cal.id ? { ...x, on: v } : x)) ?? null)}
                />
              </Row>
            ))}
          </div>
          {dirty && (
            <Button variant="accent" size="lg" className="mt-3 animate-pop" onClick={save} loading={pending}>
              Save
            </Button>
          )}
        </>
      ) : (
        <Note tone="quiet">All events from this calendar show on your planner.</Note>
      )}
    </Section>
  );
}

function ScopePicker({ id, scope: initial }: { id: string; scope: "dated" | "all" }) {
  const [scope, setScope] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pick = (v: "dated" | "all") => {
    const before = scope;
    setScope(v);
    start(async () => {
      setError(null);
      const res = await saveScope(id, v).catch(() => ({ error: "Couldn't save. Try again." }));
      if (res?.error) {
        setScope(before);
        setError(res.error);
      }
    });
  };
  return (
    <Section
      title="Bring in"
      className="mt-5 first:mt-0"
      hint={scope === "dated" ? "Tasks due in the next two weeks, and overdue ones." : "Every open task. Ones without a date wait under Unscheduled on your planner."}
      action={pending ? <RefreshCw className="size-3.5 animate-spin" /> : undefined}
    >
      {error && <Note>{error}</Note>}
      <Segmented<"dated" | "all">
        value={scope}
        onChange={pick}
        options={[
          { value: "dated", label: "Due soon" },
          { value: "all", label: "All open" },
        ]}
      />
    </Section>
  );
}

function NotionPicker({ id, current }: { id: string; current: string | null }) {
  const [sources, setSources] = useState<Choice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listNotionSources(id)
      .then((res) => {
        if (!alive) return;
        if (res.error) setError(res.error);
        setSources(res.sources ?? []);
      })
      .catch(() => alive && setError("Couldn't load your databases"));
    return () => {
      alive = false;
    };
  }, [id]);

  const pick = (source: string) => {
    setPicking(source);
    start(async () => {
      setError(null);
      const res = await saveNotionSource(id, source).catch(() => ({ error: "Couldn't save. Try again." }));
      if (res?.error) setError(res.error);
      else setSources((list) => list?.map((s) => ({ ...s, on: s.id === source })) ?? null);
      setPicking(null);
    });
  };

  return (
    <Section
      title="Tasks database"
      className="mt-0 mb-5"
      hint={current ? undefined : "Pick the database you keep tasks in."}
    >
      {error && <Note>{error}</Note>}
      {!sources ? (
        <PickerSkeleton />
      ) : sources.length === 0 ? (
        <Note tone="quiet">No databases yet. In Notion, open your tasks database, then share it with Timeo under Connections.</Note>
      ) : (
        <div className="card card-list max-h-[260px] overflow-y-auto overscroll-contain" role="radiogroup" aria-label="Tasks database">
          {sources.map((s) => (
            <Row key={s.id} onClick={pending ? undefined : () => pick(s.id)} title={s.name} chevron={false}>
              <span role="radio" aria-checked={s.on} className="grid size-6 place-items-center">
                {picking === s.id ? (
                  <RefreshCw className="size-4 animate-spin text-ink-3" />
                ) : s.on ? (
                  <Check className="size-[18px] text-accent" strokeWidth={2.4} />
                ) : null}
              </span>
            </Row>
          ))}
        </div>
      )}
    </Section>
  );
}
