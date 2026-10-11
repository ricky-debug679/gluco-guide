import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { buildHistoryDays, HISTORY_DAYS, startOfDaysAgo, type HistoryDay } from "../lib/history"

interface WaterLogRow {
  id: string
  logged_at: string
}

export function useWaterHistory(memberId: string | undefined) {
  const query = useQuery({
    queryKey: ["water_history", memberId],
    queryFn: async () => {
      if (!supabase || !memberId) return [] as WaterLogRow[]
      const { data, error } = await supabase
        .from("water_logs")
        .select("id, logged_at")
        .eq("member_id", memberId)
        .gte("logged_at", startOfDaysAgo(HISTORY_DAYS - 1).toISOString())
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data as WaterLogRow[]
    },
    enabled: !!memberId && !!supabase,
  })

  const rows = query.data ?? []
  // Each row is one cup, so a day's value is just how many rows landed in it.
  const days: HistoryDay[] = buildHistoryDays(rows, (r) => new Date(r.logged_at), (dayRows) => dayRows.length)

  return { days, isLoading: query.isLoading }
}
