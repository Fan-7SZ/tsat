/**
 * Defines the status of the sync provider panel
 * @property unauthorized - The user is not authorized to access the sync service (e.g., not connected), showing unbinding UI.
 * @property authorized - The user is authorized and the sync service is available.
 * @property authorizing - The sync service is in the process of authorizing the user.
 * @property refreshing - The sync service is refreshing its status or data.
 */
export type SyncPanelStatus =
  | "unauthorized"
  | "authorized"
  | "authorizing"
  | "refreshing"
/**
 * Defines the error codes that can be returned by the sync provider panel when an error occurs during sync operations.
 * @property authorization_failed - Indicates that the authorization process failed, possibly due to invalid credentials or network issues.
 * @property sync_unavailable - Indicates that the sync service is currently unavailable, which could be due to server issues, maintenance, or network problems.
 */
export type SyncPanelErrorCode = "authorization_failed" | "sync_unavailable"
