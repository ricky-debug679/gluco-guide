import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import type { User } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"

export interface MemberRow {
  id: string
  household_id: string
  auth_user_id: string | null
  display_name: string
  relationship: "self" | "family"
  goal: string | null
  avatar_color: string
}

export interface HouseholdData {
  householdId: string
  selfMember: MemberRow
  members: MemberRow[]
}

async function bootstrapHousehold(user: User): Promise<HouseholdData> {
  if (!supabase) throw new Error("Supabase is not configured")

  // Plain upsert (merge, not ignore-duplicates): on a repeat call — every
  // reload — this hits the existing row and still returns it. With
  // ignoreDuplicates it does NOT return the row on conflict, which silently
  // broke this on every reload; caught that with a direct debug script
  // before it shipped.
  const { data: household, error: householdError } = await supabase
    .from("households")
    .upsert({ owner_user_id: user.id }, { onConflict: "owner_user_id" })
    .select()
    .single()
  if (householdError) throw householdError

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("*")
    .eq("household_id", household.id)
    .order("created_at", { ascending: true })
  if (membersError) throw membersError

  let selfMember = members.find((m) => m.auth_user_id === user.id)

  if (!selfMember) {
    // First time this user has ever loaded the app — create their own
    // member row. A plain insert, not upsert: we already confirmed above
    // that no row exists, and the unique constraint is the safety net
    // against a race, so this never silently overwrites a display name
    // someone customized later.
    const displayName = user.email?.split("@")[0] ?? "You"
    const { data: inserted, error: insertError } = await supabase
      .from("members")
      .insert({
        household_id: household.id,
        auth_user_id: user.id,
        display_name: displayName,
        relationship: "self",
        avatar_color: "sage",
      })
      .select()
      .single()
    if (insertError) throw insertError
    selfMember = inserted
    members.push(inserted)
  }

  return { householdId: household.id, selfMember, members }
}

export function useHousehold(user: User | null) {
  return useQuery({
    queryKey: ["household", user?.id],
    queryFn: () => bootstrapHousehold(user!),
    enabled: !!user && !!supabase,
    staleTime: 60_000,
  })
}

export function useAddFamilyMember(householdId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { displayName: string; goal: string }) => {
      if (!supabase || !householdId) throw new Error("No household yet")
      const { error } = await supabase.from("members").insert({
        household_id: householdId,
        display_name: input.displayName,
        goal: input.goal,
        relationship: "family",
        avatar_color: "honey",
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["household"] }),
  })
}
