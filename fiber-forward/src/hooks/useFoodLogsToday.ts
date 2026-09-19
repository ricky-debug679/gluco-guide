import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import type { FoodItem } from "../lib/types"

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
        .select("id, name, portion, fiber_g, protein_g, carb_g, source, logged_at")
        .eq("member_id", memberId)
        .gte("logged_at", startOfTodayIso())
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!memberId && !!supabase,
  })

  const addFood = useMutation({
    mutationFn: async (input: { food: FoodItem; source: "photo" | "search" }) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("food_logs").insert({
        member_id: memberId,
        name: input.food.name,
        portion: input.food.portion,
        fiber_g: input.food.fiberG,
        protein_g: input.food.proteinG,
        carb_g: input.food.carbG,
        source: input.source,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const rows = query.data ?? []
  const totals = rows.reduce(
    (acc, r) => ({
      fiberG: acc.fiberG + Number(r.fiber_g),
      proteinG: acc.proteinG + Number(r.protein_g),
      carbG: acc.carbG + Number(r.carb_g),
    }),
    { fiberG: 0, proteinG: 0, carbG: 0 },
  )

  return {
    todaysFoods: rows,
    totals,
    isLoading: query.isLoading,
    addFood: (food: FoodItem, source: "photo" | "search") => addFood.mutateAsync({ food, source }),
  }
}
