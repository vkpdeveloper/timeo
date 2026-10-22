import "server-only";
import type { ExternalTask, TaskProvider } from "../types";
import { ApiError } from "../types";
import { READ_LIMIT, enc, pairId, parseDue, splitPair } from "./util";

const API = "https://api.clickup.com/api/v2";

type CTask = {
  id: string;
  name: string;
  text_content?: string | null;
  due_date?: string | null;
  url?: string;
  list?: { id: string };
  status?: { type?: string };
};

type Status = { status: string; type: string; orderindex: number | string };

export const clickup: TaskProvider = {
  id: "clickup",
  kind: "tasks",
  oauth: {
    env: "CLICKUP",
    authorizeUrl: "https://app.clickup.com/api",
    tokenUrl: "https://api.clickup.com/api/v2/oauth/token",
    scopes: [],
    tokenFormat: "query",
  },
  token: {
    fields: [{ name: "token", label: "API token", placeholder: "pk_…", type: "password" }],
    help: "In ClickUp, open Settings, then Apps, and generate your API token.",
    helpUrl: "https://app.clickup.com/settings/apps",
    creds: (v) => (/^pk_/.test(v.token?.trim() ?? "") ? { accessToken: v.token.trim() } : "Paste the token that starts with pk_"),
  },
  // personal tokens go bare; OAuth tokens as Bearer
  headers: (creds) => ({ authorization: creds.accessToken.startsWith("pk_") ? creds.accessToken : `Bearer ${creds.accessToken}` }),

  async account(ctx) {
    const { user } = await ctx.api<{ user: { id: number; username?: string; email?: string } }>(`${API}/user`);
    const { teams } = await ctx.api<{ teams: { id: string }[] }>(`${API}/team`);
    return { label: user.email ?? user.username ?? "ClickUp", creds: { userId: String(user.id), teams: teams.map((t) => t.id) } };
  },

  async tasks(ctx) {
    const teams = (ctx.creds.teams as string[] | undefined) ?? [];
    const items: ExternalTask[] = [];
    for (const team of teams) {
      for (let page = 0; ; page++) {
        const res = await ctx.api<{ tasks: CTask[]; last_page?: boolean }>(
          `${API}/team/${enc(team)}/task?assignees[]=${enc(String(ctx.creds.userId))}&include_closed=false&subtasks=true&page=${page}`,
        );
        for (const x of res.tasks) {
          if (x.status?.type === "closed" || x.status?.type === "done" || !x.list) continue;
          const due = x.due_date ? parseDue(new Date(Number(x.due_date)).toISOString(), ctx.timezone).due : null;
          items.push({ id: pairId(x.list.id, x.id), title: x.name, notes: x.text_content || null, due, url: x.url ?? null });
        }
        if (res.last_page !== false || res.tasks.length < 100) break;
        if (items.length >= READ_LIMIT) return { items, complete: false };
      }
    }
    return { items, complete: true };
  },

  async setDone(ctx, externalId, done) {
    const [list, task] = splitPair(externalId);
    const { statuses } = await ctx.api<{ statuses: Status[] }>(`${API}/list/${enc(list)}`);
    const ordered = [...statuses].sort((a, b) => Number(a.orderindex) - Number(b.orderindex));
    const target = done ? (ordered.find((s) => s.type === "closed") ?? ordered.find((s) => s.type === "done")) : ordered.find((s) => s.type === "open");
    if (!target) throw new ApiError(409, "ClickUp list has no status to move it to");
    await ctx.api(`${API}/task/${enc(task)}`, { method: "PUT", json: { status: target.status } });
  },
};
