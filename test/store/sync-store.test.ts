import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { SyncManagerDelegate } from "@/services/sync/sync-manager"
import type {
  SyncConnectionStatus,
  SyncStatus,
} from "@/services/sync/types"
import type {
  SyncPanelErrorCode,
  SyncPanelStatus,
} from "@/services/sync/sync-panel-types"

// persist middleware touches localStorage at import time — shim it before the
// store module loads (node has no usable localStorage).
vi.hoisted(() => {
  const backing = new Map<string, string>()
  const shim = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, String(value)),
    removeItem: (key: string) => void backing.delete(key),
    clear: () => backing.clear(),
    key: () => null,
    get length() {
      return backing.size
    },
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: shim,
    configurable: true,
  })
  // zustand's persist reads `window.localStorage` specifically — without a
  // window global it silently skips hydration and the persist API.
  Object.defineProperty(globalThis, "window", {
    value: globalThis,
    configurable: true,
  })
})

// Panel-status handlers registered by the store, keyed by provider kind.
// Hoisted together with the fake provider class — vi.mock factories run first.
const { registeredHandlers, FakePanelProvider } = vi.hoisted(() => {
  const registeredHandlers = new Map<
    string,
    (status: SyncPanelStatus, errorCode: SyncPanelErrorCode | null) => void
  >()
  class FakePanelProvider {
    providerKind = "google-drive"
    setPanelStatusChangeHandler(
      handler: (
        status: SyncPanelStatus,
        errorCode: SyncPanelErrorCode | null
      ) => void
    ): void {
      registeredHandlers.set(this.providerKind, handler)
    }
  }
  return { registeredHandlers, FakePanelProvider }
})

vi.mock("@/services/sync/provider/google-provider/google-drive-provider", () => ({
  GoogleDriveProvider: class extends FakePanelProvider {
    providerKind = "google-drive"
  },
}))
vi.mock("@/services/sync/provider/onedrive-provider/onedrive-provider", () => ({
  OneDriveProvider: class extends FakePanelProvider {
    providerKind = "onedrive"
  },
}))

interface FakeManager {
  providerKind: string
  delegate: SyncManagerDelegate
  connectionStatus: SyncConnectionStatus
  status: SyncStatus
  lastSyncError: string | null
  lastSyncedAt: string | null
  lastKnownHashData: string | null
  syncNow: ReturnType<typeof vi.fn>
  getStatus(): SyncStatus
  getConnectionStatus(): SyncConnectionStatus
  getLastSyncError(): string | null
  getLastSyncedAt(): string | null
  getLastKnownHashData(): string | null
  getPanelStatus(): SyncPanelStatus
  getLastErrorCode(): SyncPanelErrorCode | null
}

const created = vi.hoisted(() => ({ managers: [] as unknown[] }))

vi.mock("@/services/sync/create-sync-manager", () => ({
  createSyncManager: vi.fn(
    (
      provider: { providerKind: string },
      delegate: SyncManagerDelegate,
      lastKnownHashData: string | null,
      lastSyncedAt: string | null
    ) => {
      const manager = {
        providerKind: provider.providerKind,
        delegate,
        connectionStatus: "connected",
        status: "idle",
        lastSyncError: null,
        lastSyncedAt,
        lastKnownHashData,
        syncNow: vi.fn(async () => {}),
        getStatus() {
          return this.status
        },
        getConnectionStatus() {
          return this.connectionStatus
        },
        getLastSyncError() {
          return this.lastSyncError
        },
        getLastSyncedAt() {
          return this.lastSyncedAt
        },
        getLastKnownHashData() {
          return this.lastKnownHashData
        },
        getPanelStatus: () => "authorized" as const,
        getLastErrorCode: () => null,
      }
      created.managers.push(manager)
      return manager
    }
  ),
}))

import { useSyncStore } from "@/store/sync-store"

function latestManager(): FakeManager {
  return created.managers[created.managers.length - 1] as FakeManager
}

/** Drive the 800ms debounce plus the async flush to completion. */
async function runFlush() {
  await vi.advanceTimersByTimeAsync(800)
}

beforeEach(() => {
  vi.useFakeTimers()
  created.managers.length = 0
  registeredHandlers.clear()
  useSyncStore.setState({
    syncManager: null,
    syncProviderKind: null,
    syncStatus: null,
    lastSyncError: null,
    lastSyncedAt: null,
    lastKnownHashData: null,
    panelStatus: null,
    panelErrorCode: null,
  })
})

afterEach(async () => {
  // Drain any pending debounce so module-level flags reset between tests.
  await vi.runAllTimersAsync()
  vi.useRealTimers()
  localStorage.clear()
})

describe("selectSyncProvider", () => {
  it("creates a manager for the kind and resets carried state on a switch", () => {
    useSyncStore.setState({
      syncProviderKind: "onedrive",
      lastKnownHashData: "old-hash",
      lastSyncedAt: "2026-07-01T00:00:00.000Z",
    })

    useSyncStore.getState().selectSyncProvider("google-drive")

    const state = useSyncStore.getState()
    expect(state.syncProviderKind).toBe("google-drive")
    expect(state.syncStatus).toBe("idle")
    // Different kind → carried hash is dropped, manager starts cold.
    expect(state.lastKnownHashData).toBeNull()
    expect(latestManager().providerKind).toBe("google-drive")
    expect(latestManager().lastKnownHashData).toBeNull()
    expect(latestManager().lastSyncedAt).toBeNull()
  })

  it("keeps hash and lastSyncedAt when re-selecting the same kind", () => {
    useSyncStore.setState({
      syncProviderKind: "google-drive",
      lastKnownHashData: "hash-1",
      lastSyncedAt: "2026-07-02T00:00:00.000Z",
    })

    useSyncStore.getState().selectSyncProvider("google-drive")

    expect(useSyncStore.getState().lastKnownHashData).toBe("hash-1")
    expect(latestManager().lastKnownHashData).toBe("hash-1")
    expect(latestManager().lastSyncedAt).toBe("2026-07-02T00:00:00.000Z")
  })

  it("selecting null clears the whole sync state", () => {
    useSyncStore.getState().selectSyncProvider("onedrive")
    useSyncStore.getState().selectSyncProvider(null)

    const state = useSyncStore.getState()
    expect(state.syncManager).toBeNull()
    expect(state.syncProviderKind).toBeNull()
    expect(state.syncStatus).toBeNull()
    expect(state.lastSyncedAt).toBeNull()
    expect(state.panelStatus).toBeNull()
  })

  it("wires the provider's panel-status handler into the store", () => {
    useSyncStore.getState().selectSyncProvider("onedrive")

    registeredHandlers.get("onedrive")!("refreshing", "sync_unavailable")

    const state = useSyncStore.getState()
    expect(state.panelStatus).toBe("refreshing")
    expect(state.panelErrorCode).toBe("sync_unavailable")
  })
})

describe("refreshSelectedProvider", () => {
  it("is a no-op without a selected kind", () => {
    useSyncStore.getState().refreshSelectedProvider()
    expect(created.managers).toHaveLength(0)
  })

  it("rebuilds the manager carrying hash and lastSyncedAt over", () => {
    useSyncStore.getState().selectSyncProvider("google-drive")
    useSyncStore.setState({
      lastKnownHashData: "hash-2",
      lastSyncedAt: "2026-07-03T00:00:00.000Z",
    })

    useSyncStore.getState().refreshSelectedProvider()

    expect(created.managers).toHaveLength(2)
    expect(latestManager().lastKnownHashData).toBe("hash-2")
    expect(latestManager().lastSyncedAt).toBe("2026-07-03T00:00:00.000Z")
    expect(useSyncStore.getState().syncManager).toBe(latestManager())
  })
})

describe("persist rehydrate", () => {
  // Hydration happens when the module initialises, so seed storage and load a
  // fresh copy of the module to exercise onRehydrateStorage.
  async function importFreshStore() {
    vi.resetModules()
    return (await import("@/store/sync-store")).useSyncStore
  }

  it("recreates the manager for a persisted provider kind", async () => {
    localStorage.setItem(
      "provider-settings",
      JSON.stringify({
        state: {
          syncProviderKind: "onedrive",
          lastSyncedAt: "2026-07-04T00:00:00.000Z",
          lastKnownHashData: "hash-persisted",
        },
        version: 0,
      })
    )

    const freshStore = await importFreshStore()

    expect(latestManager().providerKind).toBe("onedrive")
    expect(latestManager().lastKnownHashData).toBe("hash-persisted")
    expect(freshStore.getState().syncManager).toBe(latestManager())
  })

  it("does nothing without a persisted kind", async () => {
    localStorage.setItem(
      "provider-settings",
      JSON.stringify({ state: { syncProviderKind: null }, version: 0 })
    )

    await importFreshStore()

    expect(created.managers).toHaveLength(0)
  })
})

describe("scheduleSyncAfterLocalChange", () => {
  function selectConnectedManager(): FakeManager {
    useSyncStore.getState().selectSyncProvider("google-drive")
    return latestManager()
  }

  it("debounces to one syncNow and pulls stable state from the manager", async () => {
    const manager = selectConnectedManager()
    manager.lastSyncedAt = "2026-07-05T00:00:00.000Z"
    manager.lastKnownHashData = "hash-after"

    useSyncStore.getState().scheduleSyncAfterLocalChange()
    useSyncStore.getState().scheduleSyncAfterLocalChange()
    await runFlush()

    expect(manager.syncNow).toHaveBeenCalledTimes(1)
    const state = useSyncStore.getState()
    expect(state.syncStatus).toBe("idle")
    expect(state.lastSyncError).toBeNull()
    expect(state.lastSyncedAt).toBe("2026-07-05T00:00:00.000Z")
    expect(state.lastKnownHashData).toBe("hash-after")
  })

  it("drops the pending flush when the manager is not connected", async () => {
    const manager = selectConnectedManager()
    manager.connectionStatus = "disconnected"

    useSyncStore.getState().scheduleSyncAfterLocalChange()
    await runFlush()

    expect(manager.syncNow).not.toHaveBeenCalled()
    // A later reconnect does not resurrect the dropped flush.
    manager.connectionStatus = "connected"
    await vi.runAllTimersAsync()
    expect(manager.syncNow).not.toHaveBeenCalled()
  })

  it("drops the pending flush when no manager is configured", async () => {
    useSyncStore.getState().scheduleSyncAfterLocalChange()
    await runFlush()
    expect(created.managers).toHaveLength(0)
  })

  it("reschedules while the manager is already syncing", async () => {
    const manager = selectConnectedManager()
    manager.status = "syncing"

    useSyncStore.getState().scheduleSyncAfterLocalChange()
    await runFlush()
    expect(manager.syncNow).not.toHaveBeenCalled()

    manager.status = "idle"
    await runFlush()
    expect(manager.syncNow).toHaveBeenCalledTimes(1)
  })

  it("marks error state with the manager's reason when syncNow settles on error", async () => {
    const manager = selectConnectedManager()
    manager.syncNow.mockImplementation(async () => {
      manager.status = "error"
      manager.lastSyncError = "listing failed"
    })

    useSyncStore.getState().scheduleSyncAfterLocalChange()
    await runFlush()

    const state = useSyncStore.getState()
    expect(state.syncStatus).toBe("error")
    expect(state.lastSyncError).toBe("listing failed")
  })

  it("marks error state when syncNow throws", async () => {
    const manager = selectConnectedManager()
    manager.syncNow.mockRejectedValue(new Error("boom"))

    useSyncStore.getState().scheduleSyncAfterLocalChange()
    await runFlush()

    expect(useSyncStore.getState().syncStatus).toBe("error")
  })

  it("does not write state from a manager that was swapped out mid-flight", async () => {
    const manager = selectConnectedManager()
    manager.syncNow.mockImplementation(async () => {
      // The user switches provider while the flush is awaiting syncNow.
      useSyncStore.getState().selectSyncProvider("onedrive")
      manager.lastKnownHashData = "stale-hash"
    })

    useSyncStore.getState().scheduleSyncAfterLocalChange()
    await runFlush()

    expect(useSyncStore.getState().lastKnownHashData).not.toBe("stale-hash")
  })

  it("runs a follow-up flush for changes arriving mid-sync", async () => {
    const manager = selectConnectedManager()
    manager.syncNow.mockImplementation(async () => {
      useSyncStore.getState().scheduleSyncAfterLocalChange()
    })

    useSyncStore.getState().scheduleSyncAfterLocalChange()
    await runFlush()
    expect(manager.syncNow).toHaveBeenCalledTimes(1)

    manager.syncNow.mockImplementation(async () => {})
    await runFlush()
    expect(manager.syncNow).toHaveBeenCalledTimes(2)
  })
})

describe("manager delegate", () => {
  it("onStart/onStop/onConnect mirror manager status into the store", async () => {
    useSyncStore.getState().selectSyncProvider("google-drive")
    const manager = latestManager()

    useSyncStore.setState({ syncStatus: "error" })
    await manager.delegate.onStart?.()
    expect(useSyncStore.getState().syncStatus).toBe("idle")

    useSyncStore.setState({ syncStatus: "error" })
    await manager.delegate.onStop?.()
    expect(useSyncStore.getState().syncStatus).toBe("idle")

    manager.status = "syncing"
    await manager.delegate.onConnect?.()
    expect(useSyncStore.getState().syncStatus).toBe("syncing")
  })

  it("onSyncNow publishes the stable snapshot and clears the error", async () => {
    useSyncStore.getState().selectSyncProvider("google-drive")
    const manager = latestManager()
    manager.lastSyncedAt = "2026-07-06T00:00:00.000Z"
    manager.lastKnownHashData = "hash-stable"
    useSyncStore.setState({ syncStatus: "error", lastSyncError: "old" })

    await manager.delegate.onSyncNow?.()

    const state = useSyncStore.getState()
    expect(state.syncStatus).toBe("idle")
    expect(state.lastSyncError).toBeNull()
    expect(state.lastSyncedAt).toBe("2026-07-06T00:00:00.000Z")
    expect(state.lastKnownHashData).toBe("hash-stable")
  })
})
