import "server-only";
import { cacheLife } from "next/cache";

// Model catalog for the AI command bar.
// Source of truth for what the key can use: OpenCode Go's /v1/models.
// Metadata (protocol, reasoning options, price, context) comes from models.dev.

import { DEFAULT_AI_MODEL, type CatalogModel, type Effort, type Protocol } from "./shared";

export const GO_BASE = "https://opencode.ai/inference/go";
export const ZEN_BASE = "https://opencode.ai/inference";

export type { CatalogModel, Effort, Protocol } from "./shared";

type ModelsDevModel = {
  id: string;
  name: string;
  description?: string;
  reasoning?: boolean;
  reasoning_options?: { type: "effort" | "toggle" | "budget_tokens"; values?: string[] }[];
  tool_call?: boolean;
  limit?: { context?: number };
  cost?: { input?: number; output?: number };
  provider?: { npm?: string; api?: string };
  status?: string;
};
type ModelsDevProvider = { npm?: string; api?: string; models: Record<string, ModelsDevModel> };

const EFFORT_ORDER: Effort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

function protocolFor(npm: string | undefined, providerNpm: string | undefined): Protocol {
  switch (npm ?? providerNpm) {
    case "@ai-sdk/openai":
      return "responses";
    case "@ai-sdk/anthropic":
      return "anthropic";
    case "@ai-sdk/google":
      return "google";
    default:
      return "chat";
  }
}

function effortsFor(m: ModelsDevModel | undefined): Effort[] {
  const opts = m?.reasoning_options ?? [];
  const set = new Set<Effort>(["auto"]);
  for (const o of opts) {
    if (o.type === "effort") o.values?.forEach((v) => EFFORT_ORDER.includes(v as Effort) && set.add(v as Effort));
    if (o.type === "toggle") set.add("none");
    if (o.type === "budget_tokens") ["low", "medium", "high"].forEach((v) => set.add(v as Effort));
  }
  // toggle-only models: "auto" = thinking on, "none" = off
  return ["auto", ...EFFORT_ORDER.filter((e) => set.has(e))];
}

function toCatalog(id: string, m: ModelsDevModel | undefined, tier: "go" | "zen", providerNpm?: string): CatalogModel {
  return {
    id,
    name: m?.name ?? id,
    tier,
    protocol: protocolFor(m?.provider?.npm, providerNpm),
    free: m?.cost?.input === 0 && m?.cost?.output === 0,
    toolCall: m?.tool_call ?? true,
    efforts: effortsFor(m),
    inputCost: m?.cost?.input ?? null,
    outputCost: m?.cost?.output ?? null,
    context: m?.limit?.context ?? null,
    description: m?.description ?? null,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Pay-as-you-go Zen models bill OpenCode credits per token, unlike the flat
 * Go plan, so any user picking one spends the server owner's money. They are
 * off unless the server env sets AI_ALLOW_ZEN_MODELS="1" (server only).
 */
const allowZen = () => process.env.AI_ALLOW_ZEN_MODELS === "1";

/** All models the user can pick, Go models first. Cached for a few hours. */
export async function getModelCatalog(): Promise<CatalogModel[]> {
  "use cache";
  cacheLife("hours");

  const [goList, dev] = await Promise.all([
    fetchJson<{ data: { id: string }[] }>(`${GO_BASE}/v1/models`, {
      headers: { Authorization: `Bearer ${process.env.OPENCODE_API_KEY ?? ""}`, "user-agent": "timeo/0.1" },
    }),
    fetchJson<Record<string, ModelsDevProvider>>("https://models.dev/api.json"),
  ]);

  const goDev = dev?.["opencode-go"];
  const zenDev = dev?.["opencode"];
  const goIds = goList?.data.map((m) => m.id) ?? Object.keys(goDev?.models ?? {});

  const go = goIds.map((id) => {
    const meta = goDev?.models[id] ?? zenDev?.models[id];
    return toCatalog(id, meta, "go", goDev?.models[id] ? goDev?.npm : zenDev?.npm);
  });

  const goSet = new Set(goIds);
  const zen = Object.values((allowZen() && zenDev?.models) || {})
    .filter((m) => !goSet.has(m.id) && m.status !== "deprecated" && m.tool_call !== false)
    .map((m) => toCatalog(m.id, m, "zen", zenDev?.npm));

  const byName = (a: CatalogModel, b: CatalogModel) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name);
  return [...go.sort(byName), ...zen.sort(byName)];
}

export async function findModel(id: string): Promise<CatalogModel> {
  const all = await getModelCatalog();
  const found = all.find((m) => m.id === id);
  if (found) return found;
  // Unknown ids must not reach the provider: the id comes from user
  // settings, and honoring arbitrary strings bypasses the catalog (and
  // its pricing). Fall back to the default model instead. When the
  // catalog itself failed to load (empty), keep the requested id so a
  // models.dev outage does not silently swap everyone's model.
  const fallback = all.find((m) => m.id === DEFAULT_AI_MODEL) ?? all[0];
  if (fallback) return fallback;
  return (
    {
      id,
      name: id,
      tier: "go",
      protocol: "chat",
      free: false,
      toolCall: true,
      efforts: ["auto"],
      inputCost: null,
      outputCost: null,
      context: null,
      description: null,
    }
  );
}
