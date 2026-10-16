// Client-safe AI types and labels.

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
