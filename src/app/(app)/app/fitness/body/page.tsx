import { and, desc, eq } from "drizzle-orm";
import { Scale } from "lucide-react";
import { Suspense } from "react";
import { Card, EmptyState, PageHeader, Section, Skeleton, Stat, StatStrip, SubHeader } from "@/components/ui/primitives";
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
      <SubHeader back="/app/fitness" backLabel="Body" />
      <Suspense
        fallback={
          <div>
            <div className="pt-5 pb-4">
              <Skeleton className="h-9 w-40" />
            </div>
            <Skeleton className="h-12" />
            <Skeleton className="mt-6 h-56 rounded-[16px]" />
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

  const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

  return (
    <div>
      <PageHeader
        title="Weight"
        subtitle={latest ? "Weigh in at the same time each day. Watch the average." : "A few weigh-ins a week is enough to see the trend."}
      />

      {!latest ? (
        <EmptyState icon={<Scale />} title="No weigh-ins yet" body="Log one now to start the trend." action={<WeighInButton today={user.today} />} />
      ) : (
        <>
          <StatStrip>
            <Stat value={fmtKg(latest.value)} unit="kg" label="latest" />
            <Stat value={fmtKg(r1(latestAvg))} unit="kg" label="7-day average" />
            <Stat
              value={change == null ? "—" : `${sign(r1(change))}${fmtKg(Math.abs(r1(change)))}`}
              unit={change == null ? undefined : "kg"}
              label="in 30 days"
            />
          </StatStrip>
          {points.length >= 2 && (
            <Section
              title="Trend"
              action={
                <span className="flex items-center gap-3 text-[12px] font-normal">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3.5 rounded-full bg-accent" /> Average
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-accent opacity-40" /> Daily
                  </span>
                </span>
              }
            >
              <Card className="rise px-2 pt-2 pb-2">
                <LineChart points={points} avg={avg} unit=" kg" color="var(--accent)" height={200} label="Body weight with 7-day average" />
              </Card>
            </Section>
          )}
          <div className="mt-4">
            <WeighInButton today={user.today} lastWeight={latest.value} />
          </div>
        </>
      )}

      {entries.length > 0 && (
        <Section title="Recent entries">
          <BodyEntries entries={entries} />
        </Section>
      )}
    </div>
  );
}
