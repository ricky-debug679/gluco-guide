import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { fiberSupplementOptions } from "../lib/content"
import { describeFunctionError } from "../lib/edgeFunctionError"
import type { FiberSupplementKind } from "../lib/types"

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export interface FiberSupplementResearch {
  description: string
  usage: string
  timing: string
  estimatedFiberPerDoseG: number | null
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

  // A settings row only ever gets created by an explicit tap (select/saveCustom
  // below), so its mere existence IS "the user actually chose something" —
  // distinct from kind defaulting to psyllium below, which only governs what
  // a brand-new user is shown as a *suggestion* before they've chosen at all.
  const hasPreference = settingsQuery.data != null

  const select = useMutation({
    mutationFn: async (kind: Exclude<FiberSupplementKind, "custom">) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("fiber_supplement_settings").upsert(
        { member_id: memberId, kind, updated_at: new Date().toISOString() },
        { onConflict: "member_id" },
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  })

  // Researches the named product via AI, then saves name/fiber grams and the
  // research together in one write — triggered once by an explicit Save tap,
  // never per keystroke.
  const saveCustom = useMutation({
    mutationFn: async (input: { name: string; fiberGrams: number | null }) => {
      if (!supabase || !memberId) throw new Error("Not configured")
      const { data, error } = await supabase.functions.invoke("research-fiber-supplement", {
        body: { name: input.name, fiberGrams: input.fiberGrams, language: "en" },
      })
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      const research = data as FiberSupplementResearch

      const { error: upsertError } = await supabase.from("fiber_supplement_settings").upsert(
        {
          member_id: memberId,
          kind: "custom",
          custom_name: input.name,
          custom_fiber_g: input.fiberGrams ?? research.estimatedFiberPerDoseG ?? 0,
          custom_description: research.description,
          custom_usage: research.usage,
          custom_timing: research.timing,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id" },
      )
      if (upsertError) throw upsertError
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  })

  const remove = useMutation({
    mutationFn: async () => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("fiber_supplement_settings").delete().eq("member_id", memberId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  })

  const kind = (settingsQuery.data?.kind as FiberSupplementKind | undefined) ?? "psyllium"
  const customName = settingsQuery.data?.custom_name ?? ""
  const customFiberG = settingsQuery.data?.custom_fiber_g ?? undefined
  const customDescription = settingsQuery.data?.custom_description ?? ""
  const customUsage = settingsQuery.data?.custom_usage ?? ""
  const customTiming = settingsQuery.data?.custom_timing ?? ""
  const info =
    kind === "custom"
      ? {
          name: customName || "Your fiber supplement",
          mechanism: customDescription || "Tell us what you take so we can keep your reminder accurate.",
          fiberPerDoseG: customFiberG ?? 0,
          timingNote: customTiming || "Check the product's own label for when to take it.",
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
    hasPreference,
    customName,
    customFiberG,
    customDescription,
    customUsage,
    name: info.name,
    mechanism: info.mechanism,
    fiberPerDoseG: info.fiberPerDoseG,
    timingNote: info.timingNote,
    takenToday: (logsQuery.data?.length ?? 0) > 0,
    isLoading: settingsQuery.isLoading || logsQuery.isLoading,
    isSavingCustom: saveCustom.isPending,
    isRemoving: remove.isPending,
    select: (k: Exclude<FiberSupplementKind, "custom">) => select.mutateAsync(k),
    saveCustom: (name: string, fiberGrams: number | null) => saveCustom.mutateAsync({ name, fiberGrams }),
    remove: () => remove.mutateAsync(),
    markTaken: () => markTaken.mutateAsync(),
  }
}
