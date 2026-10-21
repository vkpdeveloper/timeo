import { STARTER_ROUTINES, STARTER_SCHEDULE, STARTER_TRAINING_NOTES } from "@/lib/fitness-library";

// A whole gym program: routines, weekly split and notes. Used by built-in
// presets (below) and by programs the user saves (gym_programs.data).

export type ProgramRoutine = {
  name: string;
  focus: string;
  color: string;
  estimatedMin: number;
  notes?: string;
  exercises: { name: string; sets: number; reps: [number, number]; restSec?: number; provisional?: boolean; notes?: string }[];
};

export type ProgramDay = { weekday: number; routine?: string; label?: string; notes?: string; startMin?: number };

export type ProgramData = {
  routines: ProgramRoutine[];
  /** weekday 0 = Monday … 6 = Sunday */
  schedule: ProgramDay[];
  trainingNotes?: string;
};

export type GymPreset = ProgramData & {
  slug: string;
  name: string;
  description: string;
  daysPerWeek: number;
  level: "Beginner" | "Intermediate" | "Advanced";
};

const rest = (weekday: number, label = "Rest", notes?: string): ProgramDay => ({ weekday, label, notes });

export const GYM_PRESETS: GymPreset[] = [
  {
    slug: "pull-push-legs-5",
    name: "Pull · Push · Legs",
    description: "5 days. Two pull, two push, one leg day. Wednesday rest, easy cardio Sunday.",
    daysPerWeek: 5,
    level: "Intermediate",
    routines: STARTER_ROUTINES,
    schedule: STARTER_SCHEDULE,
    trainingNotes: STARTER_TRAINING_NOTES,
  },
  {
    slug: "upper-lower-4",
    name: "Upper / Lower",
    description: "4 days. Each muscle twice a week. Great balance of strength and recovery.",
    daysPerWeek: 4,
    level: "Intermediate",
    routines: [
      {
        name: "Upper A",
        focus: "Chest · Back · Shoulders · Arms",
        color: "sand",
        estimatedMin: 60,
        exercises: [
          { name: "Barbell bench press", sets: 3, reps: [5, 8], restSec: 150 },
          { name: "Barbell / Pendlay row", sets: 3, reps: [6, 10], restSec: 120 },
          { name: "Machine / dumbbell shoulder press", sets: 2, reps: [8, 12] },
          { name: "Lat pulldown", sets: 2, reps: [10, 12] },
          { name: "Hammer curl", sets: 2, reps: [10, 15], restSec: 60 },
          { name: "Triceps pushdown", sets: 2, reps: [10, 15], restSec: 60 },
        ],
      },
      {
        name: "Lower A",
        focus: "Quads · Hamstrings · Calves",
        color: "sage",
        estimatedMin: 60,
        exercises: [
          { name: "Barbell squat", sets: 3, reps: [5, 8], restSec: 180 },
          { name: "Romanian deadlift", sets: 3, reps: [8, 10], restSec: 120 },
          { name: "Leg press", sets: 2, reps: [10, 15] },
          { name: "Seated hamstring curl", sets: 2, reps: [10, 15], restSec: 75 },
          { name: "Calf raise", sets: 3, reps: [10, 20], restSec: 60 },
        ],
      },
      {
        name: "Upper B",
        focus: "Back · Chest · Shoulders · Arms",
        color: "sky",
        estimatedMin: 60,
        exercises: [
          { name: "Pull-up", sets: 3, reps: [6, 10], restSec: 120 },
          { name: "Incline dumbbell press", sets: 3, reps: [8, 12], restSec: 120 },
          { name: "Seated cable row", sets: 2, reps: [10, 12] },
          { name: "Lateral raise", sets: 3, reps: [12, 20], restSec: 60 },
          { name: "Incline dumbbell curl", sets: 2, reps: [10, 15], restSec: 60 },
          { name: "Overhead triceps extension", sets: 2, reps: [10, 15], restSec: 60 },
        ],
      },
      {
        name: "Lower B",
        focus: "Glutes · Quads · Hamstrings",
        color: "teal",
        estimatedMin: 55,
        exercises: [
          { name: "Hip thrust", sets: 3, reps: [8, 12], restSec: 120 },
          { name: "Leg press", sets: 3, reps: [10, 15], restSec: 120 },
          { name: "Leg extension", sets: 2, reps: [12, 15], restSec: 75 },
          { name: "Seated hamstring curl", sets: 3, reps: [10, 15], restSec: 75 },
          { name: "Calf raise", sets: 3, reps: [10, 20], restSec: 60 },
        ],
      },
    ],
    schedule: [
      { weekday: 0, routine: "Upper A", startMin: 19 * 60 },
      { weekday: 1, routine: "Lower A", startMin: 19 * 60 },
      rest(2, "Rest / easy walking"),
      { weekday: 3, routine: "Upper B", startMin: 19 * 60 },
      { weekday: 4, routine: "Lower B", startMin: 19 * 60 },
      rest(5, "Easy cardio", "20-40 min walk or cycle"),
      rest(6),
    ],
    trainingNotes: "Working sets exclude warm-ups.\nAim for 1-2 reps in reserve.\nAdd weight when you hit the top of the rep range on every set.",
  },
  {
    slug: "full-body-3",
    name: "Full body",
    description: "3 days. Simple and effective. Best if you're starting out or short on time.",
    daysPerWeek: 3,
    level: "Beginner",
    routines: [
      {
        name: "Full body A",
        focus: "Squat · Press · Row",
        color: "sky",
        estimatedMin: 55,
        exercises: [
          { name: "Barbell squat", sets: 3, reps: [5, 8], restSec: 150 },
          { name: "Barbell bench press", sets: 3, reps: [5, 8], restSec: 150 },
          { name: "Seated cable row", sets: 3, reps: [8, 12] },
          { name: "Lateral raise", sets: 2, reps: [12, 20], restSec: 60 },
          { name: "Plank", sets: 2, reps: [30, 60], restSec: 60, notes: "Seconds" },
        ],
      },
      {
        name: "Full body B",
        focus: "Hinge · Pull · Press",
        color: "olive",
        estimatedMin: 55,
        exercises: [
          { name: "Romanian deadlift", sets: 3, reps: [6, 10], restSec: 150 },
          { name: "Lat pulldown", sets: 3, reps: [8, 12] },
          { name: "Machine / dumbbell shoulder press", sets: 3, reps: [8, 12] },
          { name: "Leg press", sets: 2, reps: [10, 15] },
          { name: "Hammer curl", sets: 2, reps: [10, 15], restSec: 60 },
        ],
      },
    ],
    schedule: [
      { weekday: 0, routine: "Full body A", startMin: 19 * 60 },
      rest(1, "Rest / walk"),
      { weekday: 2, routine: "Full body B", startMin: 19 * 60 },
      rest(3, "Rest / walk"),
      { weekday: 4, routine: "Full body A", startMin: 19 * 60 },
      rest(5, "Easy cardio", "30 min, conversational pace"),
      rest(6),
    ],
    trainingNotes: "Alternate A and B each session.\nStop 2 reps before failure.\nWalk 7-8k steps daily.",
  },
  {
    slug: "ppl-6",
    name: "Push · Pull · Legs ×2",
    description: "6 days. High volume for experienced lifters with time to train.",
    daysPerWeek: 6,
    level: "Advanced",
    routines: [
      {
        name: "Push",
        focus: "Chest · Shoulders · Triceps",
        color: "sand",
        estimatedMin: 65,
        exercises: [
          { name: "Barbell bench press", sets: 4, reps: [5, 8], restSec: 150 },
          { name: "Incline dumbbell press", sets: 3, reps: [8, 12] },
          { name: "Machine / dumbbell shoulder press", sets: 3, reps: [8, 12] },
          { name: "Cable fly", sets: 2, reps: [12, 15], restSec: 60 },
          { name: "Lateral raise", sets: 4, reps: [12, 20], restSec: 60 },
          { name: "Triceps pushdown", sets: 3, reps: [10, 15], restSec: 60 },
        ],
      },
      {
        name: "Pull",
        focus: "Back · Biceps · Rear delts",
        color: "sky",
        estimatedMin: 65,
        exercises: [
          { name: "Deadlift", sets: 3, reps: [3, 6], restSec: 180 },
          { name: "Pull-up", sets: 3, reps: [6, 10], restSec: 120 },
          { name: "Seated cable row", sets: 3, reps: [8, 12] },
          { name: "Face pull", sets: 3, reps: [12, 20], restSec: 60 },
          { name: "Incline dumbbell curl", sets: 3, reps: [10, 15], restSec: 60 },
          { name: "Hammer curl", sets: 2, reps: [10, 15], restSec: 60 },
        ],
      },
      {
        name: "Legs",
        focus: "Quads · Hamstrings · Glutes · Calves",
        color: "sage",
        estimatedMin: 70,
        exercises: [
          { name: "Barbell squat", sets: 4, reps: [5, 8], restSec: 180 },
          { name: "Romanian deadlift", sets: 3, reps: [8, 10], restSec: 120 },
          { name: "Leg press", sets: 3, reps: [10, 15] },
          { name: "Seated hamstring curl", sets: 3, reps: [10, 15], restSec: 75 },
          { name: "Leg extension", sets: 2, reps: [12, 15], restSec: 75 },
          { name: "Calf raise", sets: 4, reps: [10, 20], restSec: 60 },
        ],
      },
    ],
    schedule: [
      { weekday: 0, routine: "Push", startMin: 19 * 60 },
      { weekday: 1, routine: "Pull", startMin: 19 * 60 },
      { weekday: 2, routine: "Legs", startMin: 19 * 60 },
      { weekday: 3, routine: "Push", startMin: 19 * 60 },
      { weekday: 4, routine: "Pull", startMin: 19 * 60 },
      { weekday: 5, routine: "Legs", startMin: 10 * 60 },
      rest(6, "Rest", "Full rest or an easy walk"),
    ],
    trainingNotes: "Aim for 1-2 reps in reserve.\nDeload every 6-8 weeks.",
  },
];

export const getPreset = (slug: string) => GYM_PRESETS.find((p) => p.slug === slug);
