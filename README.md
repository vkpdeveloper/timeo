# Timeo

A calm, mobile-first planner for the things that matter: 12-week seasons, goals, time blocks, focus
sessions and honest weekly reviews (the GPS method: **Goal, Plan, System**), with a full gym and
nutrition tracker built in. Installable as an app on iPhone and Android.

## What's inside

| Area | What it does |
| --- | --- |
| **Today** | Coach read for the day, now/next block, tasks, today's training and nutrition, and the *Tell Timeo* bar. |
| **Goals** | 12-week seasons. Brain dump → goals → Core / Secondary / Support tiers with weekly hours → milestones → weekly steps. Each goal gets an honest On track / Adjust / Off track status with reasons and one-tap fixes. Plan strength score. |
| **Plan** | Day and week calendar with time blocks tied to goals. Tracks reschedules (drift). Gym days appear automatically. |
| **Focus** | Full-screen focus timer against a block, task or goal. Rates focus and energy after; computes a focus quality score. |
| **Fitness** | Weekly split, routines with rep ranges, a one-handed set logger with rest timer and last-session numbers, history, PRs, estimated 1RM, body weight, diet plans (plus a plan library), meals and water. **Program presets**: load a whole split in one tap, or save your own. JSON import for existing training logs. |
| **Review** | Evening reflection, weekly review per goal (builds each goal's trajectory), focus chart and energy report. |
| **Ask Timeo (AI)** | A GPS-aware assistant (shadcn AI Elements, streaming). It creates seasons, goals, milestones and weekly steps, plans your week into time blocks, protects time, edits your gym split, and logs workouts, meals, water, weight and reflections, each reply undoable. Answers questions about your data in a line. Type or speak. |

The coach (statuses, drift reasons, plan strength, protect-time suggestions) is deterministic. AI is
only used by the assistant (`/assistant`, `src/app/api/assistant`, `src/lib/ai`).

## Stack

- Next.js 16 (App Router, Cache Components, Server Actions), React 19, Tailwind CSS 4
- Drizzle ORM on Turso (libSQL)
- Vercel AI SDK + shadcn AI Elements against OpenCode Go/Zen (model and reasoning effort are picked in Settings → AI; default Claude Haiku 5.5)
- PWA: web manifest, icons, service worker with offline fallback

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run db:migrate           # applies drizzle/ migrations to your Turso database
npm run dev
```

Open http://localhost:3000, create an account, and the Pull A / Push A / Pull B / Push B / Legs
program is loaded for you. Switch programs any time in Fitness → Programs.

### Environment

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | `libsql://…` database URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `OPENCODE_API_KEY` | OpenCode Go (or Zen) key for the assistant. Optional; the rest of the app works without it. |

### Database

Schema lives in `src/db/schema.ts`. After changing it:

```bash
npm run db:generate   # writes a new SQL migration to drizzle/
npm run db:migrate    # applies it
```

## Deploy (Vercel)

1. Import the GitHub repo in Vercel (framework preset: Next.js).
2. Add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and `OPENCODE_API_KEY` as environment variables.
3. Deploy. Migrations are already applied to the database; run `npm run db:migrate` locally after
   future schema changes.

AI commands can take up to ~2 minutes on high reasoning effort; the app segment sets
`maxDuration = 120`.

## Install on your phone

- **iPhone:** open the site in Safari → Share → *Add to Home Screen*.
- **Android:** open in Chrome → menu → *Install app*.

## Project layout

```
src/
  app/(auth)/        login, signup
  app/(app)/         Today, Plan, Goals, Fitness, Review, Settings (tab bar shell)
  app/(focus)/       full-screen focus timer
  actions/           shared server actions (tasks, blocks, health, AI)
  app/(assistant)/   full-screen AI assistant
  components/ui/     design system primitives
  components/ai-elements/, components/shadcn/   shadcn AI Elements (themed to Timeo tokens)
  components/forms/  shared bottom sheets (task, block, meal, weigh-in)
  db/                Drizzle schema and client
  lib/               dates, auth, coach, AI (catalog, provider routing, tools), fitness helpers
```

See `AGENTS.md` for code conventions.
