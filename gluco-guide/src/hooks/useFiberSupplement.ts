import { useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { supabase } from "../lib/supabase"
import { translateTexts } from "../lib/translateTexts"
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
  const { t, i18n } = useTranslation()
  const language = i18n.language
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
        body: { name: input.name, fiberGrams: input.fiberGrams, language },
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
          content_language: language,
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

  // Researched text for a custom product is saved in the language it was
  // written in; when the user's language differs, translate it once and save
  // the translation, so it follows them across languages.
  const settings = settingsQuery.data
  const researchNeedsTranslation =
    settings?.kind === "custom" &&
    settings.content_language !== language &&
    !!(settings.custom_description || settings.custom_usage || settings.custom_timing)
  const translationAttempt = useRef<string | null>(null)
  useEffect(() => {
    if (!researchNeedsTranslation || !supabase || !memberId) return
    const attempt = `${memberId}:${language}`
    if (translationAttempt.current === attempt) return
    translationAttempt.current = attempt
    const fields = [settings.custom_description ?? "", settings.custom_usage ?? "", settings.custom_timing ?? ""]
    translateTexts(fields, language)
      .then(async (raw) => {
        // Never replace real text with a blank translation.
        const [description, usage, timing] = raw.map((text, i) => (text.trim() ? text : fields[i]))
        const { error } = await supabase!
          .from("fiber_supplement_settings")
          .update({ custom_description: description, custom_usage: usage, custom_timing: timing, content_language: language })
          .eq("member_id", memberId)
        if (!error) queryClient.invalidateQueries({ queryKey: ["fiber_supplement_settings", memberId] })
      })
      .catch(() => {
        // Keep showing the saved text; this retries the next time the language changes.
      })
  }, [researchNeedsTranslation, language, memberId, settings, queryClient])

  const kind = (settingsQuery.data?.kind as FiberSupplementKind | undefined) ?? "psyllium"
  const customName = settingsQuery.data?.custom_name ?? ""
  const customFiberG = settingsQuery.data?.custom_fiber_g ?? undefined
  const customDescription = settingsQuery.data?.custom_description ?? ""
  const customUsage = settingsQuery.data?.custom_usage ?? ""
  const customTiming = settingsQuery.data?.custom_timing ?? ""
  const preset = fiberSupplementOptions.find((o) => o.kind === kind) ?? fiberSupplementOptions[0]
  const info =
    kind === "custom"
      ? {
          name: customName || t("fiberOptions.custom.name"),
          mechanism: customDescription || t("fiberOptions.custom.mechanism"),
          fiberPerDoseG: customFiberG ?? 0,
          timingNote: customTiming || t("fiberOptions.custom.timing"),
        }
      : {
          name: t(`fiberOptions.${preset.kind}.name`),
          mechanism: t(`fiberOptions.${preset.kind}.mechanism`),
          fiberPerDoseG: preset.fiberPerDoseG,
          timingNote: t(`fiberOptions.${preset.kind}.timing`),
        }

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
            name: t("fiberOptions.loggedFoodName", { name: info.name }),
            portion: t("fiberOptions.oneDose"),
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
