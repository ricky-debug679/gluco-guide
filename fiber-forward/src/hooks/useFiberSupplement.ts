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
  const foodLogsKey = ["food_logs", memberId]

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
    mutationFn: async (input: { kind: FiberSupplementKind; customName?: string; customFiberG?: number }) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("fiber_supplement_settings").upsert(
        {
          member_id: memberId,
          kind: input.kind,
          custom_name: input.customName ?? null,
          custom_fiber_g: input.customFiberG ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id" },
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  })

  const kind = (settingsQuery.data?.kind as FiberSupplementKind | undefined) ?? "psyllium"
  const customName = settingsQuery.data?.custom_name ?? ""
  const customFiberG = settingsQuery.data?.custom_fiber_g ?? undefined
  const info =
    kind === "custom"
      ? {
          name: customName || "Your fiber supplement",
          mechanism: "Tell us what you take so we can keep your reminder accurate.",
          fiberPerDoseG: customFiberG ?? 0,
        }
      : (fiberSupplementOptions.find((o) => o.kind === kind) ?? fiberSupplementOptions[0])

  // Marking a dose "taken" also logs its fiber toward today's food total (and
  // the Home ring, which just sums food_logs) — undone the same way if the
  // user un-marks it, so toggling back and forth never double-counts.
  const markTaken = useMutation({
    mutationFn: async () => {
      if (!supabase || !memberId) return
      const rows = logsQuery.data ?? []
      if (rows.length > 0) {
        const { error } = await supabase.from("fiber_supplement_logs").delete().eq("id", rows[rows.length - 1].id)
        if (error) throw error

        const todayStart = startOfTodayIso()
        const { data: supplementFoodRows, error: findError } = await supabase
          .from("food_logs")
          .select("id")
          .eq("member_id", memberId)
          .eq("source", "supplement")
          .gte("logged_at", todayStart)
          .order("logged_at", { ascending: false })
          .limit(1)
        if (findError) throw findError
        if (supplementFoodRows.length > 0) {
          const { error: delError } = await supabase.from("food_logs").delete().eq("id", supplementFoodRows[0].id)
          if (delError) throw delError
        }
      } else {
        const { error } = await supabase.from("fiber_supplement_logs").insert({ member_id: memberId })
        if (error) throw error

        if (info.fiberPerDoseG > 0) {
          const { error: foodError } = await supabase.from("food_logs").insert({
            member_id: memberId,
            name: `${info.name} (fiber supplement)`,
            portion: "1 dose",
            fiber_g: info.fiberPerDoseG,
            protein_g: 0,
            carb_g: 0,
            source: "supplement",
          })
          if (foodError) throw foodError
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: logsKey })
      queryClient.invalidateQueries({ queryKey: foodLogsKey })
    },
  })

  return {
    kind,
    customName,
    customFiberG,
    name: info.name,
    mechanism: info.mechanism,
    fiberPerDoseG: info.fiberPerDoseG,
    takenToday: (logsQuery.data?.length ?? 0) > 0,
    isLoading: settingsQuery.isLoading || logsQuery.isLoading,
    select: (k: FiberSupplementKind, custom?: string, customFiber?: number) =>
      select.mutate({ kind: k, customName: custom, customFiberG: customFiber }),
    markTaken: () => markTaken.mutateAsync(),
  }
}
