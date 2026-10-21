import { eq } from "drizzle-orm";
import { Bell, Download, Info, LogOut, Mail } from "lucide-react";
import { Timi } from "@/components/ai/timi";
import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import { InstallRow } from "@/components/shell/install";
import { PageHeader, Row, RowIcon, Section, Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { getColorMode } from "@/lib/appearance";
import { requireUser } from "@/lib/auth";
import pkg from "../../../../../package.json";
import { AppearanceRow, DayHoursRow, DeleteAccountRow, NameRow, TimezoneRow } from "./settings-rows";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

function SettingsSkeleton() {
  return (
    <div>
      <div className="flex items-center gap-3.5 px-1">
        <Skeleton className="size-12 rounded-full!" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      {[2, 2, 2, 3].map((n, i) => (
        <div key={i} className="mt-6">
          <Skeleton className="mb-2 h-5 w-24" />
          <div className="skeleton rounded-[16px]" style={{ height: n * 52 }} />
        </div>
      ))}
    </div>
  );
}

/** A full-width row that isn't a link or a plain button (form submit, download). */
const actionRow = "tap-row flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left";

async function SettingsContent() {
  const user = await requireUser();
  const zones = Intl.supportedValuesOf("timeZone");
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";
  const [created, savedMode] = await Promise.all([
    db.select({ createdAt: t.users.createdAt }).from(t.users).where(eq(t.users.id, user.id)).get(),
    getColorMode(user.id),
  ]);
  const since = created
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: user.timezone }).format(created.createdAt)
    : null;

  return (
    <>
      <div className="flex items-center gap-3.5 px-1">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft text-[20px] font-semibold text-accent">
          {initial}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold tracking-tight text-ink">{user.name}</div>
          <div className="truncate text-[13.5px] text-ink-3">{since ? `With Timeo since ${since}` : user.email}</div>
        </div>
      </div>

      <Section title="Account" card stagger>
        <NameRow name={user.name} />
        <Row icon={<Mail />} title="Email" value={user.email} />
      </Section>

      <Section title="Time" card stagger>
        <TimezoneRow timezone={user.timezone} zones={zones} />
        <DayHoursRow startMin={user.dayStartMin} endMin={user.dayEndMin} />
      </Section>

      <Section title="Preferences" card stagger>
        <AppearanceRow saved={savedMode} />
        <Row href="/app/settings/notifications" icon={<Bell />} title="Notifications" value="This device" />
        <Row icon={<Timi size={24} />} title="Assistant" value="DeepSeek V4.1 Flash" />
      </Section>

      <Section title="Data" card stagger>
        <a href="/api/export" download className={actionRow}>
          <RowIcon>
            <Download />
          </RowIcon>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">Export my data</span>
            <span className="block truncate text-[13px] text-ink-3">Everything, as one JSON file</span>
          </span>
        </a>
        <form action={logout}>
          <button type="submit" className={actionRow}>
            <RowIcon>
              <LogOut />
            </RowIcon>
            <span className="flex-1 text-[15px] font-medium text-ink">Sign out</span>
          </button>
        </form>
      </Section>

      <Section title="App" card stagger>
        <InstallRow />
        <Row icon={<Info />} title="Version" value={pkg.version} />
      </Section>

      <Section card>
        <DeleteAccountRow />
      </Section>
    </>
  );
}
