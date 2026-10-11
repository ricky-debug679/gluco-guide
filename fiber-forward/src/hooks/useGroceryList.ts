import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { supabase } from "../lib/supabase"
import { describeFunctionError } from "../lib/edgeFunctionError"

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
        .select("id, label, created_at")
        .single()
      if (error) throw error
      return data as { id: string; label: string | null; created_at: string }
    },
    // Prepend directly rather than invalidate+refetch — under real network
    // latency (e.g. a phone on a slow connection), a slightly-earlier
    // refetch can resolve after a later one and clobber it. Writing the
    // known-good result straight into the cache sidesteps that race
    // entirely instead of hoping requests resolve in order.
    onSuccess: (newList) => {
      if (!newList) return
      queryClient.setQueryData<GroceryListSummary[]>(queryKey, (old) => [{ ...newList, items: [] }, ...(old ?? [])])
    },
  })

  const lists = query.data ?? []

  return {
    lists,
    activeList: lists[0] ?? null,
    isLoading: query.isLoading,
    createList: (label?: string) => createList.mutateAsync(label).then((l) => l?.id ?? null),
  }
}

export function useGroceryListItems(householdId: string | undefined) {
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()
  const queryKey = ["grocery_lists", householdId]

  // All mutations below write their own known-good result straight into the
  // query cache instead of invalidate+refetch. Under real network latency
  // (a phone on a slow connection, not just a fast local dev server), two
  // refetches triggered back-to-back can resolve out of order and the
  // earlier one — now stale — overwrites the later, correct one, silently
  // dropping whichever item was added in between. Writing directly avoids
  // that race instead of relying on responses to arrive in order.
  function patchList(listId: string, update: (items: GroceryListItem[]) => GroceryListItem[]) {
    queryClient.setQueryData<GroceryListSummary[]>(queryKey, (old) =>
      (old ?? []).map((l) => (l.id === listId ? { ...l, items: update(l.items) } : l)),
    )
  }

  const addItem = useMutation({
    mutationFn: async (input: { listId: string; name: string }) => {
      if (!supabase || !householdId) return null
      const { data, error } = await supabase
        .from("grocery_list_items")
        .insert({ list_id: input.listId, household_id: householdId, name: input.name })
        .select("id, name, checked, verdict, note")
        .single()
      if (error) throw error
      return { listId: input.listId, item: data as GroceryListItem }
    },
    onSuccess: (result) => {
      if (!result) return
      patchList(result.listId, (items) => [...items, result.item])
    },
  })

  const addManyItems = useMutation({
    mutationFn: async (input: { listId: string; names: string[] }) => {
      if (!supabase || !householdId || input.names.length === 0) return null
      const { data, error } = await supabase
        .from("grocery_list_items")
        .insert(input.names.map((name) => ({ list_id: input.listId, household_id: householdId, name })))
        .select("id, name, checked, verdict, note")
      if (error) throw error
      return { listId: input.listId, items: data as GroceryListItem[] }
    },
    onSuccess: (result) => {
      if (!result) return
      patchList(result.listId, (items) => [...items, ...result.items])
    },
  })

  // Used by photo scanning, which already gets a verdict+note per item from
  // the same AI call that identified it — carries that straight onto the
  // new rows instead of leaving them unanalyzed until a separate "Analyze
  // my list" pass. "neutral" verdicts (no strong signal) are stored as no
  // flag at all, same as analyze-grocery-list already does.
  const addManyItemsWithVerdicts = useMutation({
    mutationFn: async (input: {
      listId: string
      items: { name: string; verdict: "good" | "caution" | "neutral"; note: string }[]
    }) => {
      if (!supabase || !householdId || input.items.length === 0) return null
      const { data, error } = await supabase
        .from("grocery_list_items")
        .insert(
          input.items.map((i) => ({
            list_id: input.listId,
            household_id: householdId,
            name: i.name,
            verdict: i.verdict === "neutral" ? null : i.verdict,
            note: i.verdict === "neutral" ? null : i.note,
          })),
        )
        .select("id, name, checked, verdict, note")
      if (error) throw error
      return { listId: input.listId, items: data as GroceryListItem[] }
    },
    onSuccess: (result) => {
      if (!result) return
      patchList(result.listId, (items) => [...items, ...result.items])
    },
  })

  const toggleChecked = useMutation({
    mutationFn: async (input: { listId: string; id: string; checked: boolean }) => {
      if (!supabase) return null
      const { error } = await supabase
        .from("grocery_list_items")
        .update({ checked: input.checked })
        .eq("id", input.id)
      if (error) throw error
      return input
    },
    onSuccess: (result) => {
      if (!result) return
      patchList(result.listId, (items) =>
        items.map((i) => (i.id === result.id ? { ...i, checked: result.checked } : i)),
      )
    },
  })

  const removeMany = useMutation({
    mutationFn: async (input: { listId: string; ids: string[] }) => {
      if (!supabase || input.ids.length === 0) return null
      const { error } = await supabase.from("grocery_list_items").delete().in("id", input.ids)
      if (error) throw error
      return input
    },
    onSuccess: (result) => {
      if (!result) return
      patchList(result.listId, (items) => items.filter((i) => !result.ids.includes(i.id)))
    },
  })

  const saveVerdicts = useMutation({
    mutationFn: async (input: { listId: string; items: GroceryListItem[]; flags: ItemFlag[] }) => {
      if (!supabase) return null
      const updates = input.items
        .map((item) => ({ item, flag: input.flags.find((f) => matchesFlag(item.name, f.name)) }))
        .filter((x): x is { item: GroceryListItem; flag: ItemFlag } => !!x.flag)
      await Promise.all(
        updates.map(({ item, flag }) =>
          supabase!.from("grocery_list_items").update({ verdict: flag.verdict, note: flag.note }).eq("id", item.id),
        ),
      )
      return { listId: input.listId, updates }
    },
    onSuccess: (result) => {
      if (!result) return
      patchList(result.listId, (items) =>
        items.map((i) => {
          const u = result.updates.find((u) => u.item.id === i.id)
          return u ? { ...i, verdict: u.flag.verdict, note: u.flag.note } : i
        }),
      )
    },
  })

  const analyze = useMutation({
    mutationFn: async (items: string[]) => {
      if (!supabase) throw new Error("Not configured")
      const { data, error } = await supabase.functions.invoke("analyze-grocery-list", {
        body: { items, language: i18n.language },
      })
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      return data as GroceryListAnalysis
    },
  })

  return {
    addItem: (listId: string, name: string) => addItem.mutateAsync({ listId, name }),
    addManyItems: (listId: string, names: string[]) => addManyItems.mutateAsync({ listId, names }),
    addManyItemsWithVerdicts: (
      listId: string,
      items: { name: string; verdict: "good" | "caution" | "neutral"; note: string }[],
    ) => addManyItemsWithVerdicts.mutateAsync({ listId, items }),
    toggleChecked: (listId: string, id: string, checked: boolean) =>
      toggleChecked.mutateAsync({ listId, id, checked }),
    removeMany: (listId: string, ids: string[]) => removeMany.mutateAsync({ listId, ids }),
    saveVerdicts: (listId: string, items: GroceryListItem[], flags: ItemFlag[]) =>
      saveVerdicts.mutateAsync({ listId, items, flags }),
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
      if (!supabase || !householdId) return null
      const { data, error } = await supabase
        .from("grocery_favorites")
        .upsert({ household_id: householdId, name }, { onConflict: "household_id,name" })
        .select("id, name")
        .single()
      if (error) throw error
      return data as GroceryFavorite
    },
    onSuccess: (newFavorite) => {
      if (!newFavorite) return
      queryClient.setQueryData<GroceryFavorite[]>(queryKey, (old) =>
        [...(old ?? []).filter((f) => f.id !== newFavorite.id), newFavorite].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      )
    },
  })

  const removeFavorite = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return null
      const { error } = await supabase.from("grocery_favorites").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: (removedId) => {
      if (!removedId) return
      queryClient.setQueryData<GroceryFavorite[]>(queryKey, (old) => (old ?? []).filter((f) => f.id !== removedId))
    },
  })

  return {
    favorites: query.data ?? [],
    isLoading: query.isLoading,
    addFavorite: (name: string) => addFavorite.mutateAsync(name),
    removeFavorite: (id: string) => removeFavorite.mutateAsync(id),
  }
}
