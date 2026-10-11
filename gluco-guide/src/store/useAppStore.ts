import { create } from "zustand"
import { fiberSupplementOptions, mockTargets, mockTotals } from "../lib/mockData"
import type {
  FiberSupplementKind,
  FoodItem,
  LabMetricKey,
  NutrientTargets,
  NutrientTotals,
  OnboardingState,
  ReminderState,
} from "../lib/types"

interface AppState {
  targets: NutrientTargets
  totals: NutrientTotals

  activeLabKey: LabMetricKey

  reminder: ReminderState

  onboarding: OnboardingState

  // actions
  addWaterCup: () => void
  removeWaterCup: () => void
  addFoodToLog: (food: FoodItem) => void
  setActiveLabKey: (key: LabMetricKey) => void
  markDoseTaken: () => void
  selectSupplement: (kind: FiberSupplementKind, customName?: string) => void
  setCustomSupplementName: (name: string) => void
  setCustomSupplementFiberG: (grams: number) => void

  onboardingSetName: (name: string) => void
  onboardingSetGoal: (index: number) => void
  onboardingAdvance: () => void
  onboardingComplete: () => void
}

const currentSupplement = () => {
  const psyllium = fiberSupplementOptions.find((o) => o.kind === "psyllium")!
  return psyllium
}

export const useAppStore = create<AppState>((set) => ({
  targets: mockTargets,
  totals: mockTotals,

  activeLabKey: "glucose",

  reminder: {
    takenToday: false,
    selectedKind: "psyllium",
    customName: "",
    customFiberG: 4,
  },

  onboarding: {
    step: 0,
    name: "Asha",
    goalIndex: null,
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
      totals: {
        ...s.totals,
        fiberG: s.totals.fiberG + food.fiberG,
        proteinG: s.totals.proteinG + food.proteinG,
        carbG: s.totals.carbG + food.carbG,
        fatG: s.totals.fatG + food.fatG,
        caloriesKcal: s.totals.caloriesKcal + food.caloriesKcal,
      },
    })),

  setActiveLabKey: (key) => set({ activeLabKey: key }),

  markDoseTaken: () =>
    set((s) => {
      const nowTaken = !s.reminder.takenToday
      const option = fiberSupplementOptions.find((o) => o.kind === s.reminder.selectedKind)
      const doseFiberG = s.reminder.selectedKind === "custom" ? s.reminder.customFiberG : (option?.fiberPerDoseG ?? 0)
      const delta = nowTaken ? doseFiberG : -doseFiberG
      return {
        reminder: { ...s.reminder, takenToday: nowTaken },
        totals: { ...s.totals, fiberG: Math.max(0, s.totals.fiberG + delta) },
      }
    }),

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

  setCustomSupplementFiberG: (grams) =>
    set((s) => ({ reminder: { ...s.reminder, customFiberG: grams } })),

  onboardingSetName: (name) =>
    set((s) => ({ onboarding: { ...s.onboarding, name } })),

  onboardingSetGoal: (index) =>
    set((s) => ({ onboarding: { ...s.onboarding, goalIndex: index } })),

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
      fiberPerDoseG: reminder.customFiberG,
      timingNote: "Check the product's own label for when to take it.",
    }
  }
  const option = fiberSupplementOptions.find((o) => o.kind === reminder.selectedKind) ?? currentSupplement()
  return { name: option.name, mechanism: option.mechanism, fiberPerDoseG: option.fiberPerDoseG, timingNote: option.timingNote }
}
