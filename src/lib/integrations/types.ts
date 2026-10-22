import type { IntegrationSettings } from "@/db/schema";
import type { IntegrationKind, ProviderId } from "./catalog";

/** What a connection keeps sealed: its token, and ids the provider needs later (site, workspace, user). */
export type Creds = {
  accessToken: string;
  refreshToken?: string;
  /** unix ms; unset for tokens that don't expire */
  expiresAt?: number;
  [key: string]: unknown;
};

export type ApiInit = Omit<RequestInit, "body"> & { json?: unknown; form?: Record<string, string> };

/** Everything a provider needs for one sync. */
export type Ctx = {
  creds: Creds;
  settings: IntegrationSettings;
  /** the user's timezone and today in it */
  timezone: string;
  today: string;
  /** JSON request with the connection's auth. Refreshes an expired OAuth token once. */
  api: <T = unknown>(url: string, init?: ApiInit) => Promise<T>;
};

/** A choice in the connection's sheet: a calendar to show, a Notion database to use. */
export type Choice = { id: string; name: string; color?: string | null; on: boolean };

/** A timed event. Providers leave out all-day, cancelled, declined and free events. */
export type ExternalEvent = {
  id: string;
  calendarId: string;
  title: string;
  /** unix ms */
  start: number;
  end: number;
  url?: string | null;
  kind?: "meeting" | "focus";
};

/** An open task. `due` is a day in the user's timezone; `dueMin` its time when it has one. */
export type ExternalTask = {
  id: string;
  title: string;
  notes?: string | null;
  due?: string | null;
  dueMin?: number | null;
  url?: string | null;
};

export type OAuthConfig = {
  /** env prefix: GOOGLE → GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET */
  env: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  scopeSeparator?: string;
  /** extra authorize params */
  params?: Record<string, string>;
  pkce?: boolean;
  /** how the client proves itself at the token endpoint (default: id and secret in the body) */
  clientAuth?: "body" | "basic";
  /** how the token request carries its fields (default: form body; ClickUp wants them in the URL) */
  tokenFormat?: "form" | "json" | "query";
  /** extra fields for the code exchange (TickTick wants the scope again) */
  tokenParams?: Record<string, string>;
  /** scopes that must come back granted (Google lets people untick some) */
  required?: string[];
  /** ids from the token response worth keeping (Notion's workspace) */
  extra?: (body: Record<string, unknown>) => Partial<Creds>;
};

export type TokenField = {
  name: string;
  label: string;
  placeholder?: string;
  type?: "password" | "text" | "email" | "url";
};

/** Connecting by pasting a token (or a link) instead of OAuth. */
export type TokenConfig = {
  fields: TokenField[];
  /** where to find it, one short line, and a link there */
  help: string;
  helpUrl?: string;
  /** form values → credentials, or a message for the person when they look wrong */
  creds: (values: Record<string, string>) => Creds | string;
};

type Common = {
  id: ProviderId;
  kind: IntegrationKind;
  oauth?: OAuthConfig;
  token?: TokenConfig;
  /** Trello: the app's own page hands the token back in the URL fragment. null when not set up. */
  fragment?: (returnUrl: string) => string | null;
  /** auth headers for a request (default: Bearer access token) */
  headers?: (creds: Creds) => Record<string, string>;
  /** Who's connected, checked right after connecting. May add ids to keep with the token. */
  account: (ctx: Ctx) => Promise<{ label: string; creds?: Partial<Creds> }>;
  /** best effort when disconnecting */
  revoke?: (creds: Creds) => Promise<void>;
};

export type CalendarProvider = Common & {
  kind: "calendar";
  /** Calendars to choose from; `on` marks the ones shown by default. */
  calendars: (ctx: Ctx) => Promise<Choice[]>;
  events: (ctx: Ctx, calendarIds: string[], from: number, to: number) => Promise<ExternalEvent[]>;
};

export type TaskProvider = Common & {
  kind: "tasks";
  /** Every open task. `complete` is false when there were too many to list them all. */
  tasks: (ctx: Ctx) => Promise<{ items: ExternalTask[]; complete: boolean }>;
  setDone: (ctx: Ctx, externalId: string, done: boolean) => Promise<void>;
  /** Default for what to bring in: GitHub issues have no dates, so "all". */
  scope?: "dated" | "all";
};

export type Provider = CalendarProvider | TaskProvider;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The app no longer accepts the connection (revoked, expired for good). Shown as "Reconnect". */
export class ReconnectError extends Error {}
