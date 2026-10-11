import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { buildHistoryDays, HISTORY_DAYS, startOfDaysAgo, type HistoryDay } from "../lib/history"

interface ExerciseLogRow {
  id: string
  logged_at: string
  duration_minutes: number
}

// Separate from useExerciseLogs (which deliberately only tracks today, for
// the Home ring and the Exercise screen's daily target) — this one is for
// the multi-day History page only.
export function useExerciseHistory(memberId: string | undefined) {
  const query = useQuery({
    queryKey: ["exercise_history", memberId],
    queryFn: async () => {
      if (!supabase || !memberId) return [] as ExerciseLogRow[]
      const { data, error } = await supabase
        .from("exercise_logs")
        .select("id, logged_at, duration_minutes")
        .eq("member_id", memberId)
        .gte("logged_at", startOfDaysAgo(HISTORY_DAYS - 1).toISOString())
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data as ExerciseLogRow[]
    },
    enabled: !!memberId && !!supabase,
  })

  const rows = query.data ?? []
  const days: HistoryDay[] = buildHistoryDays(
    rows,
    (r) => new Date(r.logged_at),
    (dayRows) => dayRows.reduce((sum, r) => sum + r.duration_minutes, 0),
  )

  return { days, isLoading: query.isLoading }
}
