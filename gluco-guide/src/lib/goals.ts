// Stored on the member row as a stable key, not localized text, so the
// saved value stays meaningful no matter what language is active later.
// Labels live in translation files under onboarding.goals.<key>.
export const goalKeys = ["reversePrediabetes", "preventFamily", "supportFamily", "generalWellness", "healthyWeight"] as const
export type GoalKey = (typeof goalKeys)[number]
