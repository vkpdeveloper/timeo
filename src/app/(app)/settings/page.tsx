import { eq } from "drizzle-orm";
import { Bell, Download, LogOut, Palette } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import { Card, PageHeader, Row, Section, Skeleton } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import pkg from "../../../../package.json";
import { InstallRow } from "@/components/shell/install";
import { Timi } from "@/components/ai/timi";
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
    <div className="space-y-8">
      <Skeleton className="h-36 rounded-[22px]" />
      <Skeleton className="h-28 rounded-[22px]" />
      <Skeleton className="h-40 rounded-[22px]" />
    </div>
  );
}

function IconTile({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`grid size-8 shrink-0 place-items-center rounded-[9px] [&_svg]:size-[17px] ${className ?? "bg-sunken text-ink-2"}`}>
      {children}
    </span>
  );
}

async function SettingsContent() {
  const user = await requireUser();
  const zones = Intl.supportedValuesOf("timeZone");
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";
  const created = await db.select({ createdAt: t.users.createdAt }).from(t.users).where(eq(t.users.id, user.id)).get();
  const since = created
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: user.timezone }).format(created.createdAt)
    : null;

  return (
    <div className="fade-up">
      <Card>
        <div className="flex items-center gap-4 border-b border-line p-4">
          <span className="display grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft text-[28px] text-accent">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[18px] font-semibold tracking-tight text-ink">{user.name}</div>
            {since && <div className="text-[13.5px] text-ink-3">With Timeo since {since}</div>}
          </div>
        </div>
        <NameRow name={user.name} />
        <Row>
          <span className="flex-1 text-[15px] font-medium text-ink">Email</span>
          <span className="truncate text-[14px] text-ink-3">{user.email}</span>
        </Row>
      </Card>

      <Section title="Time">
        <Card>
          <TimezoneRow timezone={user.timezone} zones={zones} />
          <DayHoursRow startMin={user.dayStartMin} endMin={user.dayEndMin} />
        </Card>
      </Section>

      <Section title="Preferences">
        <Card>
          <Row href="/settings/appearance">
            <IconTile className="bg-[var(--c-violet-soft)] text-[var(--c-violet)]">
              <Palette />
            </IconTile>
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-ink">Appearance</div>
              <div className="text-[13px] text-ink-3">Theme and light or dark</div>
            </div>
          </Row>
          <Row href="/settings/notifications">
            <IconTile className="bg-[var(--c-amber-soft)] text-[var(--c-amber)]">
              <Bell />
            </IconTile>
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-ink">Notifications</div>
              <div className="text-[13px] text-ink-3">Reminders on this device</div>
            </div>
          </Row>
        </Card>
      </Section>

      <Section title="Timi">
        <Card>
          <Row href="/settings/ai">
            <IconTile className="bg-accent-soft">
              <Timi size={28} />
            </IconTile>
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-ink">Timi</div>
              <div className="text-[13px] text-ink-3">Model and effort</div>
            </div>
          </Row>
        </Card>
      </Section>

      <Section title="Data">
        <Card>
          <a
            href="/api/export"
            download
            className="tap flex items-center gap-3 border-b border-line px-4 py-3.5 active:bg-sunken"
          >
            <IconTile>
              <Download />
            </IconTile>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium text-ink">Export my data</div>
              <div className="text-[13px] text-ink-3">Everything, as one JSON file</div>
            </div>
          </a>
          <form action={logout} className="border-b border-line">
            <button type="submit" className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-sunken">
              <IconTile>
                <LogOut />
              </IconTile>
              <span className="flex-1 text-[15px] font-medium text-ink">Sign out</span>
            </button>
          </form>
          <DeleteAccountRow />
        </Card>
      </Section>

      <Section title="App">
        <Card>
          <InstallRow />
          <Row>
            <span className="flex-1 text-[15px] font-medium text-ink">Version</span>
            <span className="tnum text-[14px] text-ink-3">{pkg.version}</span>
          </Row>
        </Card>
      </Section>
    </div>
  );
}
