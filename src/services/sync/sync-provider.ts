import type {
  SyncConnectionStatus,
  SyncProviderKind,
  OccupiedStatus,
  DeviceFileRef,
  DeviceSnapshot,
} from "./types"
import type { SyncPanelStatus, SyncPanelErrorCode } from "./sync-panel-types"

/**
 * Context provided to the sync provider panel component, allowing it to interact with the sync provider's functionalities such as connecting and disconnecting.
 * @method connect - Initiates a connection to the sync service.
 * @method disconnect - Terminates the connection to the sync service.
 */
export interface SyncProviderPanelContext {
  connect(): Promise<void>
  disconnect(): Promise<void>
}
/**
 * The SyncProvider interface defines the core contract for implementing a synchronization service that can connect to a remote data source, fetch and upload data, and provide status information about the connection and sync process. It also exposes a user interface panel for interaction.
 * @property providerKind - The kind of sync provider.
 * @method connect - Initiates a connection to the sync service.
 * @method disconnect - Terminates the connection to the sync service.
 * @method listDeviceDataFiles - Lists every device's data file in the cloud folder.
 * @method readDeviceData - Downloads and parses one device's data file.
 * @method writeOwnDeviceData - Writes this device's own data file (single writer).
 * @method deleteAllDeviceData - Deletes every device data file (clear cloud backup).
 * @method getConnectionStatus - Retrieves the current connection status.
 * @method getOccupiedStatus - Retrieves the current occupied status.
 * @method setPanelStatusChangeHandler - Registers a handler called whenever the provider's panel status or error code changes.
 */
export interface SyncProvider {
  readonly providerKind: SyncProviderKind
  connect(): Promise<void>
  disconnect(): Promise<void>
  listDeviceDataFiles(): Promise<DeviceFileRef[]>
  readDeviceData(ref: DeviceFileRef): Promise<DeviceSnapshot | null>
  writeOwnDeviceData(snapshot: DeviceSnapshot): Promise<void>
  deleteAllDeviceData(): Promise<void>
  getConnectionStatus(): SyncConnectionStatus
  getOccupiedStatus(): OccupiedStatus
  setPanelStatusChangeHandler(
    handler: (status: SyncPanelStatus, errorCode: SyncPanelErrorCode | null) => void
  ): void
}

/**
 * A SyncProvider backed by a worker-mediated OAuth flow, where the refresh token
 * is stored client-side and the worker is a stateless proxy. Adds the worker
 * auth-state panel surface that only applies to worker-backed providers (Google
 * Drive, OneDrive). Pure sync concerns stay on SyncProvider.
 * @method getPanelStatus - Retrieves the current worker auth panel status.
 * @method getLastErrorCode - Retrieves the last panel error code.
 * @method clearRemoteCredential - Wipes the cloud backup and disconnects this device.
 */
export interface WorkerBackedSyncProvider extends SyncProvider {
  getPanelStatus(): SyncPanelStatus
  getLastErrorCode(): SyncPanelErrorCode | null
  clearRemoteCredential(): Promise<void>
}

/**
 * Narrows a SyncProvider to a WorkerBackedSyncProvider by feature-detecting the
 * worker-auth panel surface. Lets the manager surface live panel status without
 * assuming every provider is worker-backed.
 */
export function isWorkerBackedProvider(
  provider: SyncProvider | null | undefined
): provider is WorkerBackedSyncProvider {
  return (
    provider != null &&
    typeof (provider as WorkerBackedSyncProvider).getPanelStatus === "function"
  )
}
