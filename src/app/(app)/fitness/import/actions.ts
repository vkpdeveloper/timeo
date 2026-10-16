"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ImportError, importTraining, parseTrainingJson, type ImportReport } from "@/lib/fitness-import";

export type ImportResult = { ok: true; report: ImportReport; applied: boolean } | { ok: false; error: string };

const MAX = 500_000;

/** Parses and, unless `dryRun`, writes a training JSON export. */
export async function runImport(json: string, dryRun: boolean): Promise<ImportResult> {
  const user = await requireUser();
  if (json.length > MAX) return { ok: false, error: "That file is too large to import here." };
  try {
    const parsed = parseTrainingJson(json);
    const report = await importTraining(user.id, parsed, { dryRun });
    if (!dryRun) refresh();
    return { ok: true, report, applied: !dryRun };
  } catch (e) {
    if (e instanceof ImportError) return { ok: false, error: e.message };
    console.error("import failed", e);
    return { ok: false, error: "Import failed. Nothing was changed." };
  }
}
