import "server-only";
import type { CalendarProvider, Choice, Ctx, ExternalEvent, ExternalTask, OAuthConfig, TaskProvider } from "../types";
import { READ_LIMIT, enc, pairId, splitPair } from "./util";

// Google Calendar and Google Tasks share the sign-in client (GOOGLE_CLIENT_ID), but each asks for
// its own access when connected from Settings. Signing in with Google grants neither.

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];
const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";

const oauth = (scopes: string[]): OAuthConfig => ({
  env: "GOOGLE",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: ["openid", "email", ...scopes],
  pkce: true,
  // offline + consent: a refresh token every time, so syncing keeps working after an hour
  params: { access_type: "offline", prompt: "consent" },
  required: scopes,
});

async function account(ctx: Ctx) {
  const me = await ctx.api<{ email?: string; name?: string }>("https://openidconnect.googleapis.com/v1/userinfo");
  return { label: me.email ?? me.name ?? "Google account" };
}

async function revoke(creds: { accessToken: string; refreshToken?: string }) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: creds.refreshToken ?? creds.accessToken }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
}

// ───────────────────────────── Calendar ─────────────────────────────

const CAL = "https://www.googleapis.com/calendar/v3";

type GCalendar = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
};

type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  transparency?: string;
  eventType?: string;
  htmlLink?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
};

export const googleCalendar: CalendarProvider = {
  id: "google-calendar",
  kind: "calendar",
  oauth: oauth(CALENDAR_SCOPES),
  account,
  revoke,

  async calendars(ctx) {
    const all: GCalendar[] = [];
    let pageToken: string | undefined;
    do {
      const page = await ctx.api<{ items?: GCalendar[]; nextPageToken?: string }>(
        `${CAL}/users/me/calendarList?maxResults=250&minAccessRole=reader${pageToken ? `&pageToken=${enc(pageToken)}` : ""}`,
      );
      all.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return all
      .sort((a, b) => Number(!!b.primary) - Number(!!a.primary))
      .map(
        (c): Choice => ({
          id: c.id,
          name: c.summaryOverride ?? c.summary ?? c.id,
          color: c.backgroundColor ?? null,
          // your own calendars that show in Google Calendar; not coworkers' or subscribed ones
          on: !!c.primary || (!!c.selected && c.accessRole === "owner"),
        }),
      );
  },

  async events(ctx, calendarIds, from, to) {
    const lists = await Promise.all(
      calendarIds.map(async (calendarId) => {
        const out: ExternalEvent[] = [];
        let pageToken: string | undefined;
        do {
          const params = new URLSearchParams({
            singleEvents: "true",
            orderBy: "startTime",
            timeMin: new Date(from).toISOString(),
            timeMax: new Date(to).toISOString(),
            maxResults: "2500",
            fields: "nextPageToken,items(id,status,summary,start,end,transparency,eventType,htmlLink,attendees(self,responseStatus))",
          });
          if (pageToken) params.set("pageToken", pageToken);
          const page = await ctx.api<{ items?: GEvent[]; nextPageToken?: string }>(
            `${CAL}/calendars/${enc(calendarId)}/events?${params}`,
          );
          for (const e of page.items ?? []) {
            const event = toEvent(calendarId, e);
            if (event) out.push(event);
          }
          pageToken = page.nextPageToken;
        } while (pageToken);
        return out;
      }),
    );
    return lists.flat();
  },
};

function toEvent(calendarId: string, e: GEvent): ExternalEvent | null {
  if (e.status === "cancelled") return null;
  // all-day events (start.date) aren't busy time
  if (!e.start?.dateTime || !e.end?.dateTime) return null;
  if (e.transparency === "transparent") return null;
  if (e.eventType === "workingLocation" || e.eventType === "birthday") return null;
  if (e.attendees?.find((a) => a.self)?.responseStatus === "declined") return null;
  const start = Date.parse(e.start.dateTime);
  const end = Date.parse(e.end.dateTime);
  if (!Number.isFinite(start) || !(end > start)) return null;
  return {
    id: e.id,
    calendarId,
    title: e.summary ?? "",
    start,
    end,
    url: e.htmlLink ?? null,
    kind: e.eventType === "focusTime" ? "focus" : "meeting",
  };
}

// ───────────────────────────── Tasks ─────────────────────────────

const TASKS = "https://tasks.googleapis.com/tasks/v1";

type GTask = { id: string; title?: string; notes?: string; due?: string; webViewLink?: string; status?: string };

export const googleTasks: TaskProvider = {
  id: "google-tasks",
  kind: "tasks",
  oauth: oauth([TASKS_SCOPE]),
  account,
  revoke,

  async tasks(ctx) {
    const lists: { id: string }[] = [];
    let pageToken: string | undefined;
    do {
      const page = await ctx.api<{ items?: { id: string }[]; nextPageToken?: string }>(
        `${TASKS}/users/@me/lists?maxResults=100${pageToken ? `&pageToken=${enc(pageToken)}` : ""}`,
      );
      lists.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);

    const items: ExternalTask[] = [];
    for (const list of lists) {
      let next: string | undefined;
      do {
        const page = await ctx.api<{ items?: GTask[]; nextPageToken?: string }>(
          `${TASKS}/lists/${enc(list.id)}/tasks?showCompleted=false&showHidden=false&maxResults=100${next ? `&pageToken=${enc(next)}` : ""}`,
        );
        for (const x of page.items ?? []) {
          if (x.status === "completed" || !x.title?.trim()) continue;
          items.push({
            id: pairId(list.id, x.id),
            title: x.title,
            notes: x.notes ?? null,
            // Google Tasks keeps only the day; the time part is always midnight UTC
            due: x.due ? x.due.slice(0, 10) : null,
            url: x.webViewLink ?? null,
          });
        }
        next = page.nextPageToken;
        if (items.length >= READ_LIMIT) return { items, complete: false };
      } while (next);
    }
    return { items, complete: true };
  },

  async setDone(ctx, externalId, done) {
    const [list, task] = splitPair(externalId);
    await ctx.api(`${TASKS}/lists/${enc(list)}/tasks/${enc(task)}`, {
      method: "PATCH",
      json: done ? { status: "completed" } : { status: "needsAction", completed: null },
    });
  },
};
