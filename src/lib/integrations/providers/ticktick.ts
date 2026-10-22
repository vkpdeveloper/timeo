import "server-only";
import type { ExternalTask, TaskProvider } from "../types";
import { READ_LIMIT, enc, pairId, parseDue, splitPair } from "./util";

const API = "https://api.ticktick.com/open/v1";

type TTask = {
  id: string;
  projectId: string;
  title?: string;
  content?: string;
  desc?: string;
  dueDate?: string;
  isAllDay?: boolean;
  timeZone?: string;
  status?: number;
};

export const ticktick: TaskProvider = {
  id: "ticktick",
  kind: "tasks",
  oauth: {
    env: "TICKTICK",
    authorizeUrl: "https://ticktick.com/oauth/authorize",
    tokenUrl: "https://ticktick.com/oauth/token",
    scopes: ["tasks:read", "tasks:write"],
    clientAuth: "basic",
    tokenParams: { scope: "tasks:read tasks:write" },
  },
  token: {
    fields: [{ name: "token", label: "API token", type: "password" }],
    help: "In TickTick on the web, open Settings, then Account, then API Token, and copy it.",
    helpUrl: "https://ticktick.com/webapp/#settings/account",
    creds: (v) => (v.token?.trim() ? { accessToken: v.token.trim() } : "Paste your TickTick API token"),
  },

  // TickTick has no profile endpoint; listing projects proves the token works
  async account(ctx) {
    await ctx.api(`${API}/project`);
    return { label: "TickTick account" };
  },

  async tasks(ctx) {
    const projects = await ctx.api<{ id: string; closed?: boolean; kind?: string }[]>(`${API}/project`);
    const ids = ["inbox", ...projects.filter((p) => !p.closed && p.kind !== "NOTE").map((p) => p.id)];
    const items: ExternalTask[] = [];
    for (const id of ids) {
      const data = await ctx.api<{ tasks?: TTask[] }>(`${API}/project/${enc(id)}/data`);
      for (const x of data.tasks ?? []) {
        if (x.status !== 0 || !x.title?.trim()) continue;
        // all-day dates are midnight in the task's own timezone
        const due = x.isAllDay
          ? { due: parseDue(x.dueDate, x.timeZone || ctx.timezone).due, dueMin: null }
          : parseDue(x.dueDate, ctx.timezone);
        items.push({
          id: pairId(x.projectId, x.id),
          title: x.title,
          notes: x.content || x.desc || null,
          ...due,
          url: `https://ticktick.com/webapp/#p/${x.projectId}/tasks/${x.id}`,
        });
      }
      if (items.length >= READ_LIMIT) return { items, complete: false };
    }
    return { items, complete: true };
  },

  async setDone(ctx, externalId, done) {
    const [project, task] = splitPair(externalId);
    if (done) await ctx.api(`${API}/project/${enc(project)}/task/${enc(task)}/complete`, { method: "POST" });
    else await ctx.api(`${API}/task/${enc(task)}`, { method: "POST", json: { id: task, projectId: project, status: 0 } });
  },
};
