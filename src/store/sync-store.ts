import type {
  SyncManager,
  SyncManagerDelegate,
} from "@/services/sync/sync-manager"
import type { SyncProvider } from "@/services/sync/sync-provider"
import type {
  SyncProviderKind,
  SyncStatus,
} from "@/services/sync/types"
import type {
  SyncPanelErrorCode,
  SyncPanelStatus,
} from "@/services/sync/sync-panel-types"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { StateCreator } from "zustand"
import { createSyncManager } from "@/services/sync/create-sync-manager"
import { GoogleDriveProvider } from "@/services/sync/provider/google-provider/google-drive-provider"
import { OneDriveProvider } from "@/services/sync/provider/onedrive-provider/onedrive-provider"
import { setNotifyHandler } from "@/services/sync/sync-broadcast"

const LOCAL_CHANGE_SYNC_DELAY_MS = 800

let localChangeSyncTimer: ReturnType<typeof setTimeout> | null = null
let localChangeSyncInFlight = false
let localChangeSyncPending = false

// ── State ───────────────────────────────────────────────

interface SyncState {
  syncManager: SyncManager | null
  syncProviderKind: SyncProviderKind | null
  syncStatus: SyncStatus | null
  /** Reason of the last failed sync (raw message), null after a success. */
  lastSyncError: string | null
  lastSyncedAt: string | null
  lastKnownHashData: string | null
  panelStatus: SyncPanelStatus | null
  panelErrorCode: SyncPanelErrorCode | null
}
// ── Actions ───────────────────────────────────────────────
interface SyncActions {
  setManager: (manager: SyncManager | null) => void
  setSyncStatus: (status: SyncStatus) => void
  setSyncProviderKind: (providerKind: SyncProviderKind | null) => void
  setLastSyncedAt: (timestamp: string | null) => void
  setLastKnownHashData: (dataHash: string | null) => void
  selectSyncProvider: (providerKind: SyncProviderKind | null) => void
  refreshSelectedProvider: () => void
  scheduleSyncAfterLocalChange: () => void
}

type SyncStore = SyncState & SyncActions
// ── Zustand  creator ─────────────────────────────────
const createSyncStore: StateCreator<SyncStore, [], [], SyncStore> = (set) => ({
  syncManager: null,
  syncProviderKind: null,
  syncStatus: null,
  lastSyncError: null,
  lastSyncedAt: null,
  lastKnownHashData: null,
  panelStatus: null,
  panelErrorCode: null,
  setManager: (manager) => set({ syncManager: manager }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setSyncProviderKind: (providerKind) =>
    set({ syncProviderKind: providerKind }),
  setLastSyncedAt: (timestamp) => set({ lastSyncedAt: timestamp }),
  setLastKnownHashData: (dataHash) => set({ lastKnownHashData: dataHash }),
  scheduleSyncAfterLocalChange: () => {
    scheduleSyncAfterLocalChange()
  },
  selectSyncProvider: (providerKind) => {
    if (providerKind === null) {
      set({
        syncManager: null,
        syncProviderKind: null,
        syncStatus: null,
        lastSyncedAt: null,
        lastKnownHashData: null,
        panelStatus: null,
        panelErrorCode: null,
      })
      return
    }

    const state = useSyncStore.getState()
    set({
      syncManager: createManagedSyncManagerForKind(
        providerKind,
        state.syncProviderKind === providerKind
          ? state.lastKnownHashData
          : null,
        state.syncProviderKind === providerKind ? state.lastSyncedAt : null
      ),
      syncProviderKind: providerKind,
      syncStatus: "idle",
      lastKnownHashData:
        state.syncProviderKind === providerKind
          ? state.lastKnownHashData
          : null,
    })
  },
  refreshSelectedProvider: () => {
    const state = useSyncStore.getState()
    if (!state.syncProviderKind) {
      return
    }

    set({
      syncManager: createManagedSyncManagerForKind(
        state.syncProviderKind,
        state.lastKnownHashData,
        state.lastSyncedAt
      ),
      syncStatus: "idle",
    })
  },
})

export const useSyncStore = create<SyncStore>()(
  persist(createSyncStore, {
    name: "provider-settings",
    partialize: (state) => ({
      syncProviderKind: state.syncProviderKind,
      lastSyncedAt: state.lastSyncedAt,
      lastKnownHashData: state.lastKnownHashData,
    }),
    onRehydrateStorage: () => (state, error) => {
      if (error) {
        console.error("Failed to rehydrate sync store:", error)
        return
      }
      const kind = state?.syncProviderKind
      if (kind) {
        state?.setManager(
          createManagedSyncManagerForKind(
            kind,
            state.lastKnownHashData,
            state.lastSyncedAt
          )
        )
      }
    },
  })
)

/**
 * Live worker-auth panel status for the auth UI and cloud icon.
 *
 * The store's `panelStatus`/`panelErrorCode` are only a re-render *signal*: the
 * provider's status setter pushes them on every in-place transition, and a
 * manager rebuild swaps `syncManager`. Both are subscribed here purely to
 * trigger a render — the *value* is always read live from the active manager so
 * it can never drift from the provider (the source of truth). Reading the
 * ephemeral, non-persisted store value directly would show a stale
 * "unauthorized" after any rebuild (OAuth redirect, refresh/rehydrate).
 */
export function useSyncPanelStatus(): SyncPanelStatus {
  const manager = useSyncStore((s) => s.syncManager)
  useSyncStore((s) => s.panelStatus)
  return manager?.getPanelStatus() ?? "unauthorized"
}

export function useSyncPanelErrorCode(): SyncPanelErrorCode | null {
  const manager = useSyncStore((s) => s.syncManager)
  useSyncStore((s) => s.panelErrorCode)
  return manager?.getLastErrorCode() ?? null
}

setNotifyHandler(() => {
  useSyncStore.getState().scheduleSyncAfterLocalChange()
})

function scheduleSyncAfterLocalChange(): void {
  localChangeSyncPending = true
  scheduleLocalChangeSyncFlush(LOCAL_CHANGE_SYNC_DELAY_MS)
}

function scheduleLocalChangeSyncFlush(delay: number): void {
  if (localChangeSyncTimer) {
    clearTimeout(localChangeSyncTimer)
  }

  localChangeSyncTimer = setTimeout(() => {
    localChangeSyncTimer = null
    void flushLocalChangeSync()
  }, delay)
}

async function flushLocalChangeSync(): Promise<void> {
  if (localChangeSyncInFlight) {
    return
  }

  const { syncManager } = useSyncStore.getState()
  if (
    !localChangeSyncPending ||
    !syncManager ||
    syncManager.getConnectionStatus() !== "connected"
  ) {
    localChangeSyncPending = false
    return
  }

  if (syncManager.getStatus() === "syncing") {
    scheduleLocalChangeSyncFlush(LOCAL_CHANGE_SYNC_DELAY_MS)
    return
  }

  localChangeSyncPending = false
  localChangeSyncInFlight = true
  useSyncStore.setState({ syncStatus: "syncing" })

  let didThrow = false
  try {
    await syncManager.syncNow()
  } catch (error) {
    didThrow = true
    console.error("[sync-store] Failed to sync local changes", error)
  } finally {
    const latestManager = useSyncStore.getState().syncManager
    if (latestManager === syncManager) {
      useSyncStore.setState({
        syncStatus: didThrow ? "error" : syncManager.getStatus(),
        lastSyncError: syncManager.getLastSyncError(),
        lastSyncedAt: syncManager.getLastSyncedAt(),
        lastKnownHashData: syncManager.getLastKnownHashData(),
      })
    }

    localChangeSyncInFlight = false
    if (localChangeSyncPending) {
      scheduleLocalChangeSyncFlush(LOCAL_CHANGE_SYNC_DELAY_MS)
    }
  }
}

function createManagedSyncManager(
  provider: SyncProvider,
  lastKnownHashData: string | null = null,
  lastSyncedAt: string | null = null
): SyncManager {
  const managerRef: { current: SyncManager | null } = { current: null }
  const delegate = createStoreSyncManagerDelegate(() => {
    if (!managerRef.current) {
      throw new Error("Sync manager is not initialized")
    }

    return managerRef.current
  })
  const manager = createSyncManager(
    provider,
    delegate,
    lastKnownHashData,
    lastSyncedAt
  )
  managerRef.current = manager
  return manager
}

function createManagedSyncManagerForKind(
  providerKind: SyncProviderKind,
  lastKnownHashData: string | null = null,
  lastSyncedAt: string | null = null
): SyncManager {
  const onPanelStatusChange = (
    panelStatus: SyncPanelStatus,
    panelErrorCode: SyncPanelErrorCode | null
  ) => {
    useSyncStore.setState({ panelStatus, panelErrorCode })
  }

  switch (providerKind) {
    case "google-drive": {
      const provider = new GoogleDriveProvider()
      provider.setPanelStatusChangeHandler(onPanelStatusChange)
      return createManagedSyncManager(provider, lastKnownHashData, lastSyncedAt)
    }
    case "onedrive": {
      const provider = new OneDriveProvider()
      provider.setPanelStatusChangeHandler(onPanelStatusChange)
      return createManagedSyncManager(provider, lastKnownHashData, lastSyncedAt)
    }
  }
}

function createStoreSyncManagerDelegate(
  getManager: () => SyncManager
): SyncManagerDelegate {
  const syncStableState = () => {
    const manager = getManager()
    useSyncStore.setState({
      syncStatus: "idle",
      lastSyncError: null,
      lastSyncedAt: manager.getLastSyncedAt(),
      lastKnownHashData: manager.getLastKnownHashData(),
    })
  }

  return {
    async onStart() {
      useSyncStore.setState({ syncStatus: "idle" })
    },
    async onStop() {
      useSyncStore.setState({ syncStatus: "idle" })
    },
    async onConnect() {
      useSyncStore.setState({ syncStatus: getManager().getStatus() })
    },
    async onSyncNow() {
      syncStableState()
    },
  }
}
