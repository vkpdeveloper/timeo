import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { CommandBar } from "@/components/ai/command-bar";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { getModelCatalog } from "@/lib/ai/catalog";
import { requireUser } from "@/lib/auth";
import { ModelPicker } from "./model-picker";
import { DEFAULT_AI_MODEL } from "@/lib/ai/shared";

export const metadata: Metadata = { title: "Timi" };

export default function AiSettingsPage() {
  return (
    <>
      <SubHeader back="/settings" backLabel="Settings" title="AI" />
      <div className="pt-5">
        <h1 className="display text-[34px] text-ink">Timi</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
          Log, plan and ask in plain words. It knows your seasons, goals, calendar and training.
        </p>
        <Suspense fallback={<PickerSkeleton />}>
          <Picker />
        </Suspense>
      </div>
    </>
  );
}

async function Picker() {
  const user = await requireUser();
  const [settings, models] = await Promise.all([
    db.select({ aiModel: t.users.aiModel, aiEffort: t.users.aiEffort }).from(t.users).where(eq(t.users.id, user.id)).get(),
    getModelCatalog(),
  ]);
  return (
    <>
      <div className="mt-6">
        <CommandBar />
      </div>
      <ModelPicker
        models={models}
        initialModel={settings?.aiModel ?? DEFAULT_AI_MODEL}
        initialEffort={settings?.aiEffort ?? "low"}
        hasKey={!!process.env.OPENCODE_API_KEY}
      />
    </>
  );
}

function PickerSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      <Skeleton className="h-14" />
      <Skeleton className="h-24" />
      <Skeleton className="h-80" />
    </div>
  );
}
