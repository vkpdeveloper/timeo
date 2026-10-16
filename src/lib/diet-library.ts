// Ready-made diet plans users can copy with one tap. Indian-friendly staples,
// portions for a ~70-80 kg adult training 4-5 days a week. Fully editable after copying.

export type LibraryMeal = {
  name: string;
  time: string; // "HH:MM"
  items: string[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type LibraryPlan = {
  slug: string;
  name: string;
  goal: "cut" | "maintain" | "bulk" | "recomp";
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  meals: LibraryMeal[];
};

export const DIET_LIBRARY: LibraryPlan[] = [
  {
    slug: "lean-cut",
    name: "Lean cut",
    goal: "cut",
    description: "About 400–500 kcal under maintenance. High protein to keep muscle while losing fat.",
    calories: 1950,
    proteinG: 165,
    carbsG: 180,
    fatG: 60,
    waterMl: 3500,
    meals: [
      {
        name: "Breakfast",
        time: "08:00",
        items: ["Masala omelette (3 eggs + 2 whites)", "2 slices whole-wheat toast", "Black coffee or chai without sugar"],
        calories: 420,
        proteinG: 32,
        carbsG: 30,
        fatG: 18,
      },
      {
        name: "Lunch",
        time: "13:00",
        items: ["Grilled chicken breast 150 g", "1 cup cooked rice", "Dal, 1 katori", "Cucumber and onion salad"],
        calories: 560,
        proteinG: 50,
        carbsG: 65,
        fatG: 10,
      },
      {
        name: "Snack",
        time: "17:00",
        items: ["Hung curd or Greek yogurt 200 g", "1 apple", "10 almonds"],
        calories: 280,
        proteinG: 22,
        carbsG: 30,
        fatG: 8,
      },
      {
        name: "Dinner",
        time: "20:30",
        items: ["Paneer or fish tikka 150 g", "2 phulkas", "Sabzi, 1 bowl", "Salad"],
        calories: 560,
        proteinG: 40,
        carbsG: 50,
        fatG: 22,
      },
      {
        name: "Before bed",
        time: "22:30",
        items: ["Whey protein, 1 scoop in water"],
        calories: 120,
        proteinG: 24,
        carbsG: 3,
        fatG: 2,
      },
    ],
  },
  {
    slug: "maintenance",
    name: "Maintenance",
    goal: "maintain",
    description: "Steady weight, enough carbs to train well and recover.",
    calories: 2500,
    proteinG: 155,
    carbsG: 295,
    fatG: 80,
    waterMl: 3000,
    meals: [
      {
        name: "Breakfast",
        time: "08:00",
        items: ["Oats 60 g cooked in milk", "1 banana", "2 boiled eggs"],
        calories: 520,
        proteinG: 28,
        carbsG: 75,
        fatG: 14,
      },
      {
        name: "Lunch",
        time: "13:00",
        items: ["Chicken curry 150 g", "1.5 cups rice", "Dal, 1 katori", "Curd, 1 katori"],
        calories: 750,
        proteinG: 50,
        carbsG: 90,
        fatG: 20,
      },
      {
        name: "Snack",
        time: "17:00",
        items: ["Roasted chana 40 g", "1 seasonal fruit", "Chai"],
        calories: 300,
        proteinG: 13,
        carbsG: 45,
        fatG: 7,
      },
      {
        name: "Post-workout",
        time: "19:45",
        items: ["Whey protein with 250 ml milk"],
        calories: 260,
        proteinG: 32,
        carbsG: 15,
        fatG: 8,
      },
      {
        name: "Dinner",
        time: "21:00",
        items: ["Paneer bhurji 120 g", "3 phulkas", "Mixed veg sabzi"],
        calories: 700,
        proteinG: 35,
        carbsG: 70,
        fatG: 30,
      },
    ],
  },
  {
    slug: "lean-bulk",
    name: "Lean bulk",
    goal: "bulk",
    description: "About 250–300 kcal over maintenance for slow, mostly lean gain.",
    calories: 3050,
    proteinG: 170,
    carbsG: 380,
    fatG: 90,
    waterMl: 3500,
    meals: [
      {
        name: "Breakfast",
        time: "08:00",
        items: ["Oats 80 g with milk and 1 tbsp peanut butter", "1 banana", "3 eggs"],
        calories: 780,
        proteinG: 40,
        carbsG: 95,
        fatG: 26,
      },
      {
        name: "Lunch",
        time: "13:00",
        items: ["Chicken or rajma, 1 bowl", "2 cups rice", "Dal", "Curd"],
        calories: 850,
        proteinG: 50,
        carbsG: 120,
        fatG: 18,
      },
      {
        name: "Snack",
        time: "17:00",
        items: ["Peanut chikki or trail mix 40 g", "1 fruit", "Milk 250 ml"],
        calories: 450,
        proteinG: 16,
        carbsG: 55,
        fatG: 18,
      },
      {
        name: "Post-workout",
        time: "19:45",
        items: ["Whey protein in water", "1 banana"],
        calories: 230,
        proteinG: 26,
        carbsG: 30,
        fatG: 2,
      },
      {
        name: "Dinner",
        time: "21:00",
        items: ["Fish or paneer 150 g", "4 phulkas", "Sabzi"],
        calories: 760,
        proteinG: 42,
        carbsG: 85,
        fatG: 25,
      },
    ],
  },
  {
    slug: "high-protein-veg",
    name: "High-protein vegetarian",
    goal: "recomp",
    description: "Indian vegetarian, about 150 g protein from paneer, dals, curd, soy and whey.",
    calories: 2300,
    proteinG: 150,
    carbsG: 240,
    fatG: 75,
    waterMl: 3000,
    meals: [
      {
        name: "Breakfast",
        time: "08:00",
        items: ["3 moong dal chillas stuffed with 60 g paneer", "Mint chutney"],
        calories: 480,
        proteinG: 30,
        carbsG: 50,
        fatG: 16,
      },
      {
        name: "Lunch",
        time: "13:00",
        items: ["Rajma or chole, 1 bowl", "1 cup rice or 2 rotis", "Curd 200 g", "Salad"],
        calories: 650,
        proteinG: 30,
        carbsG: 90,
        fatG: 15,
      },
      {
        name: "Snack",
        time: "17:00",
        items: ["Hung curd or Greek yogurt 200 g", "Roasted chana 30 g"],
        calories: 300,
        proteinG: 25,
        carbsG: 28,
        fatG: 8,
      },
      {
        name: "Dinner",
        time: "20:30",
        items: ["Tofu or paneer tikka 150 g", "2 rotis", "Palak dal"],
        calories: 640,
        proteinG: 38,
        carbsG: 55,
        fatG: 28,
      },
      {
        name: "Before bed",
        time: "22:30",
        items: ["Whey or soy protein with milk"],
        calories: 250,
        proteinG: 30,
        carbsG: 15,
        fatG: 7,
      },
    ],
  },
];

export const GOAL_LABEL = { cut: "Cut", maintain: "Maintain", bulk: "Bulk", recomp: "Recomp" } as const;
