import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfWeekIso() {
  const d = new Date()
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1 // treat Monday as start of week
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useExerciseLogs(memberId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["exercise_logs", memberId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase || !memberId) return []
      const { data, error } = await supabase
        .from("exercise_logs")
        .select("id, activity, duration_minutes, logged_at")
        .eq("member_id", memberId)
        .gte("logged_at", startOfWeekIso())
        .order("logged_at", { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!memberId && !!supabase,
  })

  const addExercise = useMutation({
    mutationFn: async (input: { activity: string; minutes: number }) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("exercise_logs").insert({
        member_id: memberId,
        activity: input.activity,
        duration_minutes: input.minutes,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const rows = query.data ?? []
  const todayStart = startOfTodayIso()
  const todayRows = rows.filter((r) => r.logged_at >= todayStart)
  const weekMinutes = rows.reduce((sum, r) => sum + r.duration_minutes, 0)
  const todayMinutes = todayRows.reduce((sum, r) => sum + r.duration_minutes, 0)

  return {
    thisWeek: rows,
    today: todayRows,
    weekMinutes,
    todayMinutes,
    isLoading: query.isLoading,
    addExercise: (activity: string, minutes: number) => addExercise.mutateAsync({ activity, minutes }),
  }
}
