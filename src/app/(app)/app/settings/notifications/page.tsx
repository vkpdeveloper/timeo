import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { pushConfigured } from "@/lib/push/send";
import { withDefaults } from "@/lib/push/types";
import { NotificationSettings } from "./notification-settings";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <>
      <SubHeader back="/app/settings" backLabel="Settings" title="Notifications" />
      <Suspense
        fallback={
          <div className="space-y-6 pt-4">
            <Skeleton className="h-[132px] rounded-[20px]!" />
            <Skeleton className="h-[360px] rounded-[20px]!" />
          </div>
        }
      >
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const user = await requireUser();
  const [row, devices] = await Promise.all([
    db.select({ p: t.users.notifyPrefs }).from(t.users).where(eq(t.users.id, user.id)).get(),
    db.select({ endpoint: t.pushSubscriptions.endpoint }).from(t.pushSubscriptions).where(eq(t.pushSubscriptions.userId, user.id)),
  ]);
  return (
    <NotificationSettings
      prefs={withDefaults(row?.p)}
      endpoints={devices.map((d) => d.endpoint)}
      configured={pushConfigured()}
    />
  );
}
