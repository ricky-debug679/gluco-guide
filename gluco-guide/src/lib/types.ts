export interface NutrientTotals {
  fiberG: number
  proteinG: number
  carbG: number
  fatG: number
  caloriesKcal: number
  waterCups: number
}

export interface NutrientTargets {
  fiberG: number
  proteinG: number
  carbG: number
  fatG: number
  caloriesKcal: number
  waterCups: number
}

export interface FoodItem {
  id: string
  name: string
  portion: string
  fiberG: number
  proteinG: number
  carbG: number
  fatG: number
  caloriesKcal: number
}

export type LabMetricKey = "glucose" | "glucose_2h" | "a1c"

export interface LabReading {
  date: string
  value: number
}

export interface LabMetric {
  key: LabMetricKey
  targetLow: number
  targetHigh: number
}

export type FiberSupplementKind = "psyllium" | "barley" | "acacia" | "custom"

export interface FiberSupplementOption {
  kind: Exclude<FiberSupplementKind, "custom">
  /** Typical fiber grams per dose, for a real starting number a serving label would show. */
  fiberPerDoseG: number
}

export interface ReminderState {
  takenToday: boolean
  selectedKind: FiberSupplementKind
  customName: string
  customFiberG: number
}

export type SleepQuality = "poor" | "okay" | "good" | "great"

export interface SleepEntry {
  id: string
  logged_at: string
  hours: number
  quality: SleepQuality | null
}

export type WellnessActivityKind = "meditation" | "mindfulness" | "journaling" | "gratitude" | "breathing" | "custom"

export interface WellnessActivityEntry {
  id: string
  logged_at: string
  activity: WellnessActivityKind
  custom_label: string | null
  duration_minutes: number | null
}

export type SupplementRecommendationKey = "vitamin_d" | "magnesium" | "chromium" | "zinc" | "b1"

export interface Supplement {
  id: string
  member_id: string
  name: string
  dosage: string | null
  recommendation_key: SupplementRecommendationKey | null
  active: boolean
  created_at: string
}

export interface OnboardingState {
  step: number
  name: string
  goalIndex: number | null
  done: boolean
}
