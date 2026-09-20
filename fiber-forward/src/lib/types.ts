export type AvatarColor = "sage" | "honey" | "berry"

export interface HouseholdMember {
  id: string
  name: string
  relationship: "self" | "family"
  goal: string
  statusNote: string
  avatarColor: AvatarColor
}

export interface NutrientTotals {
  fiberG: number
  proteinG: number
  carbG: number
  fatG: number
  waterCups: number
}

export interface NutrientTargets {
  fiberG: number
  proteinG: number
  carbG: number
  fatG: number
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
}

export interface GrocerySwap {
  name: string
  fiberG: number
  proteinG: number
  netCarbG: number
}

export interface GroceryItem {
  id: string
  brand: string
  name: string
  fiberG: number
  proteinG: number
  netCarbG: number
  /** 0 = mostly refined carbs, 1 = mostly fiber & protein */
  scoreFraction: number
  blurb: string
  pairSuggestion: string
  swap: GrocerySwap
}

export type LabMetricKey = "glucose" | "a1c" | "chol"

export interface LabReading {
  date: string
  value: number
}

export interface LabMetric {
  key: LabMetricKey
  label: string
  shortLabel: string
  targetLow: number
  targetHigh: number
  readings: LabReading[]
  summary: string
}

export type FiberSupplementKind = "psyllium" | "barley" | "acacia" | "custom"

export interface FiberSupplementOption {
  kind: FiberSupplementKind
  name: string
  mechanism: string
  /** Typical fiber grams per dose, for a real starting number a serving label would show. */
  fiberPerDoseG: number
}

export interface ReminderState {
  nextDoseTime: string
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
  fastingGlucose: string
  hbA1c: string
  done: boolean
}
