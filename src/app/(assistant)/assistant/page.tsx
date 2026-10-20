import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { Assistant } from "@/components/ai/assistant";
import { TodayPanel } from "@/components/ai/today-panel";
import { Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { toClient } from "@/lib/ai/background";
import { getModelCatalog } from "@/lib/ai/catalog";
import { DEFAULT_AI_MODEL, type Effort } from "@/lib/ai/shared";
import { requireUser } from "@/lib/auth";
import { nowMinIn } from "@/lib/dates";
import { getDayBlocks, getGoalOptions, getTodayTasks } from "@/lib/queries";

export const metadata: Metadata = { title: "Timi" };

export default function AssistantPage() {
  return (
    <Suspense fallback={<AssistantSkeleton />}>
      <AssistantContent />
    </Suspense>
  );
}

async function AssistantContent() {
  const user = await requireUser();
  const [settings, rows, catalog] = await Promise.all([
    db.select({ aiModel: t.users.aiModel, aiEffort: t.users.aiEffort }).from(t.users).where(eq(t.users.id, user.id)).get(),
    db.select().from(t.aiCommands).where(eq(t.aiCommands.userId, user.id)).orderBy(desc(t.aiCommands.createdAt)).limit(40),
    getModelCatalog(),
  ]);
  const modelId = settings?.aiModel ?? DEFAULT_AI_MODEL;
  // the composer offers Go models (plus the current one if it isn't in Go)
  const models = catalog
    .filter((m) => m.tier === "go" || m.id === modelId)
    .map(({ id, name, efforts, free }) => ({ id, name, efforts, free }));
  return (
    <Assistant
      timezone={user.timezone}
      initialRuns={rows.reverse().map(toClient)}
      models={models}
      modelId={modelId}
      effort={(settings?.aiEffort ?? "low") as Effort}
      today={
        <Suspense fallback={<TodaySkeleton />}>
          <Today />
        </Suspense>
      }
    />
  );
}

/** Today's plan and tasks, streamed beside the chat. */
async function Today() {
  const user = await requireUser();
  const [blocks, tasks, goals] = await Promise.all([
    getDayBlocks(user.id, user.today),
    getTodayTasks(user.id, user.today),
    getGoalOptions(user.id),
  ]);
  return <TodayPanel today={user.today} nowMin={nowMinIn(user.timezone)} blocks={blocks} tasks={tasks} goals={goals} />;
}

function TodaySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-11 w-48" />
      <Skeleton className="h-40" />
      <Skeleton className="h-32" />
    </div>
  );
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
