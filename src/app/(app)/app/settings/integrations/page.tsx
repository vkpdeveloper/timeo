import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { appUrl } from "@/lib/email";
import { CATALOG } from "@/lib/integrations/catalog";
import { connectMethod, getProvider } from "@/lib/integrations/registry";
import { IntegrationList, type ListItem } from "./integration-list";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage(props: PageProps<"/app/settings/integrations">) {
  return (
    <>
      <SubHeader back="/app/settings" backLabel="Settings" title="Integrations" />
      <Suspense
        fallback={
          <div className="space-y-6 pt-4">
            <Skeleton className="h-[200px] rounded-[16px]!" />
            <Skeleton className="h-[520px] rounded-[16px]!" />
          </div>
        }
      >
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/app/settings/integrations">["searchParams"] }) {
  const user = await requireUser();
  const [rows, sp] = await Promise.all([
    db
      .select({
        id: t.integrations.id,
        provider: t.integrations.provider,
        account: t.integrations.account,
        status: t.integrations.status,
        error: t.integrations.error,
        syncedAt: t.integrations.syncedAt,
        settings: t.integrations.settings,
      })
      .from(t.integrations)
      .where(eq(t.integrations.userId, user.id)),
    searchParams,
  ]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

  const items: ListItem[] = CATALOG.map((entry) => {
    const p = getProvider(entry.id)!;
    const row = rows.find((r) => r.provider === entry.id);
    return {
      entry,
      method: connectMethod(p),
      token: p.token ? { fields: p.token.fields, help: p.token.help, helpUrl: p.token.helpUrl ?? null } : null,
      fragmentUrl: p.fragment?.(`${appUrl()}/app/settings/integrations`) ?? null,
      defaultScope: p.kind === "tasks" ? (p.scope ?? "dated") : null,
      connection: row
        ? {
            id: row.id,
            account: row.account,
            status: row.status,
            error: row.error,
            syncedAt: row.syncedAt,
            scope: row.settings?.scope ?? null,
            notion: row.settings?.notion?.name ?? null,
          }
        : null,
    };
  });

  return (
    <IntegrationList
      items={items}
      flash={{ connected: one(sp.connected), error: one(sp.error), reason: one(sp.reason), connect: one(sp.connect) }}
    />
  );
}
