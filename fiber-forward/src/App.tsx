import { Navigate, Route, Routes } from "react-router-dom"
import { Onboarding } from "./pages/Onboarding"
import { Home } from "./pages/Home"
import { FoodLog } from "./pages/FoodLog"
import { GroceryScan } from "./pages/GroceryScan"
import { LabTrends } from "./pages/LabTrends"
import { Hydration } from "./pages/Hydration"
import { Family } from "./pages/Family"
import { You } from "./pages/You"
import { Auth } from "./pages/Auth"
import { useAppStore } from "./store/useAppStore"
import { useSession } from "./hooks/useSession"
import { HouseholdProvider } from "./context/HouseholdContext"
import { supabase } from "./lib/supabase"

// isLive = true whenever a real signed-in household exists. In that case
// onboarding is a one-time flow gated by the household itself already
// existing (proven by Supabase, not by in-memory UI state), so it never
// re-traps a returning real user. The mock-data fallback (no backend
// configured) still gates on the in-memory onboarding flag, since there's
// nothing else to check it against.
function AppRoutes({ isLive }: { isLive: boolean }) {
  const onboardingDone = useAppStore((s) => s.onboarding.done)
  const showOnboardingGate = !isLive && !onboardingDone

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/" element={showOnboardingGate ? <Navigate to="/onboarding" replace /> : <Home />} />
      <Route path="/log" element={<FoodLog />} />
      <Route path="/scan" element={<GroceryScan />} />
      <Route path="/trends" element={<LabTrends />} />
      <Route path="/hydration" element={<Hydration />} />
      <Route path="/family" element={<Family />} />
      <Route path="/you" element={<You />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  const { session, loading } = useSession()

  // No backend configured yet (e.g. running before .env.local is set) —
  // fall back to the mock-data experience rather than blocking on auth.
  if (!supabase) return <AppRoutes isLive={false} />

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[color:var(--color-bg)] text-[color:var(--color-ink-soft)]">
        Loading…
      </div>
    )
  }

  if (!session) return <Auth />

  return (
    <HouseholdProvider user={session.user}>
      <AppRoutes isLive />
    </HouseholdProvider>
  )
}
