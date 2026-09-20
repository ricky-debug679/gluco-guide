export type BiologicalSex = "male" | "female"
export type ActivityLevel = "sedentary" | "light" | "active"

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  active: 1.55,
}

export const activityLabels: { key: ActivityLevel; label: string; hint: string }[] = [
  { key: "sedentary", label: "Sedentary", hint: "Little to no exercise" },
  { key: "light", label: "Lightly active", hint: "Light exercise 1–3 days/week" },
  { key: "active", label: "Active", hint: "Exercise most days" },
]

export function lbsToKg(lbs: number) {
  return lbs * 0.453592
}
export function kgToLbs(kg: number) {
  return kg / 0.453592
}
export function feetInchesToCm(feet: number, inches: number) {
  return (feet * 12 + inches) * 2.54
}

export function calculateBmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

export type BmiCategory = "underweight" | "healthy" | "overweight" | "obese"

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight"
  if (bmi < 25) return "healthy"
  if (bmi < 30) return "overweight"
  return "obese"
}

/** Healthy-BMI-range weight bounds (18.5–24.9), in kg, for this height. */
export function healthyWeightRangeKg(heightCm: number) {
  const heightM = heightCm / 100
  return { low: 18.5 * heightM * heightM, high: 24.9 * heightM * heightM }
}

// Mifflin-St Jeor — the equation dietitians actually use for a real BMR
// estimate, not a guess. Needs age and sex; there's no accurate way around
// that with weight and height alone.
function bmr(weightKg: number, heightCm: number, age: number, sex: BiologicalSex) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === "male" ? base + 5 : base - 161
}

export interface CaloriePlanInput {
  heightCm: number
  weightKg: number
  age: number
  sex: BiologicalSex
  activityLevel: ActivityLevel
}

export interface CaloriePlan {
  bmi: number
  category: BmiCategory
  healthyWeightLowKg: number
  healthyWeightHighKg: number
  maintenanceCalories: number
  targetCalories: number
  /** kg/week; negative = loss, positive = gain, 0 = maintaining. */
  weeklyChangeKg: number
  message: string
}

// Never recommend below these, regardless of how large the computed
// deficit would be — a hard safety floor, not a suggestion.
const MIN_SAFE_CALORIES: Record<BiologicalSex, number> = { male: 1500, female: 1200 }

export function buildCaloriePlan(input: CaloriePlanInput): CaloriePlan {
  const bmi = calculateBmi(input.heightCm, input.weightKg)
  const category = bmiCategory(bmi)
  const { low, high } = healthyWeightRangeKg(input.heightCm)
  const maintenanceCalories = Math.round(
    bmr(input.weightKg, input.heightCm, input.age, input.sex) * ACTIVITY_MULTIPLIERS[input.activityLevel],
  )

  if (category === "healthy") {
    return {
      bmi,
      category,
      healthyWeightLowKg: low,
      healthyWeightHighKg: high,
      maintenanceCalories,
      targetCalories: maintenanceCalories,
      weeklyChangeKg: 0,
      message: "Your BMI is already in the healthy range — this plan is set to maintenance calories to help you stay there, not lose more.",
    }
  }

  if (category === "underweight") {
    return {
      bmi,
      category,
      healthyWeightLowKg: low,
      healthyWeightHighKg: high,
      maintenanceCalories,
      targetCalories: maintenanceCalories,
      weeklyChangeKg: 0,
      message: "Your BMI is below the typical healthy range. This app won't suggest a calorie deficit here — talk to your doctor about a healthy weight gain plan tailored to you.",
    }
  }

  // overweight or obese: one gradual, capped, safe deficit — not a crash diet.
  const floor = MIN_SAFE_CALORIES[input.sex]
  const targetCalories = Math.max(maintenanceCalories - 500, floor)
  const actualDeficit = maintenanceCalories - targetCalories
  const weeklyChangeKg = -(actualDeficit * 7) / 7700 // ~7,700 kcal per kg of body fat

  return {
    bmi,
    category,
    healthyWeightLowKg: low,
    healthyWeightHighKg: high,
    maintenanceCalories,
    targetCalories,
    weeklyChangeKg,
    message: `A gradual ${Math.round(actualDeficit)}-calorie-a-day reduction from your estimated maintenance is a safe pace — about ${Math.abs(weeklyChangeKg).toFixed(1)}kg (${Math.abs(weeklyChangeKg * 2.2046).toFixed(1)}lb) a week toward a healthier BMI.`,
  }
}
