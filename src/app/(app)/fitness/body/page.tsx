import { and, desc, eq } from "drizzle-orm";
import { Scale } from "lucide-react";
import { Suspense } from "react";
import { EmptyState, Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { getWeights } from "@/lib/fitness";
import { fmtKg, rollingAverage } from "@/lib/fitness-math";
import { LineChart } from "../_components/line-chart";
import { BodyEntries, WeighInButton } from "./client";

export default function BodyPage() {
  return (
    <>
      <SubHeader back="/fitness" backLabel="Fitness" title="Body" />
      <Suspense
        fallback={
          <div className="pt-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="mt-6 h-56 rounded-[22px]" />
          </div>
        }
      >
        <Body />
      </Suspense>
    </>
  );
}

async function Body() {
  const user = await requireUser();
  const [weights, entries] = await Promise.all([
    getWeights(user.id, addDays(user.today, -120)),
    db
      .select()
      .from(t.bodyMetrics)
      .where(and(eq(t.bodyMetrics.userId, user.id)))
      .orderBy(desc(t.bodyMetrics.date))
      .limit(30),
  ]);
  const points = weights.map((w) => ({ date: w.date, value: w.weightKg }));
  const avg = rollingAverage(points, 7);
  const latest = points[points.length - 1];
  const latestAvg = avg[avg.length - 1];
  const monthAgo = points.findIndex((p) => p.date >= addDays(user.today, -30));
  const change = monthAgo >= 0 && points.length > 1 ? latestAvg - avg[monthAgo] : null;
  const r1 = (n: number) => Math.round(n * 10) / 10;

  return (
    <div className="fade-up pb-8">
      <header className="flex items-end justify-between gap-3 pt-5 pb-5">
        <div>
          <h1 className="display text-[38px] text-ink">Body</h1>
          <p className="mt-1 text-[15px] text-ink-2">Weigh in at the same time each day. Watch the average.</p>
        </div>
      </header>

      {!latest ? (
        <EmptyState
          icon={<Scale />}
          title="No weigh-ins yet"
          body="A few weigh-ins a week is enough to see the trend."
          action={<WeighInButton today={user.today} />}
        />
      ) : (
        <>
          <div className="card grid grid-cols-3 divide-x divide-line">
            <Stat label="Latest" value={fmtKg(latest.value)} unit="kg" />
            <Stat label="7-day avg" value={fmtKg(r1(latestAvg))} unit="kg" />
            <Stat
              label="30 days"
              value={change == null ? "—" : `${change > 0 ? "+" : change < 0 ? "−" : ""}${fmtKg(Math.abs(r1(change)))}`}
              unit={change == null ? undefined : "kg"}
            />
          </div>
          {points.length >= 2 && (
            <div className="card mt-3 px-2 pt-3 pb-2">
              <div className="flex items-center gap-4 px-2 pb-1 text-[12px] text-ink-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full bg-[var(--c-teal)]" /> 7-day average
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[var(--c-teal)] opacity-40" /> Daily
                </span>
              </div>
              <LineChart points={points} avg={avg} unit=" kg" color="var(--c-teal)" height={200} label="Body weight with 7-day average" />
            </div>
          )}
          <div className="mt-4">
            <WeighInButton today={user.today} lastWeight={latest.value} />
          </div>
        </>
      )}

      {entries.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2.5 px-1 text-[15px] font-semibold tracking-tight text-ink">Recent entries</h2>
          <BodyEntries entries={entries} />
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="tnum text-[22px] font-semibold tracking-tight text-ink">{value}</span>
        {unit && <span className="text-[12px] text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}
