import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { supabase } from "../lib/supabase"
import { describeFunctionError } from "../lib/edgeFunctionError"
import type { EstimatedMacros } from "./useFoodItemAnalysis"

export interface MealIngredient {
  name: string
  caution: boolean
  note: string
}

export interface MealClarifyingQuestion {
  question: string
  options: string[]
}

export interface MealPhotoAnalysis {
  mealName: string
  portionEstimate: string
  ingredients: MealIngredient[]
  estimatedMacros: EstimatedMacros
  verdict: "good" | "caution" | "neutral"
  insight: string
  nextTimeSuggestion: string
  clarifyingQuestion: MealClarifyingQuestion | null
}

export function useMealPhotoAnalysis() {
  const { i18n } = useTranslation()
  const analyze = useMutation({
    mutationFn: async (imageDataUrl: string) => {
      if (!supabase) throw new Error("Not configured")
      const { data, error } = await supabase.functions.invoke("analyze-meal-photo", {
        body: { image: imageDataUrl, language: i18n.language },
      })
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      return data as MealPhotoAnalysis
    },
  })

  return {
    analyze: (imageDataUrl: string) => analyze.mutateAsync(imageDataUrl),
    analyzing: analyze.isPending,
  }
}

export interface MealRefinementInput {
  mealName: string
  portionEstimate: string
  ingredients: MealIngredient[]
  question: string
  answer: string
}

/** Refined result omits clarifyingQuestion — one round of clarification is all we ask for. */
export type MealRefinement = Omit<MealPhotoAnalysis, "clarifyingQuestion">

export function useMealPhotoRefinement() {
  const { i18n } = useTranslation()
  const refine = useMutation({
    mutationFn: async (input: MealRefinementInput) => {
      if (!supabase) throw new Error("Not configured")
      const { data, error } = await supabase.functions.invoke("refine-meal-photo", {
        body: { ...input, language: i18n.language },
      })
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      return data as MealRefinement
    },
  })

  return {
    refine: (input: MealRefinementInput) => refine.mutateAsync(input),
    refining: refine.isPending,
  }
}
