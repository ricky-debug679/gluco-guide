import type { FiberSupplementOption, LabMetric, NutrientTargets, SupplementRecommendationKey } from "./types"

// Display text for everything below lives in the locale files
// (fiberOptions.*, supplementRecs.*, labMetrics.*), keyed by these ids.

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
  { key: "glucose", targetLow: 70, targetHigh: 99 },
  { key: "glucose_2h", targetLow: 0, targetHigh: 139 },
  // Normal is below 5.7%; 5.7% is where prediabetes starts.
  { key: "a1c", targetLow: 4, targetHigh: 5.6 },
]

export const fiberSupplementOptions: FiberSupplementOption[] = [
  { kind: "psyllium", fiberPerDoseG: 5 },
  { kind: "barley", fiberPerDoseG: 3 },
  { kind: "acacia", fiberPerDoseG: 5 },
]

export const supplementRecommendationKeys: SupplementRecommendationKey[] = ["vitamin_d", "magnesium", "chromium", "zinc", "b1"]
