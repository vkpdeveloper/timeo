// Builds the exercise library from free-exercise-db (public domain, github.com/yuhonas/free-exercise-db).
// Run: node scripts/exercise-catalog.mjs <free-exercise-db checkout> <image dir>
// Writes src/lib/exercise-catalog.json (everything, server side), src/lib/exercise-catalog-index.json
// (what search needs, loaded by the picker) and <image dir>/<id>/{0,1}.webp, which goes to the
// timeo-exercises R2 bucket (see EXERCISE_IMAGES in src/lib/exercise-catalog.ts). Upload with Cache-Control: public, max-age=31536000, immutable.
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const [src, imageDir] = process.argv.slice(2);
if (!src || !imageDir) throw new Error("Pass a free-exercise-db checkout and an output dir for images");
const raw = JSON.parse(await readFile(path.join(src, "dist/exercises.json"), "utf8"));

const MUSCLE = {
  abdominals: "core",
  chest: "chest",
  shoulders: "shoulders",
  neck: "shoulders",
  traps: "back",
  lats: "back",
  "middle back": "back",
  "lower back": "back",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  quadriceps: "legs",
  hamstrings: "legs",
  calves: "legs",
  adductors: "legs",
  abductors: "glutes",
  glutes: "glutes",
};
const EQUIPMENT = {
  barbell: "Barbell",
  dumbbell: "Dumbbells",
  cable: "Cable",
  machine: "Machine",
  "body only": "Bodyweight",
  kettlebells: "Kettlebell",
  bands: "Band",
  "medicine ball": "Medicine ball",
  "exercise ball": "Exercise ball",
  "foam roll": "Foam roller",
  "e-z curl bar": "EZ bar",
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const muscleFor = (e) => {
  if (e.category === "stretching") return "mobility";
  if (e.category === "cardio") return "cardio";
  if (e.category === "olympic weightlifting" || e.category === "strongman") return "full_body";
  return MUSCLE[e.primaryMuscles[0]] ?? "full_body";
};

const catalog = raw.map((e) => {
  const equipment = EQUIPMENT[e.equipment] ?? null;
  const type = e.category === "cardio" ? "cardio" : e.equipment === "body only" || e.category === "stretching" ? "bodyweight" : "weight";
  const unilateral = /\b(one|single)[- ](arm|leg)\b/i.test(e.name);
  return {
    id: slug(e.id),
    name: e.name,
    muscle: muscleFor(e),
    primary: e.primaryMuscles.map(cap),
    secondary: e.secondaryMuscles.map(cap),
    equipment,
    type,
    weightBasis: e.equipment === "dumbbell" && !unilateral ? "per_hand" : "total",
    unilateral,
    level: e.level,
    category: e.category,
    steps: e.instructions.map((s) => s.trim()).filter(Boolean),
    images: e.images.length,
    source: e.id,
  };
});
if (new Set(catalog.map((e) => e.id)).size !== catalog.length) throw new Error("Duplicate ids");

// 640px webp: sharp on a phone screen, about a fifth of the original jpgs
const out = path.resolve(imageDir);
let done = 0;
const queue = catalog.flatMap((e) => Array.from({ length: e.images }, (_, i) => [e, i]));
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const [e, i] = job;
      const dest = path.join(out, e.id, `${i}.webp`);
      if (!existsSync(dest)) {
        await mkdir(path.dirname(dest), { recursive: true });
        await sharp(path.join(src, "exercises", e.source, `${i}.jpg`))
          .resize({ width: 640, withoutEnlargement: true })
          .webp({ quality: 60 })
          .toFile(dest);
      }
      if (++done % 200 === 0) console.log(`${done} images`);
    }
  }),
);

const full = catalog.map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== "source")));
await writeFile("src/lib/exercise-catalog.json", JSON.stringify(full));
await writeFile(
  "src/lib/exercise-catalog-index.json",
  JSON.stringify(full.map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, primary: e.primary[0] ?? null, equipment: e.equipment, images: e.images }))),
);
console.log(`${catalog.length} exercises, ${done} images`);
