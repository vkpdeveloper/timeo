import { eq } from "drizzle-orm";
import { Bell, Download, Info, LogOut, Mail, Palette } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import { Timi } from "@/components/ai/timi";
import { InstallRow } from "@/components/shell/install";
import { PageHeader, Row, RowIcon, Section, Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { getAppearance } from "@/lib/appearance";
import { requireUser } from "@/lib/auth";
import { themeById } from "@/lib/themes";
import pkg from "../../../../../package.json";
import { DayHoursRow, DeleteAccountRow, NameRow, TimezoneRow } from "./settings-rows";

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
        <Skeleton className="size-14 rounded-full!" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      {[2, 2, 2, 3].map((n, i) => (
        <div key={i} className="mt-6">
          <Skeleton className="mb-2 h-5 w-24" />
          <div className="skeleton rounded-[20px]" style={{ height: n * 52 }} />
        </div>
      ))}
    </div>
  );
}

/** A full-width row that isn't a link or a plain button (form submit, download). */
const actionRow = "tap-row flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left";

const MODE_LABEL = { system: "System", light: "Light", dark: "Dark" } as const;

async function SettingsContent() {
  const user = await requireUser();
  const zones = Intl.supportedValuesOf("timeZone");
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";
  const [created, appearance] = await Promise.all([
    db.select({ createdAt: t.users.createdAt }).from(t.users).where(eq(t.users.id, user.id)).get(),
    getAppearance(user.id),
  ]);
  const since = created
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: user.timezone }).format(created.createdAt)
    : null;
  const themeName = themeById(appearance.theme)?.name ?? "Custom theme";

  return (
    <>
      <div className="flex items-center gap-3.5 px-1">
        <span className="display grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft text-[26px] text-accent">
          {initial}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[18px] font-semibold tracking-tight text-ink">{user.name}</div>
          <div className="truncate text-[13.5px] text-ink-3">{since ? `With Timeo since ${since}` : user.email}</div>
        </div>
      </div>

      <Section title="Account" card stagger>
        <NameRow name={user.name} />
        <Row icon={<Mail />} iconColor="slate" title="Email" value={user.email} />
      </Section>

      <Section title="Time" card stagger>
        <TimezoneRow timezone={user.timezone} zones={zones} />
        <DayHoursRow startMin={user.dayStartMin} endMin={user.dayEndMin} />
      </Section>

      <Section title="Preferences" card stagger>
        <Row
          href="/app/settings/appearance"
          icon={<Palette />}
          iconColor="violet"
          title="Appearance"
          value={`${themeName} · ${MODE_LABEL[appearance.mode]}`}
        />
        <Row href="/app/settings/notifications" icon={<Bell />} iconColor="amber" title="Notifications" value="This device" />
        <Row
          icon={
            <RowIcon color="coral">
              <Timi size={26} />
            </RowIcon>
          }
          title="Assistant"
          value="DeepSeek V4.1 Flash"
        />
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
