import { createContext, useContext, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { User } from "@supabase/supabase-js"
import { useHousehold, type HouseholdData } from "../hooks/useHousehold"

interface HouseholdContextValue {
  user: User
  household: HouseholdData
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({ user, children }: { user: User; children: ReactNode }) {
  const { t } = useTranslation()
  const { data, isLoading, isError, error } = useHousehold(user)

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[color:var(--color-bg)] text-[color:var(--color-ink-soft)]">
        {t("common.loading")}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-2 bg-[color:var(--color-bg)] p-6 text-center text-[color:var(--color-ink-soft)]">
        <div>{t("common.accountLoadError")}</div>
        {error instanceof Error && <div className="text-[0.78rem] text-[color:var(--color-ink-faint)]">{error.message}</div>}
      </div>
    )
  }

  return <HouseholdContext.Provider value={{ user, household: data }}>{children}</HouseholdContext.Provider>
}

/** Returns null when there's no real backend/session — callers fall back to demo data. */
export function useOptionalHousehold() {
  return useContext(HouseholdContext)
}
