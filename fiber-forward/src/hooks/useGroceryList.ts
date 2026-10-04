import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"

export interface GroceryListItem {
  id: string
  name: string
  checked: boolean
  created_at: string
}

export interface ItemFlag {
  name: string
  verdict: "caution" | "good"
  note: string
}

export interface CombinationTip {
  items: string[]
  message: string
}

export interface GroceryListAnalysis {
  itemFlags: ItemFlag[]
  combinationTips: CombinationTip[]
}

export function useGroceryList(householdId: string | undefined, memberId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["grocery_list_items", householdId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase || !householdId) return [] as GroceryListItem[]
      const { data, error } = await supabase
        .from("grocery_list_items")
        .select("id, name, checked, created_at")
        .eq("household_id", householdId)
        .order("created_at", { ascending: true })
      if (error) throw error
      return data as GroceryListItem[]
    },
    enabled: !!householdId && !!supabase,
  })

  const addItem = useMutation({
    mutationFn: async (name: string) => {
      if (!supabase || !householdId) return
      const { error } = await supabase.from("grocery_list_items").insert({
        household_id: householdId,
        name,
        added_by_member_id: memberId ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const toggleChecked = useMutation({
    mutationFn: async (input: { id: string; checked: boolean }) => {
      if (!supabase) return
      const { error } = await supabase
        .from("grocery_list_items")
        .update({ checked: input.checked })
        .eq("id", input.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return
      const { error } = await supabase.from("grocery_list_items").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const analyze = useMutation({
    mutationFn: async (items: string[]) => {
      if (!supabase) throw new Error("Not configured")
      const { data, error } = await supabase.functions.invoke("analyze-grocery-list", {
        body: { items },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as GroceryListAnalysis
    },
  })

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    addItem: (name: string) => addItem.mutateAsync(name),
    toggleChecked: (id: string, checked: boolean) => toggleChecked.mutateAsync({ id, checked }),
    removeItem: (id: string) => removeItem.mutateAsync(id),
    analyze: (items: string[]) => analyze.mutateAsync(items),
    analyzing: analyze.isPending,
  }
}
