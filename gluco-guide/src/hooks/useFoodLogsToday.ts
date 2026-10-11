import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import type { FoodItem } from "../lib/types"
import { round1 } from "../lib/format"

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useFoodLogsToday(memberId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["food_logs", memberId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase || !memberId) return []
      const { data, error } = await supabase
        .from("food_logs")
        .select("id, name, portion, fiber_g, protein_g, carb_g, fat_g, calories_kcal, source, logged_at")
        .eq("member_id", memberId)
        .gte("logged_at", startOfTodayIso())
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!memberId && !!supabase,
  })

  const addFood = useMutation({
    mutationFn: async (input: { food: FoodItem; source: "photo" | "search" | "manual" }) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("food_logs").insert({
        member_id: memberId,
        name: input.food.name,
        portion: input.food.portion,
        fiber_g: input.food.fiberG,
        protein_g: input.food.proteinG,
        carb_g: input.food.carbG,
        fat_g: input.food.fatG,
        calories_kcal: input.food.caloriesKcal,
        source: input.source,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const removeFood = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return
      const { error } = await supabase.from("food_logs").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const rows = query.data ?? []
  const sums = rows.reduce(
    (acc, r) => ({
      fiberG: acc.fiberG + Number(r.fiber_g),
      proteinG: acc.proteinG + Number(r.protein_g),
      carbG: acc.carbG + Number(r.carb_g),
      fatG: acc.fatG + Number(r.fat_g ?? 0),
      caloriesKcal: acc.caloriesKcal + Number(r.calories_kcal ?? 0),
    }),
    { fiberG: 0, proteinG: 0, carbG: 0, fatG: 0, caloriesKcal: 0 },
  )
  const totals = {
    fiberG: round1(sums.fiberG),
    proteinG: round1(sums.proteinG),
    carbG: round1(sums.carbG),
    fatG: round1(sums.fatG),
    caloriesKcal: round1(sums.caloriesKcal),
  }

  return {
    todaysFoods: rows,
    totals,
    isLoading: query.isLoading,
    addFood: (food: FoodItem, source: "photo" | "search" | "manual") => addFood.mutateAsync({ food, source }),
    removeFood: (id: string) => removeFood.mutateAsync(id),
  }
}
