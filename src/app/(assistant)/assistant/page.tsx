import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { Assistant } from "@/components/ai/assistant";
import { Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { findModel } from "@/lib/ai/catalog";
import { requireUser } from "@/lib/auth";
import { DEFAULT_AI_MODEL } from "@/lib/ai/shared";

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
  const settings = await db.select({ aiModel: t.users.aiModel }).from(t.users).where(eq(t.users.id, user.id)).get();
  const model = await findModel(settings?.aiModel ?? DEFAULT_AI_MODEL);
  return <Assistant modelName={model.name} />;
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
