import { DefaultSyncManager } from "./default-sync-manager"
import type { SyncManager, SyncManagerDelegate } from "./sync-manager"
import type { SyncProvider } from "./sync-provider"

export function createSyncManager(
  provider: SyncProvider,
  delegate: SyncManagerDelegate = {},
  lastKnownHashData: string | null = null,
  lastSyncedAt: string | null = null
): SyncManager {
  return new DefaultSyncManager(
    provider,
    delegate,
    lastKnownHashData,
    lastSyncedAt
  )
}
