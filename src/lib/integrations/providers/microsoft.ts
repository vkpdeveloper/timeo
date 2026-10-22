import "server-only";
import type { CalendarProvider, Ctx, ExternalEvent, ExternalTask, OAuthConfig, TaskProvider } from "../types";
import { READ_LIMIT, enc, pairId, splitPair } from "./util";

// Outlook Calendar and Microsoft To Do, through Microsoft Graph. Work, school and personal
// Microsoft accounts all sign in through the "common" endpoint.

const GRAPH = "https://graph.microsoft.com/v1.0";

const oauth = (scopes: string[]): OAuthConfig => ({
  env: "MICROSOFT",
  authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  scopes: ["offline_access", "User.Read", ...scopes],
  pkce: true,
  params: { prompt: "select_account" },
});

async function account(ctx: Ctx) {
  const me = await ctx.api<{ displayName?: string; mail?: string | null; userPrincipalName?: string }>(
    `${GRAPH}/me?$select=displayName,mail,userPrincipalName`,
  );
  return { label: me.mail ?? me.userPrincipalName ?? me.displayName ?? "Microsoft account" };
}

/** Every page of a Graph list, following @odata.nextLink. */
async function all<T>(ctx: Ctx, url: string, init?: { headers?: Record<string, string> }, limit = Infinity) {
  const out: T[] = [];
  for (let next: string | undefined = url; next && out.length < limit; ) {
    const page: { value?: T[]; "@odata.nextLink"?: string } = await ctx.api(next, init);
    out.push(...(page.value ?? []));
    next = page["@odata.nextLink"];
  }
  return out;
}

// ───────────────────────────── Calendar ─────────────────────────────

type MEvent = {
  id: string;
  subject?: string;
  start?: { dateTime: string };
  end?: { dateTime: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  showAs?: string;
  webLink?: string;
  responseStatus?: { response?: string };
};

// With outlook.timezone="UTC", times come as "2026-10-22T09:00:00.0000000" and mean UTC
const utc = (dateTime: string) => Date.parse(`${dateTime.slice(0, 19)}Z`);

export const outlookCalendar: CalendarProvider = {
  id: "outlook-calendar",
  kind: "calendar",
  oauth: oauth(["Calendars.Read"]),
  account,

  async calendars(ctx) {
    const list = await all<{ id: string; name?: string; isDefaultCalendar?: boolean; hexColor?: string }>(
      ctx,
      `${GRAPH}/me/calendars?$select=id,name,isDefaultCalendar,hexColor&$top=100`,
    );
    return list
      .sort((a, b) => Number(!!b.isDefaultCalendar) - Number(!!a.isDefaultCalendar))
      .map((c) => ({ id: c.id, name: c.name ?? "Calendar", color: c.hexColor || null, on: !!c.isDefaultCalendar }));
  },

  async events(ctx, calendarIds, from, to) {
    const lists = await Promise.all(
      calendarIds.map(async (calendarId) => {
        const params = new URLSearchParams({
          startDateTime: new Date(from).toISOString(),
          endDateTime: new Date(to).toISOString(),
          $top: "500",
          $select: "id,subject,start,end,isAllDay,isCancelled,showAs,webLink,responseStatus",
        });
        const events = await all<MEvent>(ctx, `${GRAPH}/me/calendars/${enc(calendarId)}/calendarView?${params}`, {
          headers: { prefer: 'outlook.timezone="UTC", IdType="ImmutableId"' },
        });
        return events.flatMap((e): ExternalEvent[] => {
          if (e.isAllDay || e.isCancelled || e.showAs === "free" || e.responseStatus?.response === "declined") return [];
          if (!e.start?.dateTime || !e.end?.dateTime) return [];
          const start = utc(e.start.dateTime);
          const end = utc(e.end.dateTime);
          if (!Number.isFinite(start) || !(end > start)) return [];
          return [{ id: e.id, calendarId, title: e.subject ?? "", start, end, url: e.webLink ?? null }];
        });
      }),
    );
    return lists.flat();
  },
};

// ───────────────────────────── To Do ─────────────────────────────

type MTask = {
  id: string;
  title?: string;
  status?: string;
  body?: { content?: string; contentType?: string };
  dueDateTime?: { dateTime: string };
};

export const microsoftTodo: TaskProvider = {
  id: "microsoft-todo",
  kind: "tasks",
  oauth: oauth(["Tasks.ReadWrite"]),
  account,

  async tasks(ctx) {
    const lists = await all<{ id: string }>(ctx, `${GRAPH}/me/todo/lists?$top=100`);
    const items: ExternalTask[] = [];
    for (const list of lists) {
      const params = new URLSearchParams({
        $filter: "status ne 'completed'",
        $top: "100",
        $select: "id,title,status,body,dueDateTime",
      });
      const tasks = await all<MTask>(ctx, `${GRAPH}/me/todo/lists/${enc(list.id)}/tasks?${params}`, undefined, READ_LIMIT);
      for (const x of tasks) {
        if (x.status === "completed" || !x.title?.trim()) continue;
        items.push({
          id: pairId(list.id, x.id),
          title: x.title,
          notes: x.body?.contentType === "text" ? x.body.content || null : null,
          // To Do keeps a day: midnight of it, in the timezone it was set in
          due: x.dueDateTime ? x.dueDateTime.dateTime.slice(0, 10) : null,
        });
      }
      if (items.length >= READ_LIMIT) return { items, complete: false };
    }
    return { items, complete: true };
  },

  async setDone(ctx, externalId, done) {
    const [list, task] = splitPair(externalId);
    await ctx.api(`${GRAPH}/me/todo/lists/${enc(list)}/tasks/${enc(task)}`, {
      method: "PATCH",
      json: { status: done ? "completed" : "notStarted" },
    });
  },
};
