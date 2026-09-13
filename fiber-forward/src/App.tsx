import { Navigate, Route, Routes } from "react-router-dom"
import { Onboarding } from "./pages/Onboarding"
import { Home } from "./pages/Home"
import { FoodLog } from "./pages/FoodLog"
import { GroceryScan } from "./pages/GroceryScan"
import { LabTrends } from "./pages/LabTrends"
import { Hydration } from "./pages/Hydration"
import { Family } from "./pages/Family"
import { You } from "./pages/You"
import { useAppStore } from "./store/useAppStore"

export function App() {
  const onboardingDone = useAppStore((s) => s.onboarding.done)

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/" element={onboardingDone ? <Home /> : <Navigate to="/onboarding" replace />} />
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
