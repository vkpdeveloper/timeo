import "server-only";
import type { TaskProvider } from "../types";
import { enc, parseDue } from "./util";

// Trello hands out tokens on its own authorize page, which sends people back with the token in
// the URL fragment. TRELLO_API_KEY is the app's key; the app's allowed origins must list APP_URL.

const API = "https://api.trello.com/1";
const key = () => process.env.TRELLO_API_KEY;

type Card = { id: string; name: string; desc?: string; due?: string | null; dueComplete?: boolean; shortUrl?: string };

export const trello: TaskProvider = {
  id: "trello",
  kind: "tasks",
  fragment(returnUrl) {
    if (!key()) return null;
    const url = new URL("https://trello.com/1/authorize");
    for (const [k, v] of Object.entries({
      expiration: "never",
      name: "Timeo",
      scope: "read,write",
      response_type: "token",
      callback_method: "fragment",
      key: key()!,
      return_url: returnUrl,
    }))
      url.searchParams.set(k, v);
    return url.toString();
  },
  headers: (creds) => ({ authorization: `OAuth oauth_consumer_key="${key()}", oauth_token="${creds.accessToken}"` }),

  async account(ctx) {
    const me = await ctx.api<{ username?: string; fullName?: string }>(`${API}/members/me?fields=username,fullName`);
    return { label: me.username ?? me.fullName ?? "Trello" };
  },

  async tasks(ctx) {
    const cards = await ctx.api<Card[]>(`${API}/members/me/cards?filter=open&fields=name,desc,due,dueComplete,shortUrl`);
    const items = cards
      .filter((c) => !c.dueComplete && c.name.trim())
      .map((c) => ({ id: c.id, title: c.name, notes: c.desc || null, ...parseDue(c.due, ctx.timezone), url: c.shortUrl ?? null }));
    return { items, complete: true };
  },

  // "done" in Trello is a card's due date marked complete; cards aren't archived
  async setDone(ctx, externalId, done) {
    await ctx.api(`${API}/cards/${enc(externalId)}?dueComplete=${done}`, { method: "PUT" });
  },
};
