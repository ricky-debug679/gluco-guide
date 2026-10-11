import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import type { SleepEntry, SleepQuality } from "../lib/types"
import { localDateKey, startOfDaysAgo } from "../lib/history"

export function useSleepLogs(memberId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["sleep_logs", memberId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase || !memberId) return [] as SleepEntry[]
      const { data, error } = await supabase
        .from("sleep_logs")
        .select("id, logged_at, hours, quality")
        .eq("member_id", memberId)
        .gte("logged_at", localDateKey(startOfDaysAgo(14)))
        .order("logged_at", { ascending: false })
      if (error) throw error
      return data as SleepEntry[]
    },
    enabled: !!memberId && !!supabase,
  })

  // Upsert, not insert: one entry per (member, day) so logging again the
  // same day edits today's entry instead of silently creating a duplicate.
  const addSleep = useMutation({
    mutationFn: async (input: { hours: number; quality: SleepQuality; date: string }) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("sleep_logs").upsert(
        {
          member_id: memberId,
          logged_at: input.date,
          hours: input.hours,
          quality: input.quality,
        },
        { onConflict: "member_id,logged_at" },
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const entries = query.data ?? []
  const latest = entries[0]
  const loggedToday = latest?.logged_at === localDateKey()

  return {
    entries,
    latest,
    loggedToday,
    isLoading: query.isLoading,
    addSleep: (hours: number, quality: SleepQuality, date: string) =>
      addSleep.mutateAsync({ hours, quality, date }),
  }
}
