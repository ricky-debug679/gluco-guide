import type {
  FiberSupplementOption,
  FoodItem,
  GroceryItem,
  HouseholdMember,
  LabMetric,
  NutrientTargets,
  NutrientTotals,
} from "./types"

export const mockHousehold: HouseholdMember[] = [
  {
    id: "asha",
    name: "Asha",
    relationship: "self",
    goal: "General wellness",
    statusNote: "You",
    avatarColor: "sage",
  },
  {
    id: "lakshmi",
    name: "Lakshmi",
    relationship: "family",
    goal: "Managing diabetes",
    statusNote: "Logged glucose this morning",
    avatarColor: "honey",
  },
  {
    id: "raj",
    name: "Raj",
    relationship: "family",
    goal: "Reversing prediabetes",
    statusNote: "5-day fiber streak",
    avatarColor: "berry",
  },
]

export const mockTargets: NutrientTargets = {
  fiberG: 30,
  proteinG: 90,
  carbG: 150,
  fatG: 78, // FDA Daily Value for total fat, 2,000-calorie diet
  caloriesKcal: 2000,
  waterCups: 8,
}

export const mockTotals: NutrientTotals = {
  fiberG: 18,
  proteinG: 52,
  carbG: 110,
  fatG: 34,
  caloriesKcal: 950,
  waterCups: 5,
}

export const mockFoodSearchResults: FoodItem[] = [
  { id: "f1", name: "Lentil & Vegetable Soup", portion: "1 bowl", fiberG: 8, proteinG: 12, carbG: 26, fatG: 4, caloriesKcal: 210 },
  { id: "f2", name: "Red Lentil Dal, 1 cup", portion: "1 cup", fiberG: 10, proteinG: 18, carbG: 32, fatG: 6, caloriesKcal: 260 },
  { id: "f3", name: "Lentil Crackers, 12 pc", portion: "12 pc", fiberG: 4, proteinG: 5, carbG: 20, fatG: 3, caloriesKcal: 140 },
]

export const mockGroceryItems: GroceryItem[] = [
  {
    id: "bread",
    brand: "Countryside Mills",
    name: "Multigrain Sandwich Bread",
    fiberG: 2,
    proteinG: 4,
    netCarbG: 21,
    scoreFraction: 0.22,
    blurb: "Leans carb-heavy today — a couple of easy swaps below would help.",
    pairSuggestion:
      "Add natural peanut butter or a boiled egg — the protein slows down the carb spike from the bread.",
    swap: { name: "Sprouted Whole Grain Bread", fiberG: 5, proteinG: 8, netCarbG: 14 },
  },
  {
    id: "oats",
    brand: "Harvest Row",
    name: "Steel-Cut Oats, 1/2 cup dry",
    fiberG: 8,
    proteinG: 6,
    netCarbG: 18,
    scoreFraction: 0.78,
    blurb: "A strong pick — high fiber and slow-digesting carbs.",
    pairSuggestion:
      "Already well-balanced — a spoon of chia seeds or a side of Greek yogurt adds even more protein.",
    swap: { name: "Sprouted Whole Grain Bread", fiberG: 5, proteinG: 8, netCarbG: 14 },
  },
]

export const mockLabMetrics: LabMetric[] = [
  {
    key: "glucose",
    label: "Fasting glucose (mg/dL)",
    shortLabel: "Fasting Glucose",
    targetLow: 70,
    targetHigh: 99,
    readings: [
      { date: "2026-03-02", value: 118 },
      { date: "2026-05-04", value: 112 },
      { date: "2026-06-08", value: 108 },
      { date: "2026-08-03", value: 101 },
      { date: "2026-10-05", value: 96 },
    ],
    summary:
      "Your fasting glucose has dropped 22 points since March — inside your target range for the first time.",
  },
  {
    key: "glucose_2h",
    label: "2-hour glucose, OGTT (mg/dL)",
    shortLabel: "2-Hr Glucose",
    targetLow: 0,
    targetHigh: 139,
    readings: [
      { date: "2026-03-02", value: 175 },
      { date: "2026-05-04", value: 162 },
      { date: "2026-06-08", value: 150 },
      { date: "2026-08-03", value: 140 },
      { date: "2026-10-05", value: 132 },
    ],
    summary:
      "Your 2-hour glucose has dropped from 175 to 132 mg/dL — moving out of the prediabetes range and into normal.",
  },
  {
    key: "a1c",
    label: "HbA1c (%)",
    shortLabel: "HbA1c",
    targetLow: 4,
    targetHigh: 5.7,
    readings: [
      { date: "2026-03-02", value: 6.3 },
      { date: "2026-05-04", value: 6.2 },
      { date: "2026-06-08", value: 6.0 },
      { date: "2026-08-03", value: 5.9 },
      { date: "2026-10-05", value: 5.7 },
    ],
    summary:
      "HbA1c is down to 5.7% — right at the edge of your goal range, several tenths lower than your first reading.",
  },
]

export const fiberSupplementOptions: FiberSupplementOption[] = [
  {
    kind: "psyllium",
    name: "Psyllium husk",
    mechanism:
      "Forms a thick gel in your gut that slows how fast sugar enters your bloodstream — regular use is linked to better insulin sensitivity.",
    fiberPerDoseG: 5,
    timingNote: "Take with a full glass of water, about 30 minutes before a meal — the water matters, since psyllium gels quickly.",
  },
  {
    kind: "barley",
    name: "Barley beta-glucan",
    mechanism:
      "Binds bile acids in the gut, which your liver replaces using LDL cholesterol from your blood — shown to help lower LDL over time.",
    fiberPerDoseG: 3,
    timingNote: "Take with a meal, mixed into food — it works alongside digestion rather than ahead of it.",
  },
  {
    kind: "acacia",
    name: "Acacia fiber",
    mechanism:
      "A gentler soluble fiber with less bloating than psyllium — a good starting point if psyllium feels like too much at first.",
    fiberPerDoseG: 5,
    timingNote: "Gentle enough to take any time of day, mixed into food or a drink — no strict timing needed.",
  },
]

export interface SupplementRecommendation {
  key: "vitamin_d" | "magnesium" | "chromium" | "zinc" | "b1"
  name: string
  mechanism: string
  typicalDosage: string
}

export const supplementRecommendations: SupplementRecommendation[] = [
  {
    key: "vitamin_d",
    name: "Vitamin D",
    mechanism:
      "Low vitamin D is strongly linked to worse insulin resistance — and deficiency is common, especially with limited sun exposure.",
    typicalDosage: "1,000–2,000 IU/day (maintenance)",
  },
  {
    key: "magnesium",
    name: "Magnesium",
    mechanism:
      "Involved directly in how your cells respond to insulin — low magnesium is common in type 2 diabetes and prediabetes.",
    typicalDosage: "300–400 mg/day",
  },
  {
    key: "chromium",
    name: "Chromium",
    mechanism: "Helps insulin do its job more effectively — some studies link low chromium to poorer glucose control.",
    typicalDosage: "200 mcg/day",
  },
  {
    key: "zinc",
    name: "Zinc",
    mechanism: "Needed for your body to produce and store insulin properly.",
    typicalDosage: "15 mg/day",
  },
  {
    key: "b1",
    name: "B1 (Thiamine)",
    mechanism:
      "People with diabetes are more likely to run low on thiamine, which matters for nerve health — a common concern with diabetes.",
    typicalDosage: "100 mg/day",
  },
]
