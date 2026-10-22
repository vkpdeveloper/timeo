import "server-only";
import type { Ctx, ExternalTask, TaskProvider } from "../types";
import { ApiError, ReconnectError } from "../types";
import { READ_LIMIT } from "./util";

const API = "https://api.linear.app/graphql";

async function gql<T>(ctx: Ctx, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await ctx.api<{ data?: T; errors?: { message: string; extensions?: { code?: string } }[] }>(API, {
    method: "POST",
    json: { query, variables },
  });
  const error = res.errors?.[0];
  if (error) {
    if (error.extensions?.code === "AUTHENTICATION_ERROR") throw new ReconnectError(error.message);
    throw new ApiError(/not found/i.test(error.message) ? 404 : 400, `Linear: ${error.message}`);
  }
  return res.data as T;
}

type Issue = { id: string; title: string; description?: string | null; dueDate?: string | null; url: string };
type Page = { nodes: Issue[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };

export const linear: TaskProvider = {
  id: "linear",
  kind: "tasks",
  scope: "all",
  oauth: {
    env: "LINEAR",
    authorizeUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    scopes: ["read", "write"],
    scopeSeparator: ",",
    params: { prompt: "consent" },
  },
  token: {
    fields: [{ name: "key", label: "API key", placeholder: "lin_api_…", type: "password" }],
    help: "In Linear, open Settings, then Security & access, and create a personal API key.",
    helpUrl: "https://linear.app/settings/account/security",
    creds: (v) => (v.key?.trim() ? { accessToken: v.key.trim(), apiKey: true } : "Paste your Linear API key"),
  },
  // personal API keys go bare; OAuth tokens as Bearer
  headers: (creds) => ({ authorization: creds.apiKey ? creds.accessToken : `Bearer ${creds.accessToken}` }),

  async account(ctx) {
    const { viewer } = await gql<{ viewer: { name?: string; email?: string } }>(ctx, "{ viewer { name email } }");
    return { label: viewer.email ?? viewer.name ?? "Linear" };
  },

  async tasks(ctx) {
    const items: ExternalTask[] = [];
    let after: string | null = null;
    do {
      const { viewer }: { viewer: { assignedIssues: Page } } = await gql(
        ctx,
        `query($after: String) {
          viewer {
            assignedIssues(first: 100, after: $after, filter: { state: { type: { in: ["unstarted", "started"] } } }) {
              nodes { id title description dueDate url }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`,
        { after },
      );
      const page: Page = viewer.assignedIssues;
      for (const x of page.nodes) {
        items.push({ id: x.id, title: x.title, notes: x.description ?? null, due: x.dueDate ?? null, url: x.url });
      }
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
      if (items.length >= READ_LIMIT) return { items, complete: !after };
    } while (after);
    return { items, complete: true };
  },

  async setDone(ctx, externalId, done) {
    const { issue } = await gql<{ issue: { team: { states: { nodes: { id: string; type: string; position: number }[] } } } | null }>(
      ctx,
      `query($id: String!) { issue(id: $id) { team { states { nodes { id type position } } } } }`,
      { id: externalId },
    );
    if (!issue) throw new ApiError(404, "Linear issue not found");
    const states = [...issue.team.states.nodes].sort((a, b) => a.position - b.position);
    const target = done
      ? states.find((s) => s.type === "completed")
      : (states.find((s) => s.type === "unstarted") ?? states.find((s) => s.type === "started"));
    if (!target) throw new ApiError(409, "Linear team has no state to move it to");
    const res = await gql<{ issueUpdate: { success: boolean } }>(
      ctx,
      `mutation($id: String!, $stateId: String!) { issueUpdate(id: $id, input: { stateId: $stateId }) { success } }`,
      { id: externalId, stateId: target.id },
    );
    if (!res.issueUpdate.success) throw new ApiError(400, "Linear didn't update the issue");
  },
};
