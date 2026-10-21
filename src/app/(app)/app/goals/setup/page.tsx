import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { getActiveSeason } from "@/lib/queries";
import { SeasonWizard } from "./wizard";

export default function SetupPage() {
  return (
    <Suspense fallback={<SetupSkeleton />}>
      <SetupContent />
    </Suspense>
  );
}

function SetupSkeleton() {
  return (
    <div className="pt-24">
      <Skeleton className="h-10 w-60" />
      <Skeleton className="mt-3 h-5 w-72" />
      <Skeleton className="mt-10 h-14" />
      <Skeleton className="mt-4 h-24" />
    </div>
  );
}

async function SetupContent() {
  const user = await requireUser();
  const active = await getActiveSeason(user.id);
  return <SeasonWizard today={user.today} currentSeason={active?.name ?? null} />;
}
