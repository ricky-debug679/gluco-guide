import { createContext, useContext, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"
import { useHousehold, type HouseholdData } from "../hooks/useHousehold"

interface HouseholdContextValue {
  user: User
  household: HouseholdData
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({ user, children }: { user: User; children: ReactNode }) {
  const { data, isLoading, isError, error } = useHousehold(user)

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[color:var(--color-bg)] text-[color:var(--color-ink-soft)]">
        Setting up your household…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[color:var(--color-bg)] p-6 text-center text-[color:var(--color-ink-soft)]">
        Couldn't set up your household: {error instanceof Error ? error.message : "unknown error"}
      </div>
    )
  }

  return <HouseholdContext.Provider value={{ user, household: data }}>{children}</HouseholdContext.Provider>
}

/** Returns null when there's no real backend/session — callers fall back to mock data. */
export function useOptionalHousehold() {
  return useContext(HouseholdContext)
}
