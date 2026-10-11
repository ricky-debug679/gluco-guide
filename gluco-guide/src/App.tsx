import { Navigate, Route, Routes } from "react-router-dom"
import { Onboarding } from "./pages/Onboarding"
import { Home } from "./pages/Home"
import { FoodLog } from "./pages/FoodLog"
import { FoodLogHistory } from "./pages/FoodLogHistory"
import { GroceryScan } from "./pages/GroceryScan"
import { LabTrends } from "./pages/LabTrends"
import { Hydration } from "./pages/Hydration"
import { Exercise } from "./pages/Exercise"
import { Wellness } from "./pages/Wellness"
import { Supplements } from "./pages/Supplements"
import { Profile } from "./pages/Profile"
import { Auth } from "./pages/Auth"
import { useAppStore } from "./store/useAppStore"
import { useSession } from "./hooks/useSession"
import { HouseholdProvider, useOptionalHousehold } from "./context/HouseholdContext"
import { supabase } from "./lib/supabase"

// isLive = true whenever a real signed-in household exists. In that case
// onboarding is gated on the real profile actually being complete (height
// set on the member row), proven by Supabase rather than in-memory UI
// state, so it never re-traps a returning user who already finished it.
// The demo-data fallback (no backend configured) still gates on the
// in-memory onboarding flag, since there's nothing else to check it
// against.
function AppRoutes({ isLive }: { isLive: boolean }) {
  const onboardingDone = useAppStore((s) => s.onboarding.done)
  const householdCtx = useOptionalHousehold()
  const profileIncomplete = isLive && !!householdCtx && !householdCtx.household.selfMember.height_cm
  const showOnboardingGate = isLive ? profileIncomplete : !onboardingDone

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/" element={showOnboardingGate ? <Navigate to="/onboarding" replace /> : <Home />} />
      <Route path="/log" element={<FoodLog />} />
      <Route path="/log-history" element={<FoodLogHistory />} />
      <Route path="/scan" element={<GroceryScan />} />
      <Route path="/trends" element={<LabTrends />} />
      <Route path="/hydration" element={<Hydration />} />
      <Route path="/exercise" element={<Exercise />} />
      <Route path="/wellness" element={<Wellness />} />
      <Route path="/supplements" element={<Supplements />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  const { session, loading } = useSession()

  // No backend configured yet (e.g. running before .env.local is set) —
  // fall back to the demo-data experience rather than blocking on auth.
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
