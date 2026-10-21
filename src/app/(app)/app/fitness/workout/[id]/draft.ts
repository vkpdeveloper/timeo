import type { Block } from "./logger";

// Edits are mirrored to localStorage until the server has them, so a refresh, a
// closed tab or a dropped connection mid-workout never loses a set.
export type Draft = { blocks: Block[]; dirty: string[]; structure: boolean };
export const draftKey = (logId: string) => `timeo:workout:${logId}`;

export function readDraft(logId: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(logId)) || "null");
    return d && Array.isArray(d.blocks) && Array.isArray(d.dirty) ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft(logId: string) {
  try {
    localStorage.removeItem(draftKey(logId));
  } catch {}
}
