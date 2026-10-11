import type { FiberSupplementOption, LabMetric, NutrientTargets } from "./types"

export const defaultTargets: NutrientTargets = {
  fiberG: 30,
  proteinG: 90,
  carbG: 150,
  fatG: 78, // FDA Daily Value for total fat, 2,000-calorie diet
  caloriesKcal: 2000,
  waterCups: 8,
}

// Goal ranges follow the ADA's normal (non-prediabetes) cutoffs.
export const labMetrics: LabMetric[] = [
  {
    key: "glucose",
    label: "Fasting glucose (mg/dL)",
    shortLabel: "Fasting Glucose",
    targetLow: 70,
    targetHigh: 99,
  },
  {
    key: "glucose_2h",
    label: "2-hour glucose, OGTT (mg/dL)",
    shortLabel: "2-Hr Glucose",
    targetLow: 0,
    targetHigh: 139,
  },
  {
    key: "a1c",
    label: "HbA1c (%)",
    shortLabel: "HbA1c",
    targetLow: 4,
    // Normal is below 5.7%; 5.7% is where prediabetes starts.
    targetHigh: 5.6,
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
