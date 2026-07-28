import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter } from "react-router"
import { RouterProvider } from "react-router/dom"

import "./index.css"
import { appRoutes } from "@/router/routes"
import { ThemeProvider } from "@/components/shared/theme-provider.tsx"
import { LanguageProvider } from "@/components/shared/language-provider.tsx"
import { isAutoMode } from "@/testing/auto-harness"

function renderApp() {
  // Created inside renderApp (not at module scope): the data router starts
  // running route loaders immediately, which must not happen before the auto
  // harness has seeded the database.
  const router = createBrowserRouter(appRoutes)

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <LanguageProvider>
          <RouterProvider router={router} />
        </LanguageProvider>
      </ThemeProvider>
    </StrictMode>
  )
}

// In `?auto` mode, seed a deterministic test environment BEFORE the app mounts
// (so bootstrap sees the seeded data), then render. Normal loads render at once.
if (isAutoMode()) {
  void import("@/testing/auto-harness").then(({ runAutoHarness }) =>
    runAutoHarness().finally(renderApp)
  )
} else {
  renderApp()
}
