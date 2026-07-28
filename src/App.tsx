import { useEffect } from "react"
import {
  isRouteErrorResponse,
  Outlet,
  useLocation,
  useRouteError,
} from "react-router"
import { Toaster } from "sonner"
import { useAppStore, ensureRuntimeFresh } from "@/store/app-store"
import { useNavigationStore } from "@/store/navigation-store"
import { msUntilMidnight } from "@/utils/date"
import { useLanguage } from "@/components/shared/language-provider"
import { BootSplash } from "@/components/shared/BootSplash"
import { useSyncStore } from "@/store/sync-store"
import {
  SYNC_REFRESH_TOKEN_STORAGE_KEY,
  isRefreshTokenRotation,
} from "@/services/sync/sync-auth-storage"
import { ScrollToHash } from "@/hooks/use-scroll-to-hash"

// On tab re-focus a sync fires immediately, skipped when the last sync was within
// this window so rapid tab switches don't spam requests (the periodic timer covers the gap).
const VISIBILITY_SYNC_THROTTLE_MS = 10_000

/**
 * App-level chrome and effects, shared by every route (see src/routes.tsx for
 * the route table). The old App component's boot gate is gone: routes that
 * need boot data declare it via loaders, and the router shows
 * `RootHydrateFallback` (initial load) or keeps the previous page
 * (navigations) while they resolve.
 */
export function AppRoot() {
  const bootStatus = useAppStore((s) => s.bootStatus)
  const location = useLocation()
  const pushLocation = useNavigationStore((s) => s.pushLocation)
  const syncManager = useSyncStore((s) => s.syncManager)
  const refreshSelectedProvider = useSyncStore((s) => s.refreshSelectedProvider)

  // ── App-internal navigation stack (back/forward buttons) ──
  useEffect(() => {
    const fullPath = location.pathname + location.search + location.hash
    pushLocation(fullPath)
  }, [location, pushLocation])

  // ── Runtime expiration: midnight timer + visibility/focus ──
  // Gated on bootStatus so a doc-only tab (which never bootstraps) stays inert.
  useEffect(() => {
    if (bootStatus !== "ready") return

    // Schedule sweep at next midnight, then re-schedule
    let timerId: ReturnType<typeof setTimeout>
    function scheduleMidnight() {
      timerId = setTimeout(() => {
        ensureRuntimeFresh()
        scheduleMidnight()
      }, msUntilMidnight())
    }
    scheduleMidnight()

    // Also ensure fresh runtime
    // when user returns to the app after a long time
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        ensureRuntimeFresh()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("focus", ensureRuntimeFresh)

    return () => {
      clearTimeout(timerId)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("focus", ensureRuntimeFresh)
    }
  }, [bootStatus])

  // ── Sync auth storage changes from other windows ──
  useEffect(() => {
    if (bootStatus !== "ready") return

    const handleStorage = (event: StorageEvent) => {
      if (
        event.storageArea !== window.localStorage ||
        event.key !== SYNC_REFRESH_TOKEN_STORAGE_KEY
      ) {
        return
      }

      // OneDrive rotates the refresh token on every refresh, rewriting this
      // key ~hourly per window. Rebuilding the manager for those writes is
      // churn; the provider re-reads the rotated token inside its refresh
      // lock. Only binding changes (connect/disconnect/provider switch) need
      // a rebuild.
      if (isRefreshTokenRotation(event.oldValue, event.newValue)) {
        return
      }

      refreshSelectedProvider()
    }

    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
    }
  }, [bootStatus, refreshSelectedProvider])

  // ── Sync lifecycle: visibility-driven auto-sync ──
  useEffect(() => {
    // Auto-sync is always on when a connected manager is available.
    if (bootStatus !== "ready" || !syncManager) return
    if (syncManager.getConnectionStatus() !== "connected") return

    let isActive = true

    // Immediate sync on re-focus, throttled so rapid tab switches don't spam.
    const maybeSyncNow = () => {
      const lastSyncedAt = useSyncStore.getState().lastSyncedAt
      const elapsed = lastSyncedAt
        ? Date.now() - new Date(lastSyncedAt).getTime()
        : Infinity
      if (elapsed >= VISIBILITY_SYNC_THROTTLE_MS) {
        void syncManager.syncNow()
      }
    }

    // Poll only while the tab is visible; a hidden tab pauses the periodic timer
    // so background tabs make no requests, and re-focus pulls the latest at once.
    const resume = () => {
      void (async () => {
        await syncManager.start() // idempotent; (re)starts the periodic timer
        if (isActive) maybeSyncNow()
      })()
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") resume()
      else void syncManager.stop()
    }

    document.addEventListener("visibilitychange", handleVisibility)
    if (document.visibilityState === "visible") resume()

    return () => {
      isActive = false
      document.removeEventListener("visibilitychange", handleVisibility)
      void syncManager.stop()
    }
  }, [bootStatus, syncManager])

  return (
    <>
      <Toaster position="top-right" richColors />
      <ScrollToHash />
      <Outlet />
    </>
  )
}

/** Initial-hydration screen: shown while route loaders (i.e. boot) run. */
export function RootHydrateFallback() {
  const bootStatus = useAppStore((s) => s.bootStatus)
  const { t } = useLanguage()
  return (
    <BootSplash
      statusText={
        bootStatus === "syncing" ? t.sync.syncingNow : t.common.loading
      }
    />
  )
}

/** Root error screen: boot failures and unhandled route errors land here. */
export function RootErrorBoundary() {
  const error = useRouteError()
  const { t } = useLanguage()

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error)

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-destructive">
        {t.app.loadError} {message}
      </p>
    </div>
  )
}
