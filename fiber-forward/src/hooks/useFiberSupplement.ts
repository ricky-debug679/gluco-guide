import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { fiberSupplementOptions } from "../lib/mockData"
import type { FiberSupplementKind } from "../lib/types"

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useFiberSupplement(memberId: string | undefined) {
  const queryClient = useQueryClient()
  const settingsKey = ["fiber_supplement_settings", memberId]
  const logsKey = ["fiber_supplement_logs", memberId]

  const settingsQuery = useQuery({
    queryKey: settingsKey,
    queryFn: async () => {
      if (!supabase || !memberId) return null
      const { data, error } = await supabase
        .from("fiber_supplement_settings")
        .select("*")
        .eq("member_id", memberId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!memberId && !!supabase,
  })

  const logsQuery = useQuery({
    queryKey: logsKey,
    queryFn: async () => {
      if (!supabase || !memberId) return []
      const { data, error } = await supabase
        .from("fiber_supplement_logs")
        .select("id, taken_at")
        .eq("member_id", memberId)
        .gte("taken_at", startOfTodayIso())
        .order("taken_at", { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!memberId && !!supabase,
  })

  const select = useMutation({
    mutationFn: async (input: { kind: FiberSupplementKind; customName?: string }) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("fiber_supplement_settings").upsert(
        {
          member_id: memberId,
          kind: input.kind,
          custom_name: input.customName ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id" },
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  })

  const markTaken = useMutation({
    mutationFn: async () => {
      if (!supabase || !memberId) return
      const rows = logsQuery.data ?? []
      if (rows.length > 0) {
        const { error } = await supabase.from("fiber_supplement_logs").delete().eq("id", rows[rows.length - 1].id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("fiber_supplement_logs").insert({ member_id: memberId })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: logsKey }),
  })

  const kind = (settingsQuery.data?.kind as FiberSupplementKind | undefined) ?? "psyllium"
  const customName = settingsQuery.data?.custom_name ?? ""
  const info =
    kind === "custom"
      ? {
          name: customName || "Your fiber supplement",
          mechanism: "Tell us what you take so we can keep your reminder accurate.",
        }
      : (fiberSupplementOptions.find((o) => o.kind === kind) ?? fiberSupplementOptions[0])

  return {
    kind,
    customName,
    name: "name" in info ? info.name : "",
    mechanism: "mechanism" in info ? info.mechanism : "",
    takenToday: (logsQuery.data?.length ?? 0) > 0,
    isLoading: settingsQuery.isLoading || logsQuery.isLoading,
    select: (k: FiberSupplementKind, custom?: string) => select.mutate({ kind: k, customName: custom }),
    markTaken: () => markTaken.mutate(),
  }
}
