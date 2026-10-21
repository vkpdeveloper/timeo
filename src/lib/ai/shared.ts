// Client-safe AI types and labels.

/**
 * The only model Timi runs on (OpenCode Go), for every user and feature.
 * Fixed by the server owner; the users.ai_model column is ignored.
 */
export const DEFAULT_AI_MODEL = "deepseek-v4.1-flash";
export const AI_MODEL_NAME = "DeepSeek V4.1 Flash";
/** Fixed reasoning effort. The model accepts low / high / max; low keeps tool loops fast. */
export const DEFAULT_AI_EFFORT: Effort = "low";

export type Protocol = "chat" | "responses" | "anthropic" | "google";
export type Effort = "auto" | "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type CatalogModel = {
  id: string;
  name: string;
  /** Always "go": included in the OpenCode Go plan */
  tier: "go";
  protocol: Protocol;
  /** Efforts the model accepts. ["auto"] means it has no reasoning control. */
  efforts: Effort[];
  context: number | null;
};

/** What a write tool returns alongside its own result: the rows it saved. */
export type SavedItem = { label: string; icon?: string };

/** A background assistant run as the history UI sees it. */
export type AssistantRun = {
  id: string;
  input: string;
  reply: string | null;
  status: "running" | "done" | "error";
  error: string | null;
  parts: import("@/db/schema").AiPart[];
  saved: number;
  undone: boolean;
  model: string;
  ms: number | null;
  createdAt: number;
};
