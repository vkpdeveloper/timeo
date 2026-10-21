// Client-safe. Ready-made prompts for the "Ask Timi" chip and the assistant's
// empty state. Each reads like something the user would type; Timi answers
// with the time math (what fits, what doesn't, the next step) and offers to
// block the time. Start one with `startRun(GUIDE.planToday)` from runs-client.

export const GUIDE = {
  /** Today: what fits in the hours left, in order. */
  planToday: "Plan the rest of my day. What fits in the time I have left?",
  /** Week: block goal time around what is already on the calendar. */
  planWeek: "Plan my week around my goals and block the time.",
  /** The certainty question: free time vs what the goals need. */
  whatFits: "What can I realistically get done this week?",
  /** Quick status across goals. */
  onTrack: "Am I on track this week?",
  /** One goal is drifting: smallest fix that protects it. */
  rescueGoal: (title: string) => `${title} is slipping. What's the smallest fix this week?`,
  /** Will one more thing fit? */
  canIFit: (what: string) => `Can I fit ${what} this week?`,
  /** No season yet: Timi asks for up to 3 outcomes, then sets it up. */
  firstSeason: "Help me set up my first 12-week season.",
  /** End of week: honest status per goal and what to change. */
  reviewWeek: "Review my week: what moved, what slipped, and what to change next week.",
  /** Log today's scheduled session as prescribed. */
  logWorkout: "Log today's workout as planned.",
} as const;

/** Chips for the assistant's empty state: short label, full prompt. */
export const GUIDE_SUGGESTIONS: { label: string; prompt: string }[] = [
  { label: "What fits this week?", prompt: GUIDE.whatFits },
  { label: "Plan my day", prompt: GUIDE.planToday },
  { label: "Plan my week", prompt: GUIDE.planWeek },
  { label: "Am I on track?", prompt: GUIDE.onTrack },
  { label: "Review my week", prompt: GUIDE.reviewWeek },
  { label: "Log today's workout", prompt: GUIDE.logWorkout },
];
