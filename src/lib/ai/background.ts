import "server-only";
import { generateText, isStepCount, type ModelMessage, type StepResult, type ToolSet } from "ai";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, t } from "@/db";
import type { AiAction, AiPart } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { sendToUser } from "@/lib/push/send";
import { findModel, type Effort } from "./catalog";
import { languageModel } from "./provider";
import { buildAllTools, buildInstructions } from "./run";
import { DEFAULT_AI_MODEL, type AssistantRun } from "./shared";

/*
 * Background assistant runs. A run is created as an ai_commands row with
 * status "running", executed after the HTTP response (next/server `after`),
 * and its steps are written to `parts` as they finish so any open screen can
 * show progress. When it ends, a push goes out unless an open app is watching.
 */

/** A run counts as "watched" if an open app polled it within this window. */
const WATCHED_MS = 12_000;

/** Last few finished commands as plain-text history, for follow-ups like "move that to 9". */
async function history(userId: string, excludeId: string): Promise<ModelMessage[]> {
  const rows = await db
    .select({ input: t.aiCommands.input, reply: t.aiCommands.reply, actions: t.aiCommands.actions })
    .from(t.aiCommands)
    .where(and(eq(t.aiCommands.userId, userId), eq(t.aiCommands.status, "done"), ne(t.aiCommands.id, excludeId)))
    .orderBy(desc(t.aiCommands.createdAt))
    .limit(3);
  return rows.reverse().flatMap((r) => {
    const saved = r.actions.filter((a) => a.label).map((a) => a.label);
    const reply = [r.reply, saved.length ? `(Saved: ${saved.join("; ")})` : ""].filter(Boolean).join("\n");
    return [
      { role: "user" as const, content: r.input },
      ...(reply ? [{ role: "assistant" as const, content: reply }] : []),
    ];
  });
}

function stepParts(step: StepResult<ToolSet>): AiPart[] {
  const parts: AiPart[] = [];
  for (const c of step.content) {
    if (c.type === "reasoning" && c.text.trim()) parts.push({ type: "reasoning", text: c.text });
    else if (c.type === "text" && c.text.trim()) parts.push({ type: "text", text: c.text });
    else if (c.type === "tool-result") parts.push({ type: "tool", name: c.toolName, state: "done", input: c.input, output: c.output });
    else if (c.type === "tool-error")
      parts.push({ type: "tool", name: c.toolName, state: "error", input: c.input, error: String((c.error as Error)?.message ?? c.error).slice(0, 300) });
  }
  return parts;
}

export async function createRun(userId: string, input: string) {
  const settings = await db.select({ aiModel: t.users.aiModel, aiEffort: t.users.aiEffort }).from(t.users).where(eq(t.users.id, userId)).get();
  const id = crypto.randomUUID();
  await db.insert(t.aiCommands).values({
    id,
    userId,
    input,
    model: settings?.aiModel ?? DEFAULT_AI_MODEL,
    effort: settings?.aiEffort ?? "low",
    status: "running",
    seenAt: Date.now(),
  });
  return id;
}

export async function executeRun(user: CurrentUser, runId: string) {
  const run = await db.select().from(t.aiCommands).where(and(eq(t.aiCommands.id, runId), eq(t.aiCommands.userId, user.id))).get();
  if (!run || run.status !== "running") return;

  const settings = await db.select({ trainingNotes: t.users.trainingNotes }).from(t.users).where(eq(t.users.id, user.id)).get();
  const [model, instructions, past] = await Promise.all([
    findModel(run.model),
    buildInstructions(user, settings?.trainingNotes ?? null),
    history(user.id, runId),
  ]);
  const effort = run.effort as Effort;
  const actions: AiAction[] = [];
  const parts: AiPart[] = [];
  const started = Date.now();

  let reply = "";
  let error: string | null = null;
  try {
    const result = await generateText({
      model: languageModel(model, `${user.id}-assistant`),
      instructions,
      messages: [...past, { role: "user", content: run.input }],
      tools: buildAllTools(user, actions),
      stopWhen: isStepCount(12),
      maxOutputTokens: 16_000,
      timeout: { totalMs: 240_000 },
      ...(model.efforts.length > 1 && effort !== "auto" && model.efforts.includes(effort) ? { reasoning: effort } : {}),
      onStepFinish: async (step) => {
        parts.push(...stepParts(step));
        await db.update(t.aiCommands).set({ parts, actions }).where(eq(t.aiCommands.id, runId));
      },
    });
    reply = result.text.trim();
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 300) : "The model call failed";
  }

  await db
    .update(t.aiCommands)
    .set({ status: error ? "error" : "done", reply: reply || null, error, parts, actions, durationMs: Date.now() - started })
    .where(eq(t.aiCommands.id, runId));

  // Push only when nobody is looking at it in an open app.
  const fresh = await db.select({ seenAt: t.aiCommands.seenAt }).from(t.aiCommands).where(eq(t.aiCommands.id, runId)).get();
  if (Date.now() - (fresh?.seenAt ?? 0) > WATCHED_MS) {
    const saved = actions.filter((a) => a.label);
    await sendToUser(user.id, {
      title: error ? "Timi couldn't finish" : saved.length ? `Done · ${saved.length} saved` : "Timi",
      body: error ? run.input.slice(0, 120) : reply || saved.map((a) => a.label).slice(0, 3).join(" · ") || "Done.",
      url: `/assistant#${runId}`,
      tag: `assistant-${runId}`,
    }).catch(() => 0);
  }
}

/** Shape the history UI reads. */
export function toClient(r: typeof t.aiCommands.$inferSelect): AssistantRun {
  return {
    id: r.id,
    input: r.input,
    reply: r.reply,
    status: r.status,
    error: r.error,
    parts: r.parts,
    saved: r.actions.filter((a) => a.label).length,
    undone: !!r.undoneAt,
    model: r.model,
    ms: r.durationMs,
    createdAt: r.createdAt,
  };
}
