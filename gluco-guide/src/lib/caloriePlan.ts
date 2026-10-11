export type BiologicalSex = "male" | "female"
export type ActivityLevel = "sedentary" | "light" | "active"

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  active: 1.55,
}

// Labels/hints live in translation files (onboarding.activity.<key>) — this
// just lists the keys so the UI knows which options to render.
export const activityLevelKeys: ActivityLevel[] = ["sedentary", "light", "active"]

export function lbsToKg(lbs: number) {
  return lbs * 0.453592
}
export function kgToLbs(kg: number) {
  return kg / 0.453592
}
export function feetInchesToCm(feet: number, inches: number) {
  return (feet * 12 + inches) * 2.54
}
export function cmToFeetInches(cm: number) {
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches - feet * 12)
  return { feet, inches }
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
  /** Daily calorie reduction from maintenance; 0 when category is healthy/underweight. The UI builds the localized message from this rather than a baked-in English string. */
  dailyDeficit: number
}

// Never recommend below these, regardless of how large the computed
// deficit would be — a hard safety floor, not a suggestion.
const MIN_SAFE_CALORIES: Record<BiologicalSex, number> = { male: 1500, female: 1200 }

export interface MacroTargets {
  proteinG: number
  fatG: number
  carbG: number
  fiberG: number
}

const MIN_CARB_G = 130 // RDA minimum
const MIN_FIBER_G = 25

/** Splits the calorie target into protein, fat, carbs, and fiber that add back up to it. */
export function buildMacroTargets(plan: CaloriePlan, input: CaloriePlanInput): MacroTargets {
  const kcal = plan.targetCalories
  // Above a healthy BMI, base protein on the top of the healthy range so the
  // target doesn't climb with excess weight; more per kg while losing weight
  // helps preserve muscle.
  const referenceKg = Math.min(input.weightKg, plan.healthyWeightHighKg)
  const gramsPerKg = plan.dailyDeficit > 0 ? 1.2 : 1.0
  const proteinG = Math.min(referenceKg * gramsPerKg, (kcal * 0.3) / 4)

  let fatG = (kcal * 0.3) / 9
  let carbG = (kcal - proteinG * 4 - fatG * 9) / 4
  if (carbG < MIN_CARB_G) {
    carbG = MIN_CARB_G
    fatG = Math.max((kcal * 0.2) / 9, (kcal - proteinG * 4 - carbG * 4) / 9)
  }

  return {
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbG: Math.round(carbG),
    fiberG: Math.round(Math.max(MIN_FIBER_G, (kcal / 1000) * 14)),
  }
}

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
      dailyDeficit: 0,
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
      dailyDeficit: 0,
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
    dailyDeficit: actualDeficit,
  }
}
