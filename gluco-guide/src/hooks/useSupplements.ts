import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import type { Supplement, SupplementRecommendationKey } from "../lib/types"

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useSupplements(memberId: string | undefined) {
  const queryClient = useQueryClient()
  const supplementsKey = ["supplements", memberId]
  const logsKey = ["supplement_logs", memberId]

  const supplementsQuery = useQuery({
    queryKey: supplementsKey,
    queryFn: async () => {
      if (!supabase || !memberId) return [] as Supplement[]
      const { data, error } = await supabase
        .from("supplements")
        .select("*")
        .eq("member_id", memberId)
        .eq("active", true)
        .order("created_at", { ascending: true })
      if (error) throw error
      return data as Supplement[]
    },
    enabled: !!memberId && !!supabase,
  })

  const logsQuery = useQuery({
    queryKey: logsKey,
    queryFn: async () => {
      if (!supabase || !memberId) return [] as { id: string; supplement_id: string }[]
      const { data, error } = await supabase
        .from("supplement_logs")
        .select("id, supplement_id")
        .eq("member_id", memberId)
        .gte("taken_at", startOfTodayIso())
      if (error) throw error
      return data
    },
    enabled: !!memberId && !!supabase,
  })

  const addSupplement = useMutation({
    mutationFn: async (input: { name: string; dosage: string; recommendationKey?: SupplementRecommendationKey }) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("supplements").insert({
        member_id: memberId,
        name: input.name,
        dosage: input.dosage || null,
        recommendation_key: input.recommendationKey ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplementsKey }),
  })

  const stopTracking = useMutation({
    mutationFn: async (supplementId: string) => {
      if (!supabase) return
      const { error } = await supabase.from("supplements").update({ active: false }).eq("id", supplementId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplementsKey }),
  })

  const toggleTaken = useMutation({
    mutationFn: async (supplementId: string) => {
      if (!supabase || !memberId) return
      const existing = (logsQuery.data ?? []).find((l) => l.supplement_id === supplementId)
      if (existing) {
        const { error } = await supabase.from("supplement_logs").delete().eq("id", existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("supplement_logs").insert({ supplement_id: supplementId, member_id: memberId })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: logsKey }),
  })

  const takenIds = new Set((logsQuery.data ?? []).map((l) => l.supplement_id))
  const active = supplementsQuery.data ?? []

  return {
    active,
    takenIds,
    takenCount: active.filter((s) => takenIds.has(s.id)).length,
    isLoading: supplementsQuery.isLoading || logsQuery.isLoading,
    addSupplement: (name: string, dosage: string, recommendationKey?: SupplementRecommendationKey) =>
      addSupplement.mutateAsync({ name, dosage, recommendationKey }),
    stopTracking: (supplementId: string) => stopTracking.mutateAsync(supplementId),
    toggleTaken: (supplementId: string) => toggleTaken.mutateAsync(supplementId),
  }
}
