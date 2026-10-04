import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"

export interface GroceryListItem {
  id: string
  name: string
  checked: boolean
  verdict: "good" | "caution" | null
  note: string | null
}

export interface GroceryListSummary {
  id: string
  label: string | null
  created_at: string
  items: GroceryListItem[]
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

function matchesFlag(itemName: string, flagName: string) {
  const a = itemName.toLowerCase()
  const b = flagName.toLowerCase()
  return a.includes(b) || b.includes(a)
}

/** All of a household's grocery trips, newest first. lists[0] is "today's" active list. */
export function useGroceryLists(householdId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["grocery_lists", householdId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase || !householdId) return [] as GroceryListSummary[]
      const { data, error } = await supabase
        .from("grocery_lists")
        .select("id, label, created_at, grocery_list_items(id, name, checked, verdict, note)")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data as (GroceryListSummary & { grocery_list_items: GroceryListItem[] })[]).map((l) => ({
        id: l.id,
        label: l.label,
        created_at: l.created_at,
        items: l.grocery_list_items,
      }))
    },
    enabled: !!householdId && !!supabase,
  })

  const createList = useMutation({
    mutationFn: async (label?: string) => {
      if (!supabase || !householdId) return null
      const { data, error } = await supabase
        .from("grocery_lists")
        .insert({ household_id: householdId, label: label ?? null })
        .select("id")
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const lists = query.data ?? []

  return {
    lists,
    activeList: lists[0] ?? null,
    isLoading: query.isLoading,
    createList: (label?: string) => createList.mutateAsync(label),
  }
}

export function useGroceryListItems(householdId: string | undefined) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["grocery_lists", householdId] })

  const addItem = useMutation({
    mutationFn: async (input: { listId: string; name: string }) => {
      if (!supabase) return
      const { error } = await supabase.from("grocery_list_items").insert({ list_id: input.listId, name: input.name })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const addManyItems = useMutation({
    mutationFn: async (input: { listId: string; names: string[] }) => {
      if (!supabase || input.names.length === 0) return
      const { error } = await supabase
        .from("grocery_list_items")
        .insert(input.names.map((name) => ({ list_id: input.listId, name })))
      if (error) throw error
    },
    onSuccess: invalidate,
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
    onSuccess: invalidate,
  })

  const removeMany = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!supabase || ids.length === 0) return
      const { error } = await supabase.from("grocery_list_items").delete().in("id", ids)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const saveVerdicts = useMutation({
    mutationFn: async (input: { items: GroceryListItem[]; flags: ItemFlag[] }) => {
      if (!supabase) return
      const updates = input.items
        .map((item) => ({ item, flag: input.flags.find((f) => matchesFlag(item.name, f.name)) }))
        .filter((x): x is { item: GroceryListItem; flag: ItemFlag } => !!x.flag)
      await Promise.all(
        updates.map(({ item, flag }) =>
          supabase!.from("grocery_list_items").update({ verdict: flag.verdict, note: flag.note }).eq("id", item.id),
        ),
      )
    },
    onSuccess: invalidate,
  })

  const analyze = useMutation({
    mutationFn: async (items: string[]) => {
      if (!supabase) throw new Error("Not configured")
      const { data, error } = await supabase.functions.invoke("analyze-grocery-list", { body: { items } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as GroceryListAnalysis
    },
  })

  return {
    addItem: (listId: string, name: string) => addItem.mutateAsync({ listId, name }),
    addManyItems: (listId: string, names: string[]) => addManyItems.mutateAsync({ listId, names }),
    toggleChecked: (id: string, checked: boolean) => toggleChecked.mutateAsync({ id, checked }),
    removeMany: (ids: string[]) => removeMany.mutateAsync(ids),
    saveVerdicts: (items: GroceryListItem[], flags: ItemFlag[]) => saveVerdicts.mutateAsync({ items, flags }),
    analyze: (items: string[]) => analyze.mutateAsync(items),
    analyzing: analyze.isPending,
  }
}

export interface GroceryFavorite {
  id: string
  name: string
}

export function useGroceryFavorites(householdId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ["grocery_favorites", householdId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!supabase || !householdId) return [] as GroceryFavorite[]
      const { data, error } = await supabase
        .from("grocery_favorites")
        .select("id, name")
        .eq("household_id", householdId)
        .order("name", { ascending: true })
      if (error) throw error
      return data as GroceryFavorite[]
    },
    enabled: !!householdId && !!supabase,
  })

  const addFavorite = useMutation({
    mutationFn: async (name: string) => {
      if (!supabase || !householdId) return
      const { error } = await supabase
        .from("grocery_favorites")
        .upsert({ household_id: householdId, name }, { onConflict: "household_id,name" })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const removeFavorite = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return
      const { error } = await supabase.from("grocery_favorites").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    favorites: query.data ?? [],
    isLoading: query.isLoading,
    addFavorite: (name: string) => addFavorite.mutateAsync(name),
    removeFavorite: (id: string) => removeFavorite.mutateAsync(id),
  }
}
