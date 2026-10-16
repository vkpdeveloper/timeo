import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, t } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { getDailyRead } from "@/lib/coach";
import { formatMin, nowMinIn, startOfWeek, todayIn, weekday } from "@/lib/dates";
import { sendToUser } from "./send";
import { withDefaults, type NotifyPrefs, type PushPayload } from "./types";

/*
 * Time-based reminders. A cron hits /api/cron/notify every ~5 minutes; each
 * reminder has a window so a late or skipped run still delivers, and a key in
 * notification_log so it is never sent twice.
 */

type Due = PushPayload & { key: string };

const inWindow = (now: number, from: number, to: number) => now >= from && now < to;

async function dueFor(user: CurrentUser, prefs: NotifyPrefs, nowMin: number): Promise<Due[]> {
  const today = user.today;
  const out: Due[] = [];
  const wd = weekday(today);

  const [blocks, gym, logs, reflection, weekly, daily, plan] = await Promise.all([
    prefs.blocks
      ? db
          .select({ id: t.blocks.id, title: t.blocks.title, kind: t.blocks.kind, start: t.blocks.startMin, end: t.blocks.endMin, goal: t.goals.title })
          .from(t.blocks)
          .leftJoin(t.goals, eq(t.goals.id, t.blocks.goalId))
          .where(and(eq(t.blocks.userId, user.id), eq(t.blocks.date, today), isNull(t.blocks.doneAt), isNull(t.blocks.skippedAt)))
      : [],
    db
      .select({ start: t.gymSchedule.startMin, routine: t.workoutTemplates.name, estimatedMin: t.workoutTemplates.estimatedMin })
      .from(t.gymSchedule)
      .leftJoin(t.workoutTemplates, eq(t.workoutTemplates.id, t.gymSchedule.templateId))
      .where(and(eq(t.gymSchedule.userId, user.id), eq(t.gymSchedule.weekday, wd)))
      .get(),
    db.select({ id: t.workoutLogs.id }).from(t.workoutLogs).where(and(eq(t.workoutLogs.userId, user.id), eq(t.workoutLogs.date, today))),
    db
      .select({ id: t.reflections.id })
      .from(t.reflections)
      .where(and(eq(t.reflections.userId, user.id), eq(t.reflections.kind, "daily"), eq(t.reflections.date, today)))
      .get(),
    db
      .select({ id: t.reflections.id })
      .from(t.reflections)
      .where(and(eq(t.reflections.userId, user.id), eq(t.reflections.kind, "weekly"), eq(t.reflections.date, startOfWeek(today))))
      .get(),
    db.select({ waterMl: t.dailyLogs.waterMl }).from(t.dailyLogs).where(and(eq(t.dailyLogs.userId, user.id), eq(t.dailyLogs.date, today))).get(),
    db.select({ waterMl: t.dietPlans.waterMl }).from(t.dietPlans).where(and(eq(t.dietPlans.userId, user.id), eq(t.dietPlans.active, true))).get(),
  ]);

  // A block is about to start
  for (const b of blocks) {
    if (!inWindow(nowMin, b.start - prefs.blockLeadMin, b.start + 5)) continue;
    const isFocus = b.kind === "focus" || b.kind === "admin";
    out.push({
      key: `block:${b.id}:${today}:${b.start}`,
      title: b.title,
      body: `${formatMin(b.start)}–${formatMin(b.end)}${b.goal ? ` · ${b.goal}` : ""}`,
      url: isFocus ? `/focus?block=${b.id}` : b.kind === "workout" ? "/fitness" : `/plan?date=${today}`,
      tag: `block-${b.id}`,
    });
  }

  // Morning read
  if (prefs.morning && inWindow(nowMin, prefs.morningMin, prefs.morningMin + 45)) {
    const read = await getDailyRead(user).catch(() => null);
    out.push({
      key: `morning:${today}`,
      title: "Good morning",
      body: read ? [read.headline, read.detail].filter(Boolean).join(" ") : "Your day is ready.",
      url: "/",
      tag: "morning",
    });
  }

  // Gym session coming up
  if (prefs.workout && gym?.routine && gym.start != null && !logs.length && inWindow(nowMin, gym.start - 30, gym.start + 15)) {
    out.push({
      key: `workout:${today}`,
      title: `${gym.routine} at ${formatMin(gym.start)}`,
      body: gym.estimatedMin ? `About ${gym.estimatedMin} min. Tap to start.` : "Tap to start.",
      url: "/fitness",
      tag: "workout",
    });
  }

  // Evening reflection
  if (prefs.evening && !reflection && inWindow(nowMin, prefs.eveningMin, prefs.eveningMin + 60)) {
    out.push({ key: `evening:${today}`, title: "Evening check-in", body: "What moved today? One minute.", url: "/review", tag: "evening" });
  }

  // Sunday weekly review
  if (prefs.weekly && wd === 6 && !weekly && inWindow(nowMin, 19 * 60, 20 * 60)) {
    out.push({ key: `weekly:${startOfWeek(today)}`, title: "Weekly review", body: "Five minutes. How did each goal do?", url: "/review/week", tag: "weekly" });
  }

  // Water nudges at 11:00, 15:00, 18:00 when behind
  if (prefs.water) {
    const target = plan?.waterMl ?? 3000;
    const had = daily?.waterMl ?? 0;
    for (const slot of [11 * 60, 15 * 60, 18 * 60]) {
      const expected = Math.round((target * (slot - 8 * 60)) / (12 * 60));
      if (inWindow(nowMin, slot, slot + 30) && had < expected * 0.8) {
        out.push({
          key: `water:${today}:${slot}`,
          title: "Water check",
          body: `${(had / 1000).toFixed(1)} of ${(target / 1000).toFixed(1)} L so far.`,
          url: "/fitness/nutrition",
          tag: "water",
        });
      }
    }
  }

  // Quiet hours: nothing outside the user's planner day (blocks are allowed if they asked for them)
  return out.filter((d) => d.key.startsWith("block:") || inWindow(nowMin, user.dayStartMin, user.dayEndMin + 1));
}

/** Runs every due reminder for every user with a push subscription. */
export async function runReminders(now = new Date()) {
  const userIds = (await db.selectDistinct({ userId: t.pushSubscriptions.userId }).from(t.pushSubscriptions)).map((r) => r.userId);
  if (!userIds.length) return { users: 0, sent: 0 };
  const users = await db.select().from(t.users).where(inArray(t.users.id, userIds));

  let sent = 0;
  for (const u of users) {
    const current: CurrentUser = {
      id: u.id,
      name: u.name,
      email: u.email,
      timezone: u.timezone,
      dayStartMin: u.dayStartMin,
      dayEndMin: u.dayEndMin,
      today: todayIn(u.timezone, now),
    };
    const due = await dueFor(current, withDefaults(u.notifyPrefs), nowMinIn(u.timezone, now));
    for (const d of due) {
      // claim the key first; if another run already sent it, skip
      const claimed = await db
        .insert(t.notificationLog)
        .values({ userId: u.id, key: d.key, title: d.title, body: d.body ?? null })
        .onConflictDoNothing()
        .returning({ id: t.notificationLog.id });
      if (!claimed.length) continue;
      sent += (await sendToUser(u.id, { title: d.title, body: d.body, url: d.url, tag: d.tag })) > 0 ? 1 : 0;
    }
  }
  // keep the log small
  await db.delete(t.notificationLog).where(sql`${t.notificationLog.sentAt} < ${Date.now() - 14 * 86_400_000}`);
  return { users: users.length, sent };
}
