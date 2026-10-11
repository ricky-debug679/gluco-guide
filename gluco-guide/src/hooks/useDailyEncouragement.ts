import { useEffect, useRef, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { describeFunctionError } from "../lib/edgeFunctionError"
import { localDateKey } from "../lib/history"

export interface DailyProgress {
  caloriesKcal: number
  calorieTarget: number
  fiberG: number
  fiberTarget: number
  proteinG: number
  proteinTarget: number
  carbG: number
  carbTarget: number
  fatG: number
  fatTarget: number
  mealsLogged: number
  waterCups: number
  waterTarget: number
  exerciseMinutes: number
  exerciseTarget: number
  mindActivities: number
  sleepLogged: boolean
  supplementsTaken: number
  supplementsActive: number
}

// Logging several things in a row should cost one AI call, not one each.
const SETTLE_MS = 1500
// Messages are kept per progress snapshot for today, so reopening the app
// shows the last message without paying for a new one.
const CACHE_KEY = "glucoguide_daily_encouragement"

type Cache = { date: string; messages: Record<string, string> }

function readCache(): Cache {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as Cache | null
    if (cache?.date === localDateKey()) return cache
  } catch {
    // unreadable or unavailable storage: start fresh
  }
  return { date: localDateKey(), messages: {} }
}

function writeCache(signature: string, message: string) {
  try {
    const cache = readCache()
    cache.messages[signature] = message
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // storage unavailable: the in-memory query cache still works
  }
}

function useSettled<T>(value: T, ms: number) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

/** A short AI message about today's progress, and whether one is on its way. */
export function useDailyEncouragement(memberId: string | undefined, progress: DailyProgress | null, language: string) {
  const signature = progress
    ? JSON.stringify([language, ...Object.values(progress).map((v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v))])
    : null
  const latestProgress = useRef(progress)
  latestProgress.current = progress
  const settledSignature = useSettled(signature, SETTLE_MS)
  const cachedNow = signature ? readCache().messages[signature] : undefined

  const query = useQuery({
    queryKey: ["daily_encouragement", memberId, settledSignature],
    queryFn: async () => {
      if (!supabase || !settledSignature || !latestProgress.current) return null
      const cached = readCache().messages[settledSignature]
      if (cached) return cached
      const { data, error } = await supabase.functions.invoke("daily-encouragement", {
        body: { ...latestProgress.current, language, localHour: new Date().getHours() },
      })
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      writeCache(settledSignature, data.message)
      return data.message as string
    },
    enabled: !!supabase && !!memberId && !!settledSignature && !cachedNow,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
    retry: 1,
  })

  if (!signature) return { message: null, pending: false }
  const message = cachedNow ?? query.data ?? null
  const pending = !message && !query.isError && (settledSignature !== signature || query.isFetching)
  return { message, pending }
}
