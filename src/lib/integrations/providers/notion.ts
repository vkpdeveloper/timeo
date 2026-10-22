import "server-only";
import type { Choice, Ctx, ExternalTask, TaskProvider } from "../types";
import { READ_LIMIT, enc, parseDue } from "./util";

// Notion has no tasks of its own: people keep them in a database. After connecting, they pick
// one, and Timeo works out which properties hold the title, the date and "done".

const API = "https://api.notion.com/v1";

/** Which database tasks come from and how its properties map. Properties are kept by id. */
export type NotionMapping = {
  source: string;
  name: string;
  title: string;
  date: string | null;
  done: { property: string; type: "checkbox" } | { property: string; type: "status" | "select"; done: string[]; open: string | null };
};

type Property = {
  id: string;
  name: string;
  type: string;
  status?: { options: { id: string; name: string }[]; groups: { name: string; option_ids: string[] }[] };
  select?: { options: { name: string }[] };
};

type RichText = { plain_text: string }[];

type Page = {
  id: string;
  url?: string;
  in_trash?: boolean;
  archived?: boolean;
  properties: Record<string, { id: string; type: string; title?: RichText; date?: { start: string } | null }>;
};

const plain = (t: RichText | undefined) => (t ?? []).map((x) => x.plain_text).join("").trim();

/** Databases shared with Timeo, to pick from. */
export async function notionSources(ctx: Ctx): Promise<Choice[]> {
  const out: Choice[] = [];
  let cursor: string | undefined;
  do {
    const page: { results: { id: string; title?: RichText; name?: string }[]; next_cursor: string | null } = await ctx.api(`${API}/search`, {
      method: "POST",
      json: { filter: { property: "object", value: "data_source" }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    for (const r of page.results) out.push({ id: r.id, name: plain(r.title) || r.name || "Untitled", on: false });
    cursor = page.next_cursor ?? undefined;
  } while (cursor && out.length < 300);
  return out;
}

/** Works out a database's title, date and done properties, or says why it can't hold tasks. */
export async function notionMapping(ctx: Ctx, source: string): Promise<NotionMapping | string> {
  const db = await ctx.api<{ id: string; title?: RichText; name?: string; properties: Record<string, Property> }>(
    `${API}/data_sources/${enc(source)}`,
  );
  const props = Object.values(db.properties);
  const title = props.find((p) => p.type === "title");
  if (!title) return "This database has no title column";

  const named = (re: RegExp, type: string) => props.find((p) => p.type === type && re.test(p.name));
  const date = named(/due|deadline|date|when|do on/i, "date") ?? props.find((p) => p.type === "date");

  let done: NotionMapping["done"] | null = null;
  const checkbox = named(/done|complete|finished|check/i, "checkbox");
  const status = props.find((p) => p.type === "status");
  const select = named(/status|state|stage/i, "select");
  if (checkbox) done = { property: checkbox.id, type: "checkbox" };
  else if (status?.status) {
    const ids = (group: RegExp) => status.status!.groups.find((g) => group.test(g.name))?.option_ids ?? [];
    const nameOf = (id: string) => status.status!.options.find((o) => o.id === id)?.name;
    const doneNames = ids(/complete|done/i).map(nameOf).filter((n): n is string => !!n);
    const openName = [...ids(/to-?do|not started/i), ...ids(/progress/i)].map(nameOf).find(Boolean) ?? null;
    if (doneNames.length) done = { property: status.id, type: "status", done: doneNames, open: openName };
  } else if (select?.select) {
    const names = select.select.options.map((o) => o.name);
    const doneNames = names.filter((n) => /^(done|complete|completed|finished|closed)$/i.test(n));
    const openName = names.find((n) => /^(to ?do|not started|open|backlog|next)$/i.test(n)) ?? null;
    if (doneNames.length) done = { property: select.id, type: "select", done: doneNames, open: openName };
  } else {
    const anyCheckbox = props.find((p) => p.type === "checkbox");
    if (anyCheckbox) done = { property: anyCheckbox.id, type: "checkbox" };
  }
  if (!done) return "This database has no checkbox or status to mark tasks done";

  return { source: db.id, name: plain(db.title) || db.name || "Tasks", title: title.id, date: date?.id ?? null, done };
}

function openFilter(done: NotionMapping["done"]) {
  if (done.type === "checkbox") return { property: done.property, checkbox: { equals: false } };
  return { and: done.done.map((name) => ({ property: done.property, [done.type]: { does_not_equal: name } })) };
}

export const notion: TaskProvider = {
  id: "notion",
  kind: "tasks",
  oauth: {
    env: "NOTION",
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    params: { owner: "user" },
    clientAuth: "basic",
    tokenFormat: "json",
  },
  token: {
    fields: [{ name: "token", label: "Integration secret", placeholder: "ntn_…", type: "password" }],
    help: "Create an internal integration in Notion, copy its secret, then share your tasks database with it.",
    helpUrl: "https://www.notion.so/profile/integrations",
    creds: (v) => (v.token?.trim() ? { accessToken: v.token.trim() } : "Paste your integration secret"),
  },
  headers: (creds) => ({ authorization: `Bearer ${creds.accessToken}`, "notion-version": "2025-09-03" }),

  async account(ctx) {
    const me = await ctx.api<{ name?: string; bot?: { workspace_name?: string } }>(`${API}/users/me`);
    return { label: me.bot?.workspace_name ?? me.name ?? "Notion" };
  },

  async tasks(ctx) {
    const map = ctx.settings.notion;
    if (!map) return { items: [], complete: true };
    const items: ExternalTask[] = [];
    let cursor: string | undefined;
    do {
      const page: { results: Page[]; next_cursor: string | null } = await ctx.api(`${API}/data_sources/${enc(map.source)}/query`, {
        method: "POST",
        json: { filter: openFilter(map.done), page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
      });
      for (const p of page.results) {
        if (p.in_trash || p.archived) continue;
        const props = Object.values(p.properties);
        const title = plain(props.find((x) => x.id === map.title)?.title);
        if (!title) continue;
        const date = map.date ? props.find((x) => x.id === map.date)?.date?.start : null;
        items.push({ id: p.id, title, ...parseDue(date, ctx.timezone), url: p.url ?? null });
      }
      cursor = page.next_cursor ?? undefined;
      if (items.length >= READ_LIMIT) return { items, complete: !cursor };
    } while (cursor);
    return { items, complete: true };
  },

  async setDone(ctx, externalId, done) {
    const map = ctx.settings.notion;
    if (!map) return;
    const d = map.done;
    const value =
      d.type === "checkbox"
        ? { checkbox: done }
        : { [d.type]: done ? { name: d.done[0] } : d.open ? { name: d.open } : d.type === "select" ? null : undefined };
    if (Object.values(value)[0] === undefined) return;
    await ctx.api(`${API}/pages/${enc(externalId)}`, { method: "PATCH", json: { properties: { [d.property]: value } } });
  },
};
