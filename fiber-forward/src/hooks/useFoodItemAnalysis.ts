import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { supabase } from "../lib/supabase"
import { describeFunctionError } from "../lib/edgeFunctionError"

export interface EstimatedMacros {
  caloriesKcal: number
  proteinG: number
  carbG: number
  fatG: number
  fiberG: number
}

export interface FoodItemAnalysis {
  verdict: "good" | "caution" | "neutral"
  insight: string
  /** Only present when the request was for an item not found in our database. */
  estimatedMacros?: EstimatedMacros
}

export type FoodItemInput =
  | { name: string; caloriesKcal: number; proteinG: number; carbG: number; fatG: number; fiberG: number }
  | { name: string; unknown: true }

export function useFoodItemAnalysis() {
  const { i18n } = useTranslation()
  const analyze = useMutation({
    mutationFn: async (item: FoodItemInput) => {
      if (!supabase) throw new Error("Not configured")
      const { data, error } = await supabase.functions.invoke("analyze-food-item", {
        body: { ...item, language: i18n.language },
      })
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      return data as FoodItemAnalysis
    },
  })

  return {
    analyze: (item: FoodItemInput) => analyze.mutateAsync(item),
    analyzing: analyze.isPending,
  }
}
