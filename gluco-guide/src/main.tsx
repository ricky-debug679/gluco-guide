import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { registerSW } from "virtual:pwa-register"
import "./index.css"
import "./lib/i18n"
import { App } from "./App.tsx"

// The cached app keeps running until reloaded, so reload into a new
// version as soon as it's installed, and look for one whenever the app
// comes back to the foreground.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update()
    })
  },
})

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
