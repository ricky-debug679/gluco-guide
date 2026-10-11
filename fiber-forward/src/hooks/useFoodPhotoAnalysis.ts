import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { supabase } from "../lib/supabase"
import { describeFunctionError } from "../lib/edgeFunctionError"
import type { EstimatedMacros } from "./useFoodItemAnalysis"

export interface FoodPhotoItem {
  name: string
  verdict: "good" | "caution" | "neutral"
  insight: string
  estimatedMacros: EstimatedMacros
}

export interface FoodPhotoAnalysis {
  items: FoodPhotoItem[]
}

export function useFoodPhotoAnalysis() {
  const { i18n } = useTranslation()
  const analyze = useMutation({
    mutationFn: async (imageDataUrl: string) => {
      if (!supabase) throw new Error("Not configured")
      const { data, error } = await supabase.functions.invoke("analyze-food-photo", {
        body: { image: imageDataUrl, language: i18n.language },
      })
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      return data as FoodPhotoAnalysis
    },
  })

  return {
    analyze: (imageDataUrl: string) => analyze.mutateAsync(imageDataUrl),
    analyzing: analyze.isPending,
  }
}
