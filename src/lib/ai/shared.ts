// Client-safe AI types and labels.

/** Fast, cheap and good at tool use on OpenCode Go. */
export const DEFAULT_AI_MODEL = "claude-haiku-5-5";
export const DEFAULT_AI_EFFORT = "low";

export type Protocol = "chat" | "responses" | "anthropic" | "google";
export type Effort = "auto" | "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type CatalogModel = {
  id: string;
  name: string;
  /** "go" = included in the OpenCode Go plan; "zen" = pay-as-you-go credits */
  tier: "go" | "zen";
  protocol: Protocol;
  free: boolean;
  toolCall: boolean;
  /** Efforts the model accepts. ["auto"] means it has no reasoning control. */
  efforts: Effort[];
  inputCost: number | null;
  outputCost: number | null;
  context: number | null;
  description: string | null;
};

export type CommandResult = {
  id: string;
  reply: string;
  actions: { table: string; id: string; label: string; icon?: string }[];
  model: string;
  effort: string;
  ms: number;
  error?: string;
};

export type AssistantMetadata = {
  commandId: string;
  model: string;
  ms?: number;
  /** number of rows the command saved (so the client can refresh and offer undo) */
  saved?: number;
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

export const EFFORT_LABEL: Record<Effort, string> = {
  auto: "Auto",
  none: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};
