import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import type { GroceryResult } from "../lib/openFoodFacts"

export function useLogGroceryScan(memberId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: GroceryResult) => {
      if (!supabase || !memberId) return
      const { error } = await supabase.from("grocery_scans").insert({
        member_id: memberId,
        barcode: item.id,
        brand: item.brand || null,
        product_name: item.name,
        fiber_g: item.fiberG,
        protein_g: item.proteinG,
        net_carb_g: item.netCarbG,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grocery_scans", memberId] }),
  })
}
