// The apps Timeo connects to, as Settings shows them. Safe to import from client components;
// how each one talks to its API lives in ./providers.

export type ProviderId =
  | "google-calendar"
  | "outlook-calendar"
  | "apple-calendar"
  | "todoist"
  | "ticktick"
  | "google-tasks"
  | "microsoft-todo"
  | "notion"
  | "linear"
  | "github"
  | "asana"
  | "clickup"
  | "trello"
  | "jira";

export type IntegrationKind = "calendar" | "tasks";

export type CatalogEntry = {
  id: ProviderId;
  name: string;
  kind: IntegrationKind;
  /** One line under the name before it's connected. */
  blurb: string;
  /** What connecting does, shown in its sheet. */
  about: string;
  /** The logo is a tile itself (fills the frame), or a mark that sits on a white tile with some air. */
  logo: "icon" | "mark";
};

export const CATALOG: CatalogEntry[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    kind: "calendar",
    blurb: "Events show on your planner",
    about: "Events from the calendars you pick show on your planner as busy time, so blocks fit around them. Timeo only reads your calendar.",
    logo: "mark",
  },
  {
    id: "outlook-calendar",
    name: "Outlook Calendar",
    kind: "calendar",
    blurb: "Microsoft 365 and Outlook.com",
    about: "Events from the calendars you pick show on your planner as busy time, so blocks fit around them. Timeo only reads your calendar.",
    logo: "mark",
  },
  {
    id: "apple-calendar",
    name: "Apple Calendar",
    kind: "calendar",
    blurb: "iCloud, or any iCal link",
    about: "Paste a calendar's public iCal link and its events show on your planner as busy time. Works with iCloud, Fastmail, Proton and any app that shares an .ics link.",
    logo: "icon",
  },
  {
    id: "todoist",
    name: "Todoist",
    kind: "tasks",
    blurb: "Tasks with a date land in Today",
    about: "Open tasks come into Timeo, where you can give them time on the planner. Checking one off here checks it off in Todoist too.",
    logo: "icon",
  },
  {
    id: "ticktick",
    name: "TickTick",
    kind: "tasks",
    blurb: "Tasks with a date land in Today",
    about: "Open tasks come into Timeo, where you can give them time on the planner. Checking one off here checks it off in TickTick too.",
    logo: "mark",
  },
  {
    id: "google-tasks",
    name: "Google Tasks",
    kind: "tasks",
    blurb: "Tasks with a date land in Today",
    about: "Open tasks from all your lists come into Timeo. Checking one off here checks it off in Google Tasks too.",
    logo: "mark",
  },
  {
    id: "microsoft-todo",
    name: "Microsoft To Do",
    kind: "tasks",
    blurb: "Tasks with a date land in Today",
    about: "Open tasks from all your lists come into Timeo. Checking one off here checks it off in To Do too.",
    logo: "mark",
  },
  {
    id: "notion",
    name: "Notion",
    kind: "tasks",
    blurb: "Tasks from a database",
    about: "Pick a tasks database and its open rows come into Timeo. Checking one off here ticks its checkbox or moves its status to done in Notion.",
    logo: "mark",
  },
  {
    id: "linear",
    name: "Linear",
    kind: "tasks",
    blurb: "Issues assigned to you",
    about: "Open issues assigned to you come into Timeo. Checking one off here moves it to Done in Linear.",
    logo: "mark",
  },
  {
    id: "github",
    name: "GitHub",
    kind: "tasks",
    blurb: "Issues assigned to you",
    about: "Open issues assigned to you come into Timeo. Checking one off here closes it on GitHub.",
    logo: "mark",
  },
  {
    id: "asana",
    name: "Asana",
    kind: "tasks",
    blurb: "Tasks assigned to you",
    about: "Open tasks assigned to you come into Timeo. Checking one off here completes it in Asana.",
    logo: "mark",
  },
  {
    id: "clickup",
    name: "ClickUp",
    kind: "tasks",
    blurb: "Tasks assigned to you",
    about: "Open tasks assigned to you come into Timeo. Checking one off here closes it in ClickUp.",
    logo: "mark",
  },
  {
    id: "trello",
    name: "Trello",
    kind: "tasks",
    blurb: "Cards you're a member of",
    about: "Open cards you're a member of come into Timeo. Checking one off here marks its due date complete in Trello.",
    logo: "icon",
  },
  {
    id: "jira",
    name: "Jira",
    kind: "tasks",
    blurb: "Issues assigned to you",
    about: "Open issues assigned to you come into Timeo. Checking one off here moves it to a done status in Jira.",
    logo: "icon",
  },
];

const byId = new Map(CATALOG.map((e) => [e.id, e]));

export const catalogEntry = (id: string): CatalogEntry | undefined => byId.get(id as ProviderId);

export const isProviderId = (id: unknown): id is ProviderId => typeof id === "string" && byId.has(id as ProviderId);

/** "Google Calendar" for a stored source id; null for unknown ids. */
export const sourceName = (id: string | null | undefined) => (id ? (byId.get(id as ProviderId)?.name ?? null) : null);
