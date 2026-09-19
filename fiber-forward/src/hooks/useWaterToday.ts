import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useWaterToday(memberId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["water_logs", memberId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase || !memberId) return []
      const { data, error } = await supabase
        .from("water_logs")
        .select("id, logged_at")
        .eq("member_id", memberId)
        .gte("logged_at", startOfTodayIso())
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!memberId && !!supabase,
  })

  const addCup = useMutation({
    mutationFn: async () => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("water_logs").insert({ member_id: memberId, cups: 1 })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const removeCup = useMutation({
    mutationFn: async () => {
      if (!supabase || !memberId) return
      const rows = query.data ?? []
      const last = rows[rows.length - 1]
      if (!last) return
      const { error } = await supabase.from("water_logs").delete().eq("id", last.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    cupsToday: query.data?.length ?? 0,
    isLoading: query.isLoading,
    addCup: () => addCup.mutate(),
    removeCup: () => removeCup.mutate(),
  }
}
