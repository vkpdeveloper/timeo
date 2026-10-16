import "server-only";
import { eq, inArray, is, type SQL } from "drizzle-orm";
import { getTableConfig, SQLiteTable, type AnySQLiteTable, type SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Everything a user owns, discovered from the schema so new tables are covered
// automatically: tables with a user_id column, plus child tables (no user_id)
// whose foreign key points at one of those.

type OwnedTable = { name: string; table: AnySQLiteTable; where: (userId: string) => SQL; child: boolean };

const userColumn = (table: AnySQLiteTable): SQLiteColumn | undefined =>
  getTableConfig(table).columns.find((c) => c.name === "user_id");

function discover(): OwnedTable[] {
  const tables = (Object.values(schema) as unknown[]).filter((v): v is AnySQLiteTable => is(v, SQLiteTable));
  const out: OwnedTable[] = [];
  for (const table of tables) {
    const config = getTableConfig(table);
    if (config.name === "users") continue;
    const own = userColumn(table);
    if (own) {
      out.push({ name: config.name, table, where: (userId) => eq(own, userId), child: false });
      continue;
    }
    for (const fk of config.foreignKeys) {
      const ref = fk.reference();
      const parentUser = userColumn(ref.foreignTable);
      if (!parentUser || ref.columns.length !== 1) continue;
      const [column] = ref.columns;
      const [parentColumn] = ref.foreignColumns;
      out.push({
        name: config.name,
        table,
        where: (userId) =>
          inArray(column, db.select({ id: parentColumn }).from(ref.foreignTable).where(eq(parentUser, userId))),
        child: true,
      });
      break;
    }
  }
  return out;
}

let cached: OwnedTable[] | null = null;
export const ownedTables = () => (cached ??= discover());

/** Every row the user owns, keyed by table name. Sessions and the password hash are left out. */
export async function exportUserData(userId: string) {
  const user = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      timezone: schema.users.timezone,
      dayStartMin: schema.users.dayStartMin,
      dayEndMin: schema.users.dayEndMin,
      aiModel: schema.users.aiModel,
      aiEffort: schema.users.aiEffort,
      trainingNotes: schema.users.trainingNotes,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();
  const tables: Record<string, unknown[]> = {};
  for (const o of ownedTables()) {
    if (o.name === "sessions") continue;
    tables[o.name] = await db.select().from(o.table).where(o.where(userId));
  }
  return { app: "Timeo", exportedAt: new Date().toISOString(), user, tables };
}

/** Deletes the user and everything they own, children first, in one batch. */
export async function deleteUserData(userId: string) {
  const owned = ownedTables();
  const ordered = [...owned.filter((o) => o.child), ...owned.filter((o) => !o.child)];
  const queries = [
    ...ordered.map((o) => db.delete(o.table).where(o.where(userId))),
    db.delete(schema.users).where(eq(schema.users.id, userId)),
  ];
  await db.batch(queries as [(typeof queries)[number], ...(typeof queries)[number][]]);
}
