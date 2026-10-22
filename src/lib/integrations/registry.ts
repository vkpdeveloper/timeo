import "server-only";
import type { ProviderId } from "./catalog";
import { oauthReady } from "./oauth";
import { asana } from "./providers/asana";
import { clickup } from "./providers/clickup";
import { github } from "./providers/github";
import { googleCalendar, googleTasks } from "./providers/google";
import { appleCalendar } from "./providers/ics";
import { jira } from "./providers/jira";
import { linear } from "./providers/linear";
import { microsoftTodo, outlookCalendar } from "./providers/microsoft";
import { notion } from "./providers/notion";
import { ticktick } from "./providers/ticktick";
import { todoist } from "./providers/todoist";
import { trello } from "./providers/trello";
import type { Provider } from "./types";

const PROVIDERS: Record<ProviderId, Provider> = {
  "google-calendar": googleCalendar,
  "outlook-calendar": outlookCalendar,
  "apple-calendar": appleCalendar,
  todoist,
  ticktick,
  "google-tasks": googleTasks,
  "microsoft-todo": microsoftTodo,
  notion,
  linear,
  github,
  asana,
  clickup,
  trello,
  jira,
};

export const getProvider = (id: string): Provider | undefined => PROVIDERS[id as ProviderId];

/** How an app can be connected on this server: OAuth when its keys are set, else a pasted token. */
export function connectMethod(p: Provider): "oauth" | "fragment" | "token" | null {
  if (oauthReady(p.oauth)) return "oauth";
  if (p.fragment?.("https://example.com")) return "fragment";
  if (p.token) return "token";
  return null;
}
