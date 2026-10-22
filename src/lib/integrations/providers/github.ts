import "server-only";
import { ApiError, type ExternalTask, type TaskProvider } from "../types";
import { READ_LIMIT, parseDue } from "./util";

const API = "https://api.github.com";

type Issue = {
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  pull_request?: unknown;
  repository?: { full_name: string };
  milestone?: { due_on?: string | null } | null;
};

/** "owner/repo#12", so a check-off knows where to go */
const issueId = (repo: string, n: number) => `${repo}#${n}`;

export const github: TaskProvider = {
  id: "github",
  kind: "tasks",
  scope: "all",
  oauth: {
    env: "GITHUB",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["repo"],
  },
  token: {
    fields: [{ name: "token", label: "Personal access token", placeholder: "github_pat_…", type: "password" }],
    help: "Create a token on GitHub under Settings, then Developer settings, with read and write access to issues.",
    helpUrl: "https://github.com/settings/personal-access-tokens/new",
    creds: (v) => (v.token?.trim() ? { accessToken: v.token.trim() } : "Paste a GitHub token"),
  },
  headers: (creds) => ({
    authorization: `Bearer ${creds.accessToken}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  }),

  async account(ctx) {
    const me = await ctx.api<{ login: string }>(`${API}/user`);
    return { label: me.login };
  },

  async tasks(ctx) {
    const items: ExternalTask[] = [];
    for (let page = 1; ; page++) {
      const list = await ctx.api<Issue[]>(`${API}/issues?filter=assigned&state=open&per_page=100&page=${page}`);
      for (const x of list) {
        // pull requests come back as issues too
        if (x.pull_request || !x.repository) continue;
        items.push({
          id: issueId(x.repository.full_name, x.number),
          title: x.title,
          notes: x.body ?? null,
          due: parseDue(x.milestone?.due_on, ctx.timezone).due,
          url: x.html_url,
        });
      }
      if (list.length < 100) return { items, complete: true };
      if (items.length >= READ_LIMIT || page >= 30) return { items, complete: false };
    }
  },

  async setDone(ctx, externalId, done) {
    const m = /^([\w.-]+\/[\w.-]+)#(\d+)$/.exec(externalId);
    if (!m) throw new ApiError(404, "Not a GitHub issue id");
    const [, repo, n] = m;
    await ctx.api(`${API}/repos/${repo}/issues/${n}`, {
      method: "PATCH",
      json: done ? { state: "closed", state_reason: "completed" } : { state: "open", state_reason: "reopened" },
    });
  },
};
