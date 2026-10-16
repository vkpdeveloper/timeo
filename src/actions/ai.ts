"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { undoCommand } from "@/lib/ai/run";
import { findModel, type Effort } from "@/lib/ai/catalog";
import { requireUser } from "@/lib/auth";

export async function undoTell(commandId: string) {
  const user = await requireUser();
  await undoCommand(user.id, commandId);
  refresh();
}

export async function saveAiSettings(modelId: string, effort: Effort) {
  const user = await requireUser();
  const model = await findModel(modelId);
  const safeEffort = model.efforts.includes(effort) ? effort : "auto";
  await db.update(t.users).set({ aiModel: model.id, aiEffort: safeEffort }).where(eq(t.users.id, user.id));
  refresh();
}
