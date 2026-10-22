import "server-only";
import type { ExternalTask, TaskProvider } from "../types";
import { READ_LIMIT, enc, parseDue } from "./util";

const API = "https://api.todoist.com/api/v1";

type TTask = {
  id: string;
  content: string;
  description?: string;
  due?: { date: string } | null;
  deadline?: { date: string } | null;
  responsible_uid?: string | null;
  checked?: boolean;
};

export const todoist: TaskProvider = {
  id: "todoist",
  kind: "tasks",
  oauth: {
    env: "TODOIST",
    authorizeUrl: "https://app.todoist.com/oauth/authorize",
    tokenUrl: "https://api.todoist.com/oauth/access_token",
    scopes: ["data:read_write"],
    scopeSeparator: ",",
  },
  token: {
    fields: [{ name: "token", label: "API token", type: "password" }],
    help: "In Todoist, open Settings, then Integrations, then Developer, and copy your API token.",
    helpUrl: "https://app.todoist.com/app/settings/integrations/developer",
    creds: (v) => (v.token?.trim() ? { accessToken: v.token.trim() } : "Paste your Todoist API token"),
  },

  async account(ctx) {
    const me = await ctx.api<{ id: string; email?: string; full_name?: string }>(`${API}/user`);
    return { label: me.email ?? me.full_name ?? "Todoist", creds: { userId: me.id } };
  },

  async tasks(ctx) {
    const items: ExternalTask[] = [];
    let cursor: string | null = null;
    do {
      const page: { results: TTask[]; next_cursor: string | null } = await ctx.api(
        `${API}/tasks?limit=200${cursor ? `&cursor=${enc(cursor)}` : ""}`,
      );
      for (const x of page.results) {
        if (x.checked) continue;
        // in shared projects, tasks given to someone else aren't yours to do
        if (x.responsible_uid && ctx.creds.userId && x.responsible_uid !== ctx.creds.userId) continue;
        // "2026-10-22" (a day), "2026-10-22T09:00:00" (floating) or "…Z" (a fixed time)
        const { due, dueMin } = parseDue(x.due?.date ?? x.deadline?.date, ctx.timezone);
        items.push({
          id: x.id,
          title: x.content,
          notes: x.description || null,
          due,
          dueMin,
          url: `https://app.todoist.com/app/task/${x.id}`,
        });
      }
      cursor = page.next_cursor;
      if (items.length >= READ_LIMIT) return { items, complete: !cursor };
    } while (cursor);
    return { items, complete: true };
  },

  async setDone(ctx, externalId, done) {
    // closing a repeating task moves it to its next date; the next sync brings that back
    await ctx.api(`${API}/tasks/${enc(externalId)}/${done ? "close" : "reopen"}`, { method: "POST" });
  },
};
