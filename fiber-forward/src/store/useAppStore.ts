import { create } from "zustand"
import {
  fiberSupplementOptions,
  mockGroceryItems,
  mockHousehold,
  mockLabMetrics,
  mockTargets,
  mockTotals,
} from "../lib/mockData"
import type {
  FiberSupplementKind,
  FoodItem,
  HouseholdMember,
  LabMetricKey,
  NutrientTargets,
  NutrientTotals,
  OnboardingState,
  ReminderState,
} from "../lib/types"

interface AppState {
  household: HouseholdMember[]
  targets: NutrientTargets
  totals: NutrientTotals
  todaysFoods: FoodItem[]

  groceryIndex: number

  activeLabKey: LabMetricKey

  reminder: ReminderState

  onboarding: OnboardingState

  // actions
  addWaterCup: () => void
  removeWaterCup: () => void
  addFoodToLog: (food: FoodItem) => void
  cycleGroceryItem: () => void
  setActiveLabKey: (key: LabMetricKey) => void
  markDoseTaken: () => void
  selectSupplement: (kind: FiberSupplementKind, customName?: string) => void
  setCustomSupplementName: (name: string) => void

  onboardingSetName: (name: string) => void
  onboardingSetGoal: (index: number) => void
  onboardingSetLabs: (fastingGlucose: string, hbA1c: string) => void
  onboardingAdvance: () => void
  onboardingComplete: () => void
}

const currentSupplement = () => {
  const psyllium = fiberSupplementOptions.find((o) => o.kind === "psyllium")!
  return psyllium
}

export const useAppStore = create<AppState>((set) => ({
  household: mockHousehold,
  targets: mockTargets,
  totals: mockTotals,
  todaysFoods: [],

  groceryIndex: 0,

  activeLabKey: "glucose",

  reminder: {
    nextDoseTime: "2:30 PM",
    takenToday: false,
    selectedKind: "psyllium",
    customName: "",
  },

  onboarding: {
    step: 0,
    name: "Asha",
    goalIndex: null,
    fastingGlucose: "",
    hbA1c: "",
    done: false,
  },

  addWaterCup: () =>
    set((s) => ({
      totals: { ...s.totals, waterCups: Math.min(s.targets.waterCups, s.totals.waterCups + 1) },
    })),

  removeWaterCup: () =>
    set((s) => ({
      totals: { ...s.totals, waterCups: Math.max(0, s.totals.waterCups - 1) },
    })),

  addFoodToLog: (food) =>
    set((s) => ({
      todaysFoods: [...s.todaysFoods, food],
      totals: {
        ...s.totals,
        fiberG: s.totals.fiberG + food.fiberG,
        proteinG: s.totals.proteinG + food.proteinG,
        carbG: s.totals.carbG + food.carbG,
      },
    })),

  cycleGroceryItem: () =>
    set((s) => ({ groceryIndex: (s.groceryIndex + 1) % mockGroceryItems.length })),

  setActiveLabKey: (key) => set({ activeLabKey: key }),

  markDoseTaken: () =>
    set((s) => ({ reminder: { ...s.reminder, takenToday: !s.reminder.takenToday } })),

  selectSupplement: (kind, customName) =>
    set((s) => ({
      reminder: {
        ...s.reminder,
        selectedKind: kind,
        customName: customName ?? s.reminder.customName,
      },
    })),

  setCustomSupplementName: (name) =>
    set((s) => ({ reminder: { ...s.reminder, customName: name } })),

  onboardingSetName: (name) =>
    set((s) => ({ onboarding: { ...s.onboarding, name } })),

  onboardingSetGoal: (index) =>
    set((s) => ({ onboarding: { ...s.onboarding, goalIndex: index } })),

  onboardingSetLabs: (fastingGlucose, hbA1c) =>
    set((s) => ({ onboarding: { ...s.onboarding, fastingGlucose, hbA1c } })),

  onboardingAdvance: () =>
    set((s) => ({ onboarding: { ...s.onboarding, step: Math.min(2, s.onboarding.step + 1) } })),

  onboardingComplete: () => set((s) => ({ onboarding: { ...s.onboarding, done: true } })),
}))

export const useCurrentSupplementInfo = () => {
  const reminder = useAppStore((s) => s.reminder)
  if (reminder.selectedKind === "custom") {
    return {
      name: reminder.customName || "Your fiber supplement",
      mechanism: "Tell us what you take so we can keep your reminder accurate.",
    }
  }
  const option = fiberSupplementOptions.find((o) => o.kind === reminder.selectedKind) ?? currentSupplement()
  return { name: option.name, mechanism: option.mechanism }
}

export { mockGroceryItems, mockLabMetrics, fiberSupplementOptions }
