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
  /** From the user's weight goal, if they set one. */
  targetWeightKg?: number | null
  /** The pace they picked; unset uses the default for their BMI. */
  pace?: WeightPace | null
}

export type WeightPace = "gentle" | "steady" | "faster"
export const weightPaceKeys: WeightPace[] = ["gentle", "steady", "faster"]

// Daily calories under or over maintenance (~3,500 kcal per lb). Loss spans
// the commonly cited safe 1–2 lb/week (plus a gentler 0.5); gain stays at
// 0.5–1 lb/week, the usual guidance for healthy weight gain.
const LOSS_DEFICIT: Record<WeightPace, number> = { gentle: 250, steady: 500, faster: 1000 }
const GAIN_SURPLUS: Record<WeightPace, number> = { gentle: 250, steady: 350, faster: 500 }

export interface CaloriePlan {
  bmi: number
  category: BmiCategory
  healthyWeightLowKg: number
  healthyWeightHighKg: number
  maintenanceCalories: number
  targetCalories: number
  /** kg/week; negative = loss, positive = gain, 0 = maintaining. */
  weeklyChangeKg: number
  /** Daily calorie reduction from maintenance; 0 when maintaining. The UI builds the localized message from this rather than a baked-in English string. */
  dailyDeficit: number
  /** Daily calories added over maintenance for a healthy gain; 0 otherwise. */
  dailySurplus: number
  /** Under 18: adult BMI cutoffs and this equation don't apply to a growing body, so the plan stays at maintenance. */
  isMinor: boolean
  /** True when the safety floor made the deficit smaller than the chosen pace asked for. */
  cappedByFloor: boolean
}

const ADULT_AGE = 18

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
  // Base protein on a weight inside the healthy range, so the target doesn't
  // climb with excess weight or stay too low while underweight; more per kg
  // while losing (preserves muscle), gaining (builds it), or exercising most days.
  const referenceKg = Math.min(Math.max(input.weightKg, plan.healthyWeightLowKg), plan.healthyWeightHighKg)
  const gramsPerKg =
    plan.dailyDeficit > 0 || plan.dailySurplus > 0 || input.activityLevel === "active" ? 1.2 : 1.0
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

  // Gradual, capped changes only — never a crash diet or a binge. The person
  // picks a pace; without one, above a healthy BMI defaults to ~1 lb/week
  // down, underweight to ~0.7 lb/week up, and within the healthy range to
  // ~0.5 lb/week toward a goal weight that stays in it. The calorie floor
  // always wins over the pace. Under 18 always stays at maintenance.
  const isMinor = input.age < ADULT_AGE
  const target = input.targetWeightKg
  const lossGoalInRange = category === "healthy" && !!target && target < input.weightKg && target >= low
  const gainGoalInRange = category === "healthy" && !!target && target > input.weightKg && target <= high
  let plannedDeficit = 0
  let plannedSurplus = 0
  if (!isMinor) {
    if (category === "overweight" || category === "obese") plannedDeficit = LOSS_DEFICIT[input.pace ?? "steady"]
    else if (category === "underweight") plannedSurplus = GAIN_SURPLUS[input.pace ?? "steady"]
    else if (lossGoalInRange) plannedDeficit = LOSS_DEFICIT[input.pace ?? "gentle"]
    else if (gainGoalInRange) plannedSurplus = GAIN_SURPLUS[input.pace ?? "gentle"]
  }
  const floor = Math.min(maintenanceCalories, MIN_SAFE_CALORIES[input.sex])
  const cappedByFloor = maintenanceCalories - plannedDeficit < floor
  const targetCalories = Math.max(maintenanceCalories - plannedDeficit, floor) + plannedSurplus
  const dailyDeficit = Math.max(0, maintenanceCalories - targetCalories)
  const dailySurplus = Math.max(0, targetCalories - maintenanceCalories)

  return {
    bmi,
    category,
    healthyWeightLowKg: low,
    healthyWeightHighKg: high,
    maintenanceCalories,
    targetCalories,
    weeklyChangeKg: ((dailySurplus - dailyDeficit) * 7) / 7700, // ~7,700 kcal per kg of body weight
    dailyDeficit,
    dailySurplus,
    isMinor,
    cappedByFloor,
  }
}
