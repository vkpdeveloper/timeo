import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { GO_BASE, ZEN_BASE, type CatalogModel } from "./catalog";

/**
 * Builds an AI SDK model for an OpenCode model. Each model speaks one protocol
 * (chat completions, responses, Anthropic messages or Gemini), as listed on models.dev.
 * OpenCode asks clients to send their own user agent and a stable session id.
 */
export function languageModel(model: CatalogModel, sessionId: string): LanguageModel {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) throw new Error("OPENCODE_API_KEY is not set");
  const base = model.tier === "go" ? GO_BASE : ZEN_BASE;
  const headers = { "user-agent": "timeo/0.1", "x-opencode-session": sessionId };

  switch (model.protocol) {
    case "responses":
      return createOpenAI({ baseURL: `${base}/openai/v1`, apiKey, headers }).responses(model.id);
    case "anthropic":
      return createAnthropic({ baseURL: `${base}/anthropic/v1`, apiKey, headers })(model.id);
    case "google":
      return createGoogleGenerativeAI({ baseURL: `${base}/google/v1beta`, apiKey, headers })(model.id);
    default:
      return createOpenAICompatible({ name: "opencode", baseURL: `${base}/openai/v1`, apiKey, headers })(model.id);
  }
}
