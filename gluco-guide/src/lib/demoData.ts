// Sample numbers for demo mode only: the app shows these when it runs
// without a Supabase backend configured. Real users never see them.
import type { FoodItem, LabMetricKey, LabReading, NutrientTotals } from "./types"

export const demoTotals: NutrientTotals = {
  fiberG: 18,
  proteinG: 52,
  carbG: 110,
  fatG: 34,
  caloriesKcal: 950,
  waterCups: 5,
}

export const demoFoodSearchResults: FoodItem[] = [
  { id: "f1", name: "Lentil & Vegetable Soup", portion: "1 bowl", fiberG: 8, proteinG: 12, carbG: 26, fatG: 4, caloriesKcal: 210 },
  { id: "f2", name: "Red Lentil Dal, 1 cup", portion: "1 cup", fiberG: 10, proteinG: 18, carbG: 32, fatG: 6, caloriesKcal: 260 },
  { id: "f3", name: "Lentil Crackers, 12 pc", portion: "12 pc", fiberG: 4, proteinG: 5, carbG: 20, fatG: 3, caloriesKcal: 140 },
]

export const demoLabHistory: Record<LabMetricKey, { readings: LabReading[]; summary: string }> = {
  glucose: {
    readings: [
      { date: "2026-03-02", value: 118 },
      { date: "2026-05-04", value: 112 },
      { date: "2026-06-08", value: 108 },
      { date: "2026-08-03", value: 101 },
      { date: "2026-10-05", value: 96 },
    ],
    summary: "Your fasting glucose has dropped 22 points since March — inside your target range for the first time.",
  },
  glucose_2h: {
    readings: [
      { date: "2026-03-02", value: 175 },
      { date: "2026-05-04", value: 162 },
      { date: "2026-06-08", value: 150 },
      { date: "2026-08-03", value: 140 },
      { date: "2026-10-05", value: 132 },
    ],
    summary: "Your 2-hour glucose has dropped from 175 to 132 mg/dL — moving out of the prediabetes range and into normal.",
  },
  a1c: {
    readings: [
      { date: "2026-03-02", value: 6.3 },
      { date: "2026-05-04", value: 6.2 },
      { date: "2026-06-08", value: 6.0 },
      { date: "2026-08-03", value: 5.9 },
      { date: "2026-10-05", value: 5.7 },
    ],
    summary: "HbA1c is down to 5.7% — just above the normal range, several tenths lower than your first reading.",
  },
}
