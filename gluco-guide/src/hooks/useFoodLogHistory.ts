import { useQuery } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"

const HISTORY_DAYS = 14

export interface FoodLogEntry {
  id: string
  name: string
  portion: string
  fiber_g: number
  protein_g: number
  carb_g: number
  fat_g: number
  calories_kcal: number
  logged_at: string
}

export interface DayTotals {
  date: string
  fiberG: number
  proteinG: number
  carbG: number
  caloriesKcal: number
  entries: FoodLogEntry[]
}

function startOfDaysAgo(daysAgo: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

// Local calendar date, not UTC — Date#toISOString() converts to UTC first,
// which silently shifts the date backward a day for any timezone ahead of
// UTC (confirmed: a meal logged "today" was filed under yesterday). Reading
// the local getters directly avoids that entirely.
function localDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function useFoodLogHistory(memberId: string | undefined) {
  const query = useQuery({
    queryKey: ["food_log_history", memberId],
    queryFn: async () => {
      if (!supabase || !memberId) return []
      const { data, error } = await supabase
        .from("food_logs")
        .select("id, name, portion, fiber_g, protein_g, carb_g, fat_g, calories_kcal, logged_at")
        .eq("member_id", memberId)
        .gte("logged_at", startOfDaysAgo(HISTORY_DAYS - 1).toISOString())
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data as FoodLogEntry[]
    },
    enabled: !!memberId && !!supabase,
  })

  const rows = query.data ?? []

  // A fixed run of HISTORY_DAYS calendar days (oldest to today), including
  // days with no logs, so the chart always shows a consistent, honest
  // timeline rather than just the days that happen to have entries.
  const days: DayTotals[] = []
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = localDateKey(startOfDaysAgo(i))
    days.push({ date, fiberG: 0, proteinG: 0, carbG: 0, caloriesKcal: 0, entries: [] })
  }
  const byDate = new Map(days.map((d) => [d.date, d]))
  for (const row of rows) {
    const bucket = byDate.get(localDateKey(new Date(row.logged_at)))
    if (!bucket) continue
    bucket.fiberG += Number(row.fiber_g)
    bucket.proteinG += Number(row.protein_g)
    bucket.carbG += Number(row.carb_g)
    bucket.caloriesKcal += Number(row.calories_kcal ?? 0)
    bucket.entries.push(row)
  }

  return {
    days,
    isLoading: query.isLoading,
  }
}
