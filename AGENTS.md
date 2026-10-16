<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Timeo — project conventions

Timeo is a mobile-first PWA: 12-week seasons and goals (GPS: Goal, Plan, System), time blocking,
focus sessions, reviews, plus training (routines, weekly split, set logging) and nutrition.
Mobile UX comes first; desktop must work but is secondary.

## Stack
- Next.js 16 App Router with **Cache Components** on (`cacheComponents: true`). Read
  `node_modules/next/dist/docs/` before using an API you are unsure about.
- Drizzle ORM on Turso/libSQL. Schema: `src/db/schema.ts`. Client: `import { db, t } from "@/db"`.
  Change schema → `npm run db:generate` → `npm run db:migrate`. Never hand-edit `drizzle/`.
- Tailwind v4, tokens in `src/app/globals.css` (`bg-surface`, `text-ink-2`, `border-line`, `bg-tint`, …).
- AI: Vercel AI SDK against OpenCode Go (`src/lib/ai`). Assistant messages run in the background
  (`/api/assistant/runs` + `after()`), are stored in `ai_commands` as history, and notify via Web Push.
- Offline/speed: `public/sw.js` serves IndexedDB page snapshots (stale-while-revalidate) and caches
  static assets; `src/components/shell/sw-register.tsx` refreshes data when the fresh copy arrives.

## Data rules
- Days are `"YYYY-MM-DD"` strings in the user's timezone (`user.today`); times of day are minutes
  from midnight; instants are unix ms. Helpers live in `src/lib/dates.ts`.
- Every query filters by `userId`. Every server action starts with `const user = await requireUser()`
  and checks ownership (`ownGoalId`, `ownTaskId` in `src/lib/queries.ts`).
- Mutations are server actions (`"use server"` files) ending with `refresh()` from `next/cache`.
  Shared actions: `src/actions/{tasks,blocks,health,context}.ts`. Feature actions sit next to the route.

## Page pattern (Cache Components)
Request data (cookies, DB) must render inside `<Suspense>`. Pages keep a static shell and stream content:

```tsx
export default function Page(props: PageProps<"/goals/[id]">) {
  return (
    <Suspense fallback={<GoalSkeleton />}>
      <GoalContent params={props.params} />
    </Suspense>
  );
}
async function GoalContent({ params }: { params: PageProps<"/goals/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  ...
}
```

## UI rules
- Use the primitives in `src/components/ui` (`PageHeader`, `SubHeader`, `Section`, `Card`, `Row`,
  `EmptyState`, `ProgressRing`, `StatusPill`, `Sheet`, `Button`, `Field`, `Input`, `Segmented`,
  `PillPicker`, `Stepper`, `CheckCircle`) and shared sheets in `src/components/forms/sheets.tsx`.
- Forms open in bottom `Sheet`s. Touch targets ≥ 44px. Inputs are 16px (no iOS zoom).
- Minimal and calm: one accent, hairline borders, generous spacing, `display` serif only for big titles
  and hero numbers, `tnum` for numbers. Colours for goals/routines come from `src/lib/colors.ts`.
- Copy is short and plain. No exclamation marks, no filler.
