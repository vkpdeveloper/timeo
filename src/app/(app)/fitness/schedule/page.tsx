import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { Skeleton, SubHeader } from "@/components/ui/primitives";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth";
import { weekday } from "@/lib/dates";
import { getRoutines, getSchedule } from "@/lib/fitness";
import { ScheduleEditor } from "./editor";

export default function SchedulePage() {
  return (
    <>
      <SubHeader back="/fitness" backLabel="Fitness" />
      <Suspense
        fallback={
          <div>
            <div className="pt-5 pb-4">
              <Skeleton className="h-9 w-40" />
            </div>
            <Skeleton className="h-12" />
            <Skeleton className="mt-6 h-96 rounded-[20px]" />
          </div>
        }
      >
        <Schedule />
      </Suspense>
    </>
  );
}

async function Schedule() {
  const user = await requireUser();
  const routinesP = getRoutines(user.id);
  const [routines, schedule, row] = await Promise.all([
    routinesP,
    getSchedule(user.id, routinesP),
    db.select({ notes: t.users.trainingNotes }).from(t.users).where(eq(t.users.id, user.id)).get(),
  ]);
  return (
    <ScheduleEditor
      schedule={schedule}
      routines={routines.map((r) => ({ id: r.id, name: r.name, focus: r.focus, color: r.color, exerciseCount: r.exerciseCount }))}
      trainingNotes={row?.notes ?? ""}
      todayWeekday={weekday(user.today)}
    />
  );
}
