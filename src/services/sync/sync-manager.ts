import type { SyncProvider } from "./sync-provider"
import type {
  OccupiedStatus,
  SyncConnectionStatus,
  SyncProviderKind,
  SyncStatus,
} from "./types"
import type { SyncPanelStatus, SyncPanelErrorCode } from "./sync-panel-types"

/**
 * The SyncManagerDelegate interface defines a set of optional callback methods that can be implemented by a delegate to respond to various events in the sync manager's lifecycle, such as starting, stopping, connecting, and syncing. This allows for custom behavior to be executed at different stages of the sync process.
 * @method onStart - Called when the sync manager starts.
 * @method onStop - Called when the sync manager stops.
 * @method onConnect - Called when the sync manager establishes a connection to the sync service.
 * @method onSyncNow - Called when a sync operation is initiated.
 */
export interface SyncManagerDelegate {
  onStart?(): Promise<void>
  onStop?(): Promise<void>
  onConnect?(): Promise<void>
  onSyncNow?(): Promise<void>
}
/**
 * The SyncManager interface defines the contract for a synchronization manager that handles the synchronization process between local data and a remote sync service. It includes methods for starting and stopping the manager, initiating sync operations, managing connections, and retrieving status information. It also provides methods that proxy to the active sync provider for panel status and error handling.
 * @method start - Starts the sync manager, initializing any necessary resources and preparing for synchronization.
 * @method stop - Stops the sync manager, cleaning up resources and terminating any ongoing sync operations.
 * @method syncNow - Initiates an immediate synchronization operation between local data and the remote sync service.
 * @method connect - Establishes a connection to the sync service, allowing for data exchange.
 * @method disconnect - Terminates the connection to the sync service, stopping any further data exchange.
 * @method getStatus - Retrieves the current working status of the sync process (e.g., idle, syncing, error).
 * @method getConnectionStatus - Retrieves the current connection status to the sync service (e.g., connected, disconnected, error).
 * @method getOccupiedStatus - Retrieves whether the sync service is currently occupied by another instance or available for connection.
 * @method getProviderKind - Retrieves the kind of sync provider currently in use, or null if no provider is active.
 * @method getLastSyncedAt - Retrieves the timestamp of the last successful sync operation in ISO 8601 format, or null if no sync has occurred.
 * @method getLastKnownHashData - Retrieves the last known hash of the data that was synced, used for change detection, or null if no sync has occurred.
 * @method getProvider - Retrieves the active sync provider, or null. The UI layer maps it to its panel component — the service layer stays React-free.
 * @method getPanelStatus - Retrieves the live worker-auth panel status from the active provider (or "unauthorized" when none). Authoritative source for the auth UI and cloud icon.
 * @method getLastErrorCode - Retrieves the live last panel error code from the active provider, or null.
 * @method getLastSyncError - Retrieves the reason of the last failed sync, or null after a successful one.
 */
export interface SyncManager {
  start(): Promise<void>
  stop(): Promise<void>
  syncNow(): Promise<void>
  connect(): Promise<void>
  disconnect(): Promise<void>

  getStatus(): SyncStatus
  getConnectionStatus(): SyncConnectionStatus
  getOccupiedStatus(): OccupiedStatus
  getProviderKind(): SyncProviderKind | null
  getLastSyncedAt(): string | null // ISO 8601
  getLastKnownHashData(): string | null
  getProvider(): SyncProvider | null
  getPanelStatus(): SyncPanelStatus
  getLastErrorCode(): SyncPanelErrorCode | null
  getLastSyncError(): string | null
}
