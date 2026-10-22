import "server-only";
import type { ExternalTask, TaskProvider } from "../types";
import { READ_LIMIT, enc, parseDue } from "./util";

const API = "https://app.asana.com/api/1.0";

type ATask = { gid: string; name: string; notes?: string; due_on?: string | null; due_at?: string | null; permalink_url?: string };

export const asana: TaskProvider = {
  id: "asana",
  kind: "tasks",
  oauth: {
    env: "ASANA",
    authorizeUrl: "https://app.asana.com/-/oauth_authorize",
    tokenUrl: "https://app.asana.com/-/oauth_token",
    scopes: ["tasks:read", "tasks:write", "users:read", "workspaces:read"],
    pkce: true,
  },
  token: {
    fields: [{ name: "token", label: "Personal access token", type: "password" }],
    help: "In Asana, open the developer console and create a personal access token.",
    helpUrl: "https://app.asana.com/0/my-apps",
    creds: (v) => (v.token?.trim() ? { accessToken: v.token.trim() } : "Paste your Asana token"),
  },

  async account(ctx) {
    const { data } = await ctx.api<{ data: { name?: string; email?: string; workspaces?: { gid: string }[] } }>(
      `${API}/users/me?opt_fields=name,email,workspaces`,
    );
    return { label: data.email ?? data.name ?? "Asana", creds: { workspaces: (data.workspaces ?? []).map((w) => w.gid) } };
  },

  async tasks(ctx) {
    const workspaces = (ctx.creds.workspaces as string[] | undefined) ?? [];
    const items: ExternalTask[] = [];
    for (const workspace of workspaces) {
      let offset: string | undefined;
      do {
        const params = new URLSearchParams({
          assignee: "me",
          workspace,
          completed_since: "now",
          limit: "100",
          opt_fields: "name,notes,due_on,due_at,permalink_url",
        });
        if (offset) params.set("offset", offset);
        const page = await ctx.api<{ data: ATask[]; next_page?: { offset: string } | null }>(`${API}/tasks?${params}`);
        for (const x of page.data) {
          if (!x.name?.trim()) continue;
          items.push({
            id: x.gid,
            title: x.name,
            notes: x.notes || null,
            ...parseDue(x.due_at ?? x.due_on, ctx.timezone),
            url: x.permalink_url ?? null,
          });
        }
        offset = page.next_page?.offset;
        if (items.length >= READ_LIMIT) return { items, complete: false };
      } while (offset);
    }
    return { items, complete: true };
  },

  async setDone(ctx, externalId, done) {
    await ctx.api(`${API}/tasks/${enc(externalId)}`, { method: "PUT", json: { data: { completed: done } } });
  },
};
