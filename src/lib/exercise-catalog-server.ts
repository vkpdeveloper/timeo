import "server-only";
import data from "./exercise-catalog.json";
import type { CatalogEntry } from "./exercise-catalog";
import { EXERCISE_LIBRARY } from "./fitness-library";

export const CATALOG = data as CatalogEntry[];
const byId = new Map(CATALOG.map((e) => [e.id, e]));
const key = (s: string) => s.trim().toLowerCase();
const byName = new Map<string, string>([
  ...CATALOG.map((e) => [key(e.name), e.id] as const),
  ...EXERCISE_LIBRARY.filter((e) => e.catalog).map((e) => [key(e.name), e.catalog!] as const),
]);

export const catalogEntry = (id: string | null | undefined) => (id ? byId.get(id) : undefined);

/** The catalogue entry an exercise name means, when the name says so exactly. */
export const catalogIdFor = (name: string) => byName.get(key(name)) ?? null;
