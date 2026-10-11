import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { buildHistoryDays, HISTORY_DAYS, startOfDaysAgo, type HistoryDay } from "../lib/history"

interface SupplementLogRow {
  id: string
  taken_at: string
  supplement_id: string
}

export function useSupplementHistory(memberId: string | undefined) {
  const activeQuery = useQuery({
    queryKey: ["supplements_active_count", memberId],
    queryFn: async () => {
      if (!supabase || !memberId) return 0
      const { count, error } = await supabase
        .from("supplements")
        .select("id", { count: "exact", head: true })
        .eq("member_id", memberId)
        .eq("active", true)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!memberId && !!supabase,
  })

  const logsQuery = useQuery({
    queryKey: ["supplement_logs_history", memberId],
    queryFn: async () => {
      if (!supabase || !memberId) return [] as SupplementLogRow[]
      const { data, error } = await supabase
        .from("supplement_logs")
        .select("id, taken_at, supplement_id")
        .eq("member_id", memberId)
        .gte("taken_at", startOfDaysAgo(HISTORY_DAYS - 1).toISOString())
        .order("taken_at", { ascending: true })
      if (error) throw error
      return data as SupplementLogRow[]
    },
    enabled: !!memberId && !!supabase,
  })

  const rows = logsQuery.data ?? []
  const activeCount = activeQuery.data ?? 0
  const days: HistoryDay[] = buildHistoryDays(rows, (r) => new Date(r.taken_at), (dayRows) => dayRows.length)
  const dosesTaken = rows.length
  const dosesPossible = activeCount * HISTORY_DAYS

  return {
    days,
    activeCount,
    dosesTaken,
    dosesPossible,
    isLoading: activeQuery.isLoading || logsQuery.isLoading,
  }
}
