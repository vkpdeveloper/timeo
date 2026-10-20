import type { MUSCLE_GROUPS } from "@/db/schema";

type Muscle = (typeof MUSCLE_GROUPS)[number];
export type ExerciseSeed = {
  name: string;
  muscle: Muscle;
  equipment: string;
  type?: "weight" | "bodyweight" | "cardio";
  weightBasis?: "total" | "per_hand" | "per_arm";
  unilateral?: boolean;
  cues?: string;
  /** id in the exercise catalogue, for photos and steps */
  catalog?: string;
};

// Exercise library every new account receives (fully editable).
export const EXERCISE_LIBRARY: ExerciseSeed[] = [
  // Pull
  { name: "Barbell / Pendlay row", catalog: "bent-over-barbell-row", muscle: "back", equipment: "Barbell", cues: "Flat back, pull to lower chest, bar returns to the floor on Pendlays." },
  { name: "Lat pulldown", catalog: "wide-grip-lat-pulldown", muscle: "back", equipment: "Cable", cues: "Chest up, elbows to back pockets." },
  { name: "Seated cable row", catalog: "seated-cable-rows", muscle: "back", equipment: "Cable", cues: "Tall chest, squeeze shoulder blades, no rocking." },
  { name: "Straight-arm pulldown", catalog: "straight-arm-pulldown", muscle: "back", equipment: "Cable", cues: "Soft elbows, sweep the bar to the thighs." },
  { name: "Pull-up", catalog: "pullups", muscle: "back", equipment: "Bodyweight", type: "bodyweight" },
  { name: "Deadlift", catalog: "barbell-deadlift", muscle: "back", equipment: "Barbell" },
  { name: "Face pull", catalog: "face-pull", muscle: "shoulders", equipment: "Cable" },
  { name: "Hammer curl", catalog: "hammer-curls", muscle: "arms", equipment: "Dumbbells", weightBasis: "per_hand" },
  { name: "Dumbbell bicep curl", catalog: "dumbbell-bicep-curl", muscle: "arms", equipment: "Dumbbells", weightBasis: "per_hand" },
  { name: "Incline dumbbell curl", catalog: "incline-dumbbell-curl", muscle: "arms", equipment: "Dumbbells", weightBasis: "per_hand" },
  { name: "Wrist extension", catalog: "palms-down-dumbbell-wrist-curl-over-a-bench", muscle: "arms", equipment: "Dumbbells", weightBasis: "per_hand" },
  { name: "Side wrist raise", muscle: "arms", equipment: "Dumbbells", weightBasis: "per_hand" },
  // Push
  { name: "Incline dumbbell press", catalog: "incline-dumbbell-press", muscle: "chest", equipment: "Dumbbells", weightBasis: "per_hand", cues: "30° bench, elbows ~45°, full stretch." },
  { name: "Machine chest press", catalog: "leverage-chest-press", muscle: "chest", equipment: "Machine" },
  { name: "Cable fly", catalog: "cable-crossover", muscle: "chest", equipment: "Cable", cues: "Soft elbows, hug a tree, squeeze at the midline." },
  { name: "Chest fly", catalog: "butterfly", muscle: "chest", equipment: "Machine" },
  { name: "Barbell bench press", catalog: "barbell-bench-press-medium-grip", muscle: "chest", equipment: "Barbell" },
  { name: "Machine / dumbbell shoulder press", catalog: "dumbbell-shoulder-press", muscle: "shoulders", equipment: "Machine or dumbbells" },
  { name: "Lateral raise", catalog: "side-lateral-raise", muscle: "shoulders", equipment: "Dumbbells", weightBasis: "per_hand", cues: "Lead with elbows, stop at shoulder height." },
  { name: "Cable lateral raise", catalog: "cable-seated-lateral-raise", muscle: "shoulders", equipment: "Cable", weightBasis: "per_arm", unilateral: true },
  { name: "Skullcrusher", catalog: "ez-bar-skullcrusher", muscle: "arms", equipment: "EZ bar" },
  { name: "Single-arm cable pushdown", catalog: "cable-one-arm-tricep-extension", muscle: "arms", equipment: "Cable", weightBasis: "per_arm", unilateral: true },
  { name: "Triceps pushdown", catalog: "triceps-pushdown", muscle: "arms", equipment: "Cable" },
  { name: "Overhead triceps extension", catalog: "cable-rope-overhead-triceps-extension", muscle: "arms", equipment: "Cable" },
  // Legs
  { name: "Barbell squat", catalog: "barbell-squat", muscle: "legs", equipment: "Barbell", cues: "Brace, knees track toes, hit depth." },
  { name: "Leg press", catalog: "leg-press", muscle: "legs", equipment: "Machine" },
  { name: "Seated hamstring curl", catalog: "seated-leg-curl", muscle: "legs", equipment: "Machine" },
  { name: "Leg extension", catalog: "leg-extensions", muscle: "legs", equipment: "Machine" },
  { name: "Calf raise", catalog: "standing-calf-raises", muscle: "legs", equipment: "Machine" },
  { name: "Romanian deadlift", catalog: "romanian-deadlift", muscle: "legs", equipment: "Barbell" },
  { name: "Hip thrust", catalog: "barbell-hip-thrust", muscle: "glutes", equipment: "Barbell", cues: "Chin tucked, ribs down, squeeze at the top." },
  // Core / cardio
  { name: "Plank", catalog: "plank", muscle: "core", equipment: "Bodyweight", type: "bodyweight" },
  { name: "Hanging leg raise", catalog: "hanging-leg-raise", muscle: "core", equipment: "Bodyweight", type: "bodyweight" },
  { name: "Walking", catalog: "trail-running-walking", muscle: "cardio", equipment: "Outdoor", type: "cardio" },
  { name: "Cycling", catalog: "bicycling", muscle: "cardio", equipment: "Bike", type: "cardio" },
  { name: "Incline walk", catalog: "walking-treadmill", muscle: "cardio", equipment: "Treadmill", type: "cardio" },
];

type RoutineSeed = {
  name: string;
  focus: string;
  color: string;
  estimatedMin: number;
  notes?: string;
  exercises: { name: string; sets: number; reps: [number, number]; restSec?: number; provisional?: boolean; notes?: string }[];
};

export const STARTER_ROUTINES: RoutineSeed[] = [
  {
    name: "Pull A",
    focus: "Back · Biceps · Forearms",
    color: "sky",
    estimatedMin: 55,
    exercises: [
      { name: "Barbell / Pendlay row", sets: 2, reps: [6, 10], restSec: 150 },
      { name: "Lat pulldown", sets: 3, reps: [8, 12], restSec: 120 },
      { name: "Hammer curl", sets: 3, reps: [10, 15], restSec: 75 },
      { name: "Dumbbell bicep curl", sets: 2, reps: [10, 15], restSec: 75, provisional: true },
      { name: "Wrist extension", sets: 2, reps: [15, 20], restSec: 60 },
    ],
  },
  {
    name: "Push A",
    focus: "Chest · Shoulders · Triceps",
    color: "coral",
    estimatedMin: 55,
    exercises: [
      { name: "Incline dumbbell press", sets: 3, reps: [6, 10], restSec: 150 },
      { name: "Machine chest press", sets: 2, reps: [8, 12], restSec: 120 },
      { name: "Lateral raise", sets: 3, reps: [12, 20], restSec: 60 },
      { name: "Skullcrusher", sets: 3, reps: [10, 15], restSec: 75, notes: "Or single-arm cable pushdown. Choose one." },
    ],
  },
  {
    name: "Pull B",
    focus: "Back · Biceps · Forearms",
    color: "indigo",
    estimatedMin: 55,
    exercises: [
      { name: "Seated cable row", sets: 3, reps: [8, 12], restSec: 120 },
      { name: "Lat pulldown", sets: 2, reps: [10, 15], restSec: 120 },
      { name: "Straight-arm pulldown", sets: 2, reps: [12, 15], restSec: 75 },
      { name: "Incline dumbbell curl", sets: 3, reps: [10, 15], restSec: 75 },
      { name: "Side wrist raise", sets: 2, reps: [15, 20], restSec: 60 },
    ],
  },
  {
    name: "Push B",
    focus: "Shoulders · Chest · Triceps",
    color: "rose",
    estimatedMin: 60,
    exercises: [
      { name: "Machine / dumbbell shoulder press", sets: 3, reps: [8, 12], restSec: 120 },
      { name: "Machine chest press", sets: 3, reps: [8, 12], restSec: 120 },
      { name: "Cable fly", sets: 2, reps: [12, 15], restSec: 75 },
      { name: "Lateral raise", sets: 2, reps: [12, 20], restSec: 60 },
      { name: "Overhead triceps extension", sets: 3, reps: [10, 15], restSec: 75 },
    ],
  },
  {
    name: "Legs",
    focus: "Quads · Hamstrings · Glutes · Calves",
    color: "sage",
    estimatedMin: 75,
    notes: "15 working sets.",
    exercises: [
      { name: "Barbell squat", sets: 3, reps: [6, 8], restSec: 180 },
      { name: "Leg press", sets: 2, reps: [10, 15], restSec: 120 },
      { name: "Seated hamstring curl", sets: 3, reps: [10, 15], restSec: 90 },
      { name: "Hip thrust", sets: 2, reps: [8, 12], restSec: 120 },
      { name: "Leg extension", sets: 2, reps: [12, 15], restSec: 75 },
      { name: "Calf raise", sets: 3, reps: [10, 20], restSec: 60 },
    ],
  },
];

// Weekly split. weekday 0 = Monday.
export const STARTER_SCHEDULE: { weekday: number; routine?: string; label?: string; notes?: string; startMin?: number }[] = [
  { weekday: 0, routine: "Pull A", startMin: 19 * 60 },
  { weekday: 1, routine: "Push A", startMin: 19 * 60 },
  { weekday: 2, label: "Rest / easy walking" },
  { weekday: 3, routine: "Pull B", startMin: 19 * 60 },
  { weekday: 4, routine: "Push B", startMin: 19 * 60 },
  { weekday: 5, routine: "Legs", startMin: 10 * 60 },
  { weekday: 6, label: "Easy cardio or full rest", notes: "Walking, cycling or full rest · 20-40 min · conversational pace" },
];

export const STARTER_TRAINING_NOTES = [
  "Working sets exclude warm-ups.",
  "Aim for about 2 reps in reserve.",
  "Wednesday is rest; Saturday is the only leg day.",
].join("\n");

export const repsLabel = (min: number | null, max: number | null, fallback = "") =>
  min != null && max != null ? (min === max ? `${min}` : `${min}–${max}`) : min != null ? `${min}+` : fallback;
