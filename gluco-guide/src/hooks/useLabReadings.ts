import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import type { LabMetricKey, LabReading } from "../lib/types"

export function useLabReadings(memberId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["biometric_readings", memberId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase || !memberId) return {} as Record<LabMetricKey, LabReading[]>
      const { data, error } = await supabase
        .from("biometric_readings")
        .select("metric_key, value, recorded_at")
        .eq("member_id", memberId)
        .order("recorded_at", { ascending: true })
      if (error) throw error

      const grouped: Record<string, LabReading[]> = {}
      for (const row of data) {
        const key = row.metric_key as string
        if (!grouped[key]) grouped[key] = []
        grouped[key].push({ date: row.recorded_at, value: Number(row.value) })
      }
      return grouped as Record<LabMetricKey, LabReading[]>
    },
    enabled: !!memberId && !!supabase,
  })

  const addReading = useMutation({
    mutationFn: async (input: { metricKey: LabMetricKey; value: number; recordedAt: string }) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("biometric_readings").insert({
        member_id: memberId,
        metric_key: input.metricKey,
        value: input.value,
        recorded_at: input.recordedAt,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    readingsByMetric: query.data ?? ({} as Record<LabMetricKey, LabReading[]>),
    isLoading: query.isLoading,
    addReading: (metricKey: LabMetricKey, value: number, recordedAt: string) =>
      addReading.mutateAsync({ metricKey, value, recordedAt }),
  }
}
