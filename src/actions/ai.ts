"use server";

import { refresh } from "next/cache";
import { undoCommand } from "@/lib/ai/run";
import { requireUser } from "@/lib/auth";

export async function undoTell(commandId: string) {
  const user = await requireUser();
  await undoCommand(user.id, commandId);
  refresh();
}
