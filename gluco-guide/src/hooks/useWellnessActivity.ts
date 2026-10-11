import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import type { WellnessActivityEntry, WellnessActivityKind } from "../lib/types"

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useWellnessActivity(memberId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["wellness_activity_logs", memberId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase || !memberId) return [] as WellnessActivityEntry[]
      const { data, error } = await supabase
        .from("wellness_activity_logs")
        .select("id, logged_at, activity, custom_label, duration_minutes")
        .eq("member_id", memberId)
        .gte("logged_at", startOfTodayIso())
        .order("logged_at", { ascending: false })
      if (error) throw error
      return data as WellnessActivityEntry[]
    },
    enabled: !!memberId && !!supabase,
  })

  const addActivity = useMutation({
    mutationFn: async (input: { activity: WellnessActivityKind; customLabel?: string; durationMinutes?: number }) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("wellness_activity_logs").insert({
        member_id: memberId,
        activity: input.activity,
        custom_label: input.customLabel ?? null,
        duration_minutes: input.durationMinutes ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    today: query.data ?? [],
    isLoading: query.isLoading,
    addActivity: (activity: WellnessActivityKind, customLabel?: string, durationMinutes?: number) =>
      addActivity.mutateAsync({ activity, customLabel, durationMinutes }),
  }
}
