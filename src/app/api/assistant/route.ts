import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { AiAction } from "@/db/schema";
import { findModel, type Effort } from "@/lib/ai/catalog";
import { languageModel } from "@/lib/ai/provider";
import { buildAllTools, buildInstructions } from "@/lib/ai/run";
import type { AssistantMetadata } from "@/lib/ai/shared";
import { getUser } from "@/lib/auth";
import { DEFAULT_AI_MODEL } from "@/lib/ai/shared";

// High reasoning effort or a full week plan can take a while.
export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { messages, id: chatId } = (await req.json()) as { messages: UIMessage[]; id?: string };
  // Short context keeps it fast; enough for "move that to 9" follow-ups.
  const recent = compactHistory(messages.slice(-6));
  const input = recent.findLast((m) => m.role === "user")?.parts.find((p) => p.type === "text")?.text ?? "";

  const settings = await db
    .select({ aiModel: t.users.aiModel, aiEffort: t.users.aiEffort, trainingNotes: t.users.trainingNotes })
    .from(t.users)
    .where(eq(t.users.id, user.id))
    .get();
  const [model, instructions] = await Promise.all([
    findModel(settings?.aiModel ?? DEFAULT_AI_MODEL),
    buildInstructions(user, settings?.trainingNotes ?? null),
  ]);
  const effort = (settings?.aiEffort ?? "low") as Effort;

  const commandId = crypto.randomUUID();
  const actions: AiAction[] = [];
  const started = Date.now();

  const result = streamText({
    model: languageModel(model, chatId ?? commandId),
    instructions,
    messages: await convertToModelMessages(recent),
    tools: buildAllTools(user, actions),
    stopWhen: isStepCount(12),
    maxOutputTokens: 16_000,
    ...(model.efforts.length > 1 && effort !== "auto" && model.efforts.includes(effort) ? { reasoning: effort } : {}),
    onEnd: async ({ text }) => {
      await db.insert(t.aiCommands).values({
        id: commandId,
        userId: user.id,
        input: input.slice(0, 2000),
        reply: text || null,
        model: model.id,
        effort,
        actions,
        durationMs: Date.now() - started,
      });
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendReasoning: true,
      messageMetadata: ({ part }) => {
        if (part.type === "start") return { commandId, model: model.name } satisfies AssistantMetadata;
        if (part.type === "finish") return { commandId, model: model.name, ms: Date.now() - started, saved: actions.filter((a) => a.label).length } satisfies AssistantMetadata;
      },
      onError: (e) => (e instanceof Error ? e.message.slice(0, 200) : "Something went wrong"),
    }),
  });
}

/**
 * Earlier turns go back to the model as plain text (reply + what was saved).
 * Raw reasoning/tool parts can't be replayed across models or requests.
 */
function compactHistory(messages: UIMessage[]): UIMessage[] {
  return messages.map((m, i) => {
    if (i === messages.length - 1) return { ...m, parts: m.parts.filter((p) => p.type === "text") };
    const text = m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { text: string }).text)
      .join("\n");
    const saved = m.parts.flatMap((p) => {
      const out = (p as { output?: { saved?: { label: string }[] } }).output;
      return out?.saved?.map((x) => x.label) ?? [];
    });
    const full = [text, saved.length ? `(Saved: ${saved.join("; ")})` : ""].filter(Boolean).join("\n");
    return { id: m.id, role: m.role, parts: full ? [{ type: "text" as const, text: full }] : [] };
  }).filter((m) => m.parts.length);
}
