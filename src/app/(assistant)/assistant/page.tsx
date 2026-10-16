import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { Assistant } from "@/components/ai/assistant";
import { Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { toClient } from "@/lib/ai/background";
import { findModel } from "@/lib/ai/catalog";
import { DEFAULT_AI_MODEL } from "@/lib/ai/shared";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Ask Timeo" };

export default function AssistantPage() {
  return (
    <Suspense fallback={<AssistantSkeleton />}>
      <AssistantContent />
    </Suspense>
  );
}

async function AssistantContent() {
  const user = await requireUser();
  const [settings, rows] = await Promise.all([
    db.select({ aiModel: t.users.aiModel }).from(t.users).where(eq(t.users.id, user.id)).get(),
    db.select().from(t.aiCommands).where(eq(t.aiCommands.userId, user.id)).orderBy(desc(t.aiCommands.createdAt)).limit(40),
  ]);
  const model = await findModel(settings?.aiModel ?? DEFAULT_AI_MODEL);
  return <Assistant modelName={model.name} timezone={user.timezone} initialRuns={rows.reverse().map(toClient)} />;
}

function AssistantSkeleton() {
  return (
    <div className="flex h-dvh flex-col px-4">
      <div className="h-14" />
      <div className="mx-auto mt-auto w-full max-w-[720px] pb-6">
        <Skeleton className="h-28 rounded-[24px]" />
      </div>
    </div>
  );
}
