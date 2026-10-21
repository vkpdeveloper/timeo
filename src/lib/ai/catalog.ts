import "server-only";
import { cacheLife } from "next/cache";

// The one model every AI feature uses. It is fixed by the server owner: user
// settings (users.ai_model / ai_effort) are ignored. Only the model's
// protocol and reasoning options are looked up on models.dev, with a built-in
// fallback, so a models.dev outage never changes which model runs.

import { AI_MODEL_NAME, DEFAULT_AI_MODEL, type CatalogModel, type Effort, type Protocol } from "./shared";

/**
 * OpenCode Go only. Pay-as-you-go Zen models bill credits per token, so the
 * server never talks to the Zen endpoint.
 */
export const GO_BASE = "https://opencode.ai/inference/go";

export type { CatalogModel, Effort, Protocol } from "./shared";

type ModelsDevModel = {
  name?: string;
  reasoning_options?: { type: "effort" | "toggle" | "budget_tokens"; values?: string[] }[];
  tool_call?: boolean;
  limit?: { context?: number };
  provider?: { npm?: string };
};
type ModelsDevProvider = { npm?: string; models: Record<string, ModelsDevModel> };

const EFFORT_ORDER: Effort[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

/** What models.dev listed for deepseek-v4.1-flash on OpenCode Go (Oct 2026). */
const FALLBACK: CatalogModel = {
  id: DEFAULT_AI_MODEL,
  name: AI_MODEL_NAME,
  tier: "go",
  protocol: "chat",
  efforts: ["auto", "low", "high", "max"],
  context: 1_000_000,
};

function protocolFor(npm: string | undefined): Protocol {
  switch (npm) {
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

function effortsFor(m: ModelsDevModel): Effort[] {
  const set = new Set<Effort>();
  for (const o of m.reasoning_options ?? []) {
    if (o.type === "effort") o.values?.forEach((v) => EFFORT_ORDER.includes(v as Effort) && set.add(v as Effort));
    if (o.type === "toggle") set.add("none");
    if (o.type === "budget_tokens") ["low", "medium", "high"].forEach((v) => set.add(v as Effort));
  }
  return ["auto", ...EFFORT_ORDER.filter((e) => set.has(e))];
}

/** The assistant model with its metadata. Cached for a few hours. */
export async function getAssistantModel(): Promise<CatalogModel> {
  "use cache";
  cacheLife("hours");

  try {
    const res = await fetch("https://models.dev/api.json", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return FALLBACK;
    const go = ((await res.json()) as Record<string, ModelsDevProvider>)["opencode-go"];
    const m = go?.models[DEFAULT_AI_MODEL];
    if (!m) return FALLBACK;
    return {
      id: DEFAULT_AI_MODEL,
      name: m.name ?? AI_MODEL_NAME,
      tier: "go",
      protocol: protocolFor(m.provider?.npm ?? go.npm),
      efforts: effortsFor(m),
      context: m.limit?.context ?? FALLBACK.context,
    };
  } catch {
    return FALLBACK;
  }
}
