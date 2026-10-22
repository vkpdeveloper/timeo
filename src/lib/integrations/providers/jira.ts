import "server-only";
import type { ExternalTask, TaskProvider } from "../types";
import { ApiError } from "../types";
import { READ_LIMIT, enc } from "./util";

// Jira Cloud with an API token. The site is the "yourteam" in yourteam.atlassian.net.

const base = (site: unknown) => `https://${site}.atlassian.net/rest/api/3`;

/** "yourteam", "yourteam.atlassian.net" or a link into it → "yourteam" */
function siteOf(input: string) {
  const s = input.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/\.atlassian\.net$/, "");
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(s) ? s : null;
}

type Issue = { id: string; key: string; fields: { summary?: string; duedate?: string | null } };
type Transition = { id: string; to: { statusCategory?: { key?: string } } };

export const jira: TaskProvider = {
  id: "jira",
  kind: "tasks",
  scope: "all",
  token: {
    fields: [
      { name: "site", label: "Site", placeholder: "yourteam.atlassian.net", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "token", label: "API token", type: "password" },
    ],
    help: "Create an API token in your Atlassian account under Security, then API tokens.",
    helpUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
    creds(v) {
      const site = siteOf(v.site ?? "");
      if (!site) return "Enter your site, like yourteam.atlassian.net";
      if (!/^\S+@\S+$/.test(v.email?.trim() ?? "")) return "Enter the email you sign in to Jira with";
      if (!v.token?.trim()) return "Paste your API token";
      return { accessToken: v.token.trim(), email: v.email.trim(), site };
    },
  },
  headers: (creds) => ({ authorization: `Basic ${Buffer.from(`${creds.email}:${creds.accessToken}`).toString("base64")}` }),

  async account(ctx) {
    const me = await ctx.api<{ emailAddress?: string; displayName?: string }>(`${base(ctx.creds.site)}/myself`);
    return { label: `${ctx.creds.site}.atlassian.net` + (me.displayName ? ` · ${me.displayName}` : "") };
  },

  async tasks(ctx) {
    const items: ExternalTask[] = [];
    let next: string | undefined;
    do {
      const params = new URLSearchParams({
        jql: "assignee = currentUser() AND statusCategory != Done ORDER BY duedate ASC",
        fields: "summary,duedate",
        maxResults: "100",
      });
      if (next) params.set("nextPageToken", next);
      const page = await ctx.api<{ issues: Issue[]; nextPageToken?: string; isLast?: boolean }>(`${base(ctx.creds.site)}/search/jql?${params}`);
      for (const x of page.issues) {
        items.push({
          id: x.id,
          title: x.fields.summary ? `${x.key} ${x.fields.summary}` : x.key,
          due: x.fields.duedate ?? null,
          url: `https://${ctx.creds.site}.atlassian.net/browse/${x.key}`,
        });
      }
      next = page.isLast === false ? page.nextPageToken : undefined;
      if (items.length >= READ_LIMIT) return { items, complete: !next };
    } while (next);
    return { items, complete: true };
  },

  async setDone(ctx, externalId, done) {
    const url = `${base(ctx.creds.site)}/issue/${enc(externalId)}/transitions`;
    const { transitions } = await ctx.api<{ transitions: Transition[] }>(url);
    const category = (t: Transition) => t.to.statusCategory?.key;
    const target = done
      ? transitions.find((t) => category(t) === "done")
      : (transitions.find((t) => category(t) === "new") ?? transitions.find((t) => category(t) === "indeterminate"));
    if (!target) throw new ApiError(409, "No Jira transition to that status");
    await ctx.api(url, { method: "POST", json: { transition: { id: target.id } } });
  },
};
