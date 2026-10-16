import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { PageHeader, Skeleton } from "@/components/ui/primitives";

export default function TodayPage() {
  return (
    <Suspense fallback={<Skeleton className="mt-10 h-40" />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const user = await requireUser();
  return <PageHeader eyebrow={user.today} title={`Hi ${user.name}`} />;
}
