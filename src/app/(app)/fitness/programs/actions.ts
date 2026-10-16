"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { reqStr, str } from "@/lib/form";
import { applyProgram, snapshotProgram } from "@/lib/gym-program";
import { getPreset } from "@/lib/gym-presets";

async function ownProgram(userId: string, id: string) {
  const row = await db
    .select()
    .from(t.gymPrograms)
    .where(and(eq(t.gymPrograms.id, id), eq(t.gymPrograms.userId, userId)))
    .get();
  if (!row) throw new Error("Program not found");
  return row;
}

/** Loads a preset or a saved program as the current split. Logs are kept. */
export async function loadProgram(kind: "preset" | "saved", id: string) {
  const user = await requireUser();
  const data = kind === "preset" ? getPreset(id) : (await ownProgram(user.id, id)).data;
  if (!data) throw new Error("Program not found");
  await applyProgram(user.id, data);
  refresh();
}

export async function saveCurrentProgram(fd: FormData) {
  const user = await requireUser();
  const data = await snapshotProgram(user.id);
  if (!data.routines.length) throw new Error("You have no routines to save yet");
  await db.insert(t.gymPrograms).values({
    userId: user.id,
    name: reqStr(fd, "name", 60),
    description: str(fd, "description")?.slice(0, 300) ?? null,
    data,
  });
  refresh();
}

export async function renameProgram(fd: FormData) {
  const user = await requireUser();
  const p = await ownProgram(user.id, reqStr(fd, "id"));
  await db
    .update(t.gymPrograms)
    .set({ name: reqStr(fd, "name", 60), description: str(fd, "description")?.slice(0, 300) ?? null })
    .where(eq(t.gymPrograms.id, p.id));
  refresh();
}

export async function deleteProgram(id: string) {
  const user = await requireUser();
  const p = await ownProgram(user.id, id);
  await db.delete(t.gymPrograms).where(eq(t.gymPrograms.id, p.id));
  refresh();
}
