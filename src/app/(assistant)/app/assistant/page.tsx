import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { Assistant } from "@/components/ai/assistant";
import { TodayPanel } from "@/components/ai/today-panel";
import { Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { toClient } from "@/lib/ai/background";
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
  const rows = await db.select().from(t.aiCommands).where(eq(t.aiCommands.userId, user.id)).orderBy(desc(t.aiCommands.createdAt)).limit(40);
  return (
    <Assistant
      timezone={user.timezone}
      initialRuns={rows.reverse().map(toClient)}
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
    <div className="space-y-2 p-2.5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-24" />
      <Skeleton className="h-20" />
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
