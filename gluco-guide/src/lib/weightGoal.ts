import {
  buildCaloriePlan,
  kgToLbs,
  weightPaceKeys,
  type CaloriePlan,
  type CaloriePlanInput,
  type WeightPace,
} from "./caloriePlan"
import { round1 } from "./format"

const MS_PER_DAY = 86_400_000

// The CDC National Diabetes Prevention Program's weight-loss goal: 5–7% of
// body weight. Sign-up suggests the full 7%.
const DPP_LOSS_FRACTION = 0.07

export type GoalEstimate =
  | { kind: "minor" }
  | { kind: "aboveHealthy" }
  | { kind: "belowHealthy" }
  | { kind: "noChange" }
  | { kind: "eta"; gaining: boolean; rateLb: number; date: Date; activePace: WeightPace }

/**
 * Where a weight goal leads at the given pace. The finish date comes from the
 * same calorie plan the rings use, so it always matches what the app is
 * actually planning for.
 */
export function estimateGoal(input: CaloriePlanInput & { targetWeightKg: number }, pace?: WeightPace | null): GoalEstimate {
  const plan = buildCaloriePlan({ ...input, pace })
  if (plan.isMinor) return { kind: "minor" }
  const target = input.targetWeightKg
  const gaining = target > input.weightKg
  if (gaining && target > plan.healthyWeightHighKg) return { kind: "aboveHealthy" }
  if (!gaining && target < plan.healthyWeightLowKg) return { kind: "belowHealthy" }
  // The plan must actually be moving toward the goal for a date to mean anything.
  const towardGoal = gaining ? plan.weeklyChangeKg > 0 : plan.weeklyChangeKg < 0
  if (!towardGoal) return { kind: "noChange" }
  const ratePerWeekKg = Math.abs(plan.weeklyChangeKg)
  const weeks = Math.abs(target - input.weightKg) / ratePerWeekKg
  return {
    kind: "eta",
    gaining,
    rateLb: round1(kgToLbs(ratePerWeekKg)),
    date: new Date(Date.now() + weeks * 7 * MS_PER_DAY),
    // Without a saved choice the plan uses its default: gentle within the healthy range, steady outside it.
    activePace: pace ?? (plan.category === "healthy" ? "gentle" : "steady"),
  }
}

/** Each pace's real weekly rate for this person, after the calorie floor. */
export function paceOptions(input: CaloriePlanInput & { targetWeightKg: number }) {
  return weightPaceKeys.map((pace) => ({
    pace,
    rateLb: round1(kgToLbs(Math.abs(buildCaloriePlan({ ...input, pace }).weeklyChangeKg))),
  }))
}

/** "Feb 17" this year, "Feb 17, 2027" in any other. */
export function formatGoalDate(date: Date, language: string) {
  return date.toLocaleDateString(language, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  })
}

/**
 * The target weight sign-up suggests, in whole pounds: 7% lighter above the
 * healthy BMI range, the low end of it when underweight. No suggestion inside
 * the healthy range, where keeping a steady weight is the default.
 */
export function suggestedTargetLbs(plan: CaloriePlan, weightKg: number): number | null {
  if (plan.isMinor) return null
  if (plan.category === "overweight" || plan.category === "obese") return Math.round(kgToLbs(weightKg * (1 - DPP_LOSS_FRACTION)))
  if (plan.category === "underweight") return Math.ceil(kgToLbs(plan.healthyWeightLowKg))
  return null
}
