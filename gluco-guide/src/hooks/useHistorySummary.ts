import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { describeFunctionError } from "../lib/edgeFunctionError"

export interface HistorySummaryInput {
  language: string
  food: { daysLogged: number; avgFiberG: number; fiberTarget: number; avgProteinG: number; proteinTarget: number; avgCarbG: number; carbTarget: number; avgCaloriesKcal: number; calorieTarget: number }
  water: { daysLogged: number; avgCupsOnLoggedDays: number; target: number }
  exercise: { daysActive: number; avgMinutesOnActiveDays: number; totalMinutes: number; windowDays: number; dailyTarget: number; weeklyTarget: number }
  sleep: { daysLogged: number; avgHours: number; qualityCounts: { poor: number; okay: number; good: number; great: number } }
  supplements: { activeCount: number; dosesTaken: number; dosesPossible: number }
}

export interface HistorySummaryResult {
  doingWell: string
  improve: string
}

// Triggered on demand (a button tap), never automatically — this hits a
// paid AI call. A long staleTime means revisiting the History page within
// the cache window shows the same result instead of billing a new call;
// only an explicit "refresh" (a fresh `generate()` call after invalidating)
// re-fetches sooner.
export function useHistorySummary(memberId: string | undefined, input: HistorySummaryInput | null) {
  const query = useQuery({
    // Language is part of the key so switching languages never shows a summary written in the old one.
    queryKey: ["history_summary", memberId, input?.language],
    queryFn: async () => {
      if (!supabase || !memberId || !input) throw new Error("Not ready yet — try again in a moment.")
      const { data, error } = await supabase.functions.invoke("summarize-history", { body: input })
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      return data as HistorySummaryResult
    },
    enabled: false,
    staleTime: 1000 * 60 * 60 * 12,
  })

  return {
    data: query.data,
    isLoading: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    generate: () => query.refetch(),
  }
}
