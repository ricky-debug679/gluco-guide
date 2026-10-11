import { useMemo } from "react"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useAppStore } from "../store/useAppStore"
import { buildCaloriePlan, buildMacroTargets } from "../lib/caloriePlan"
import type { NutrientTargets } from "../lib/types"

/** Daily targets from the user's own profile; the defaults until their profile is complete. */
export function usePersonalTargets(): NutrientTargets {
  const defaults = useAppStore((s) => s.targets)
  const self = useOptionalHousehold()?.household.selfMember
  const heightCm = self?.height_cm
  const weightKg = self?.weight_kg
  const age = self?.age
  const sex = self?.biological_sex
  const activityLevel = self?.activity_level

  return useMemo(() => {
    if (!heightCm || !weightKg || !age || !sex || !activityLevel) return defaults
    const input = { heightCm, weightKg, age, sex, activityLevel }
    const plan = buildCaloriePlan(input)
    return { ...defaults, ...buildMacroTargets(plan, input), caloriesKcal: plan.targetCalories }
  }, [defaults, heightCm, weightKg, age, sex, activityLevel])
}
