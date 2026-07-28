import { z } from "zod"
import type { WorkerBackedSyncProvider } from "../sync-provider"
import type {
  OccupiedStatus,
  SyncConnectionStatus,
  SyncProviderKind,
  DeviceFileRef,
  DeviceSnapshot,
} from "../types"
import { deviceDataFileName } from "../device-id"
import {
  oauthPopupName,
  shouldUseFullPageOAuthFlow,
} from "@/utils/oauth-window"
import type { SyncPanelErrorCode, SyncPanelStatus } from "../sync-panel-types"
import {
  clearSyncAccessToken,
  clearSyncRefreshToken,
  readSyncAccessToken,
  readSyncRefreshToken,
  saveSyncAccessToken,
  saveSyncRefreshToken,
} from "../sync-auth-storage"

export interface WorkerAccessToken {
  accessToken: string
  expiresAt: string // ISO 8601
}

/** Access token plus, for rotating providers, a fresh refresh token to persist. */
interface WorkerAccessTokenResult extends WorkerAccessToken {
  rotatedRefreshToken?: string
}

const ACCESS_TOKEN_EXPIRY_SKEW_MS = 30_000

// Rate-limit (429) / transient-overload (503) backoff for cloud API calls.
const MAX_RATE_LIMIT_RETRIES = 3
const BASE_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Delay before retrying a rate-limited request: honour a numeric `Retry-After`
 * header when present, else exponential backoff with jitter. Capped so a bogus
 * header can't stall sync indefinitely.
 */
function rateLimitDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After")
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1_000, MAX_BACKOFF_MS)
    }
  }
  const backoff = BASE_BACKOFF_MS * 2 ** attempt
  const jitter = Math.random() * BASE_BACKOFF_MS
  return Math.min(backoff + jitter, MAX_BACKOFF_MS)
}

export class WorkerAuthError extends Error {
  readonly code: string

  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = "WorkerAuthError"
  }
}

type OAuthResult = { type: "connected"; refreshToken: string }

// ── Provider-agnostic worker schemas ───────────────────────
const workerAccessTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive().optional(),
  // Present only when the provider rotates the refresh token (e.g. OneDrive).
  refresh_token: z.string().min(1).optional(),
})

const deviceSnapshotSchema = z
  .object({
    schemaVersion: z.number(),
    deviceId: z.string().min(1),
    syncedAt: z.string().min(1),
    contentHash: z.string(),
    data: z.unknown(),
    recordMeta: z.record(
      z.string(),
      z.object({ updatedAt: z.number(), deletedAt: z.number().nullable() })
    ),
  })
  .transform((value) => value as unknown as DeviceSnapshot)

const workerErrorSchema = z.object({
  error: z.string(),
})

/**
 * Builds the OAuth postMessage schemas whose `provider` literal depends on the
 * concrete worker provider ("google" / "onedrive").
 */
function buildWorkerOAuthSchemas(workerProvider: string) {
  return {
    connected: z.object({
      type: z.literal("oauth:connected"),
      provider: z.literal(workerProvider),
      refresh_token: z.string().min(1),
    }),
    cancelled: z.object({
      type: z.literal("oauth:cancelled"),
      provider: z.literal(workerProvider),
    }),
    error: z.object({
      type: z.literal("oauth:error"),
      provider: z.literal(workerProvider),
      error: z.string().optional(),
      recoverable: z.boolean().optional(),
    }),
  }
}

/**
 * Abstract base for worker-backed sync providers. Owns the shared OAuth flow,
 * client-side refresh-token persistence, worker token exchange and status
 * machine. The refresh token lives on this device; the worker is a stateless
 * proxy that only adds the provider client_secret. Concrete subclasses only
 * implement how data is read/written against their cloud storage API once an
 * access token is available.
 */
export abstract class WorkerBackedSyncProviderBase implements WorkerBackedSyncProvider {
  private _status: SyncPanelStatus = "unauthorized"
  private panelStatusChangeHandler:
    | ((status: SyncPanelStatus, errorCode: SyncPanelErrorCode | null) => void)
    | null = null
  protected refreshToken: string | null = null
  protected lastErrorCode: SyncPanelErrorCode | null = null
  private refreshInFlight: Promise<string> | null = null

  protected get status(): SyncPanelStatus {
    return this._status
  }
  protected set status(value: SyncPanelStatus) {
    this._status = value
    this.panelStatusChangeHandler?.(value, this.lastErrorCode)
  }

  setPanelStatusChangeHandler(
    handler: (
      status: SyncPanelStatus,
      errorCode: SyncPanelErrorCode | null
    ) => void
  ): void {
    this.panelStatusChangeHandler = handler
  }

  readonly providerKind: SyncProviderKind
  protected readonly workerProvider: string
  private readonly oauthSchemas: ReturnType<typeof buildWorkerOAuthSchemas>

  protected constructor(
    workerProvider: string,
    providerKind: SyncProviderKind
  ) {
    this.workerProvider = workerProvider
    this.providerKind = providerKind
    this.oauthSchemas = buildWorkerOAuthSchemas(workerProvider)
    this.refreshToken = readSyncRefreshToken(workerProvider)
    this.restorePersistedStatus()
  }

  // ── Abstract: provider-specific cloud storage IO ───────────
  /** List every `track-sync-data-<deviceId>.json` file in the app folder. */
  protected abstract listDeviceFiles(): Promise<DeviceFileRef[]>
  /** Download one device file's JSON body by file id. Null if missing. */
  protected abstract readDeviceFileById(fileId: string): Promise<unknown | null>
  /** Create or overwrite a device file by name (this device is its sole writer). */
  protected abstract writeDeviceFileByName(
    fileName: string,
    body: string
  ): Promise<void>
  /** Delete one device file by id. Idempotent — a missing file is success. */
  protected abstract deleteDeviceFileById(fileId: string): Promise<void>
  protected abstract clearCachedRemoteFiles(): void
  protected abstract readErrorCode(response: Response): Promise<string>

  // ── Status queries ─────────────────────────────────────────
  getOccupiedStatus(): OccupiedStatus {
    switch (this.status) {
      case "authorized":
        return "occupied"
      case "refreshing":
        return this.hasBoundContext() ? "occupied" : "available"
      case "authorizing":
      case "unauthorized":
        return "available"
    }
  }

  getLastErrorCode(): SyncPanelErrorCode | null {
    return this.lastErrorCode
  }

  getPanelStatus(): SyncPanelStatus {
    return this.status
  }

  getConnectionStatus(): SyncConnectionStatus {
    switch (this.status) {
      case "authorized":
        return "connected"
      case "authorizing":
      case "refreshing":
        return "connecting"
      case "unauthorized":
        return "disconnected"
    }
  }

  // ── Connection lifecycle ───────────────────────────────────
  async connect(): Promise<void> {
    this.clearLastError()

    try {
      // A stored refresh token means this device is already bound; connecting is
      // a no-op (validity is checked lazily on the next access-token request).
      if (this.refreshToken) {
        this.status = "authorized"
        return
      }

      this.status = "authorizing"

      // Single OAuth flow. Two paths:
      // 1. Popup (desktop) — resolves here with the refresh token.
      // 2. Full-page redirect (mobile) — navigates away; on return the callback
      //    page persists the refresh token and re-instantiates this provider.
      const oauthResult = await this.initiateOAuthFlow()

      this.refreshToken = oauthResult.refreshToken
      this.savePersistedRefreshToken(oauthResult.refreshToken)
      this.status = "authorized"
    } catch (error) {
      console.error("OAuth flow failed", error)
      const isUserDismissedFlow =
        error instanceof WorkerAuthError &&
        (error.code === "popup_closed" ||
          error.code === "oauth_cancelled" ||
          error.code === "access_denied")

      this.status = "unauthorized"
      if (!isUserDismissedFlow) {
        this.lastErrorCode = "authorization_failed"
      }
    }
  }

  async disconnect(): Promise<void> {
    this.clearLastError()

    // Deliberately NO provider-side revoke here: at Google, revoking any one
    // refresh token invalidates the whole user↔app grant, which would kill the
    // authorization on every other device. Dropping the locally held token is
    // what disconnects THIS device; full revocation (all devices + cloud wipe)
    // lives in clearRemoteCredential().
    this.clearPersistedAuth()
    this.status = "unauthorized"
  }

  async clearRemoteCredential(): Promise<void> {
    this.clearLastError()

    // Wipe the cloud backup while a usable refresh token is still held. Per-device
    // model: delete ALL device files, not a single fixed data file. Other online
    // devices re-seed their own file on next sync (their local data survives).
    if (this.refreshToken) {
      await this.deleteAllDeviceData()
    }

    try {
      await this.revokeRefreshTokenAtWorker()
    } finally {
      this.clearPersistedAuth()
      this.status = "unauthorized"
    }
  }

  // ── Per-device data files (schema validation shell) ────────
  async listDeviceDataFiles(): Promise<DeviceFileRef[]> {
    return this.listDeviceFiles()
  }

  async readDeviceData(ref: DeviceFileRef): Promise<DeviceSnapshot | null> {
    const json = await this.readDeviceFileById(ref.fileId)
    if (json === null) {
      return null
    }
    const parsed = deviceSnapshotSchema.safeParse(json)
    if (!parsed.success) {
      // Likely a torn read of a file mid-write; the caller skips it this cycle.
      throw new WorkerAuthError(
        "invalid_worker_response",
        "Device snapshot response was invalid"
      )
    }
    return parsed.data
  }

  async writeOwnDeviceData(snapshot: DeviceSnapshot): Promise<void> {
    await this.writeDeviceFileByName(
      deviceDataFileName(snapshot.deviceId),
      JSON.stringify(snapshot)
    )
  }

  /** Delete every device data file (clear the whole cloud backup). */
  async deleteAllDeviceData(): Promise<void> {
    const files = await this.listDeviceFiles()
    for (const file of files) {
      await this.deleteDeviceFileById(file.fileId)
    }
    this.clearCachedRemoteFiles()
  }

  // ── Access token + authorized requests ─────────────────────
  protected async getAccessToken(): Promise<string> {
    this.clearLastError()

    const persistedAccessToken = this.loadPersistedAccessToken()
    if (persistedAccessToken && isAccessTokenFresh(persistedAccessToken)) {
      return persistedAccessToken.accessToken
    }

    if (!this.refreshToken) {
      throw new WorkerAuthError(
        "reauthorization_required",
        "No persisted refresh token found"
      )
    }

    // Single-flight: concurrent callers share one refresh. Two parallel
    // refreshes would double-spend a rotating refresh token (OneDrive).
    this.refreshInFlight ??= this.refreshAccessTokenExclusive().finally(() => {
      this.refreshInFlight = null
    })
    return this.refreshInFlight
  }

  /**
   * Exchanges the refresh token for a fresh access token, serialised across
   * same-origin windows. Rotating providers (OneDrive) invalidate the refresh
   * token on every use, so two windows refreshing concurrently race: the loser
   * presents an already-rotated token, gets invalid_grant, and drops to
   * unauthorized. Inside the lock the persisted tokens are re-read, so a
   * refresh completed by another window is reused instead of repeated.
   */
  private refreshAccessTokenExclusive(): Promise<string> {
    this.status = "refreshing"
    return withCrossWindowLock(
      `sync-token-refresh:${this.workerProvider}`,
      async () => {
        // Another window may have refreshed while this one waited for the lock.
        const refreshedElsewhere = this.loadPersistedAccessToken()
        if (refreshedElsewhere && isAccessTokenFresh(refreshedElsewhere)) {
          this.status = "authorized"
          return refreshedElsewhere.accessToken
        }

        try {
          // The stored token is the source of truth, not the in-memory copy:
          // another window may have rotated it since this instance was
          // constructed, or removed it on disconnect (⇒ drop to unauthorized).
          const refreshToken = readSyncRefreshToken(this.workerProvider)
          if (!refreshToken) {
            throw new WorkerAuthError(
              "reauthorization_required",
              "No persisted refresh token found"
            )
          }
          this.refreshToken = refreshToken

          const nextAccessToken =
            await this.requestAccessTokenFromWorker(refreshToken)
          this.savePersistedAccessToken({
            accessToken: nextAccessToken.accessToken,
            expiresAt: nextAccessToken.expiresAt,
          })
          // Rotation: if the provider handed back a new refresh token, it
          // replaces the old one — which is now (or soon) invalid.
          if (nextAccessToken.rotatedRefreshToken) {
            this.refreshToken = nextAccessToken.rotatedRefreshToken
            this.savePersistedRefreshToken(nextAccessToken.rotatedRefreshToken)
          }
          this.status = "authorized"
          return nextAccessToken.accessToken
        } catch (error) {
          this.handleWorkerAuthError(error)
          throw error
        }
      }
    )
  }

  /**
   * Performs a fetch with a worker-issued access token, retrying once on 401
   * after clearing the cached token, and retrying with exponential backoff on
   * 429/503 (honouring `Retry-After` when present). Non-2xx responses (except a
   * 404 when `allow404` is set) are mapped to a WorkerAuthError via the subclass
   * `readErrorCode` and dispatched through `handleWorkerAuthError`.
   */
  protected async authorizedFetch(
    url: string,
    init: RequestInit = {},
    { allow404 = false, allowRetry = true }: AuthorizedFetchOptions = {},
    rateLimitAttempt = 0
  ): Promise<Response> {
    const accessToken = await this.getAccessToken()
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    })

    if (response.status === 401 && allowRetry) {
      this.clearPersistedAccessToken()
      return this.authorizedFetch(url, init, { allow404, allowRetry: false })
    }

    // Rate-limited / transiently overloaded: back off and retry. Beyond the
    // retry budget the response falls through to the generic error mapping below.
    if (
      (response.status === 429 || response.status === 503) &&
      rateLimitAttempt < MAX_RATE_LIMIT_RETRIES
    ) {
      await sleep(rateLimitDelayMs(response, rateLimitAttempt))
      return this.authorizedFetch(
        url,
        init,
        { allow404, allowRetry },
        rateLimitAttempt + 1
      )
    }

    if (!response.ok && !(response.status === 404 && allow404)) {
      const errorCode = await this.readErrorCode(response)
      const error = new WorkerAuthError(errorCode, errorCode)
      this.handleWorkerAuthError(error)
      throw error
    }

    return response
  }

  // A non-JSON body is a bad read (torn file, proxy error page), not a missing
  // file — throwing keeps it distinct from the 404 → null path so the caller
  // skips this round instead of treating the data as absent.
  protected async parseJsonResponse(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch {
      throw new WorkerAuthError(
        "invalid_response",
        "Response body was not valid JSON"
      )
    }
  }

  // ── Worker interaction ─────────────────────────────────────
  private async requestAccessTokenFromWorker(
    refreshToken: string
  ): Promise<WorkerAccessTokenResult> {
    const response = await fetch(
      `${this.getWorkerBaseUrl()}/token/${this.workerProvider}/access`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    )

    const json = await response.json().catch(() => null)

    if (response.ok) {
      const payload = workerAccessTokenSchema.safeParse(json)
      if (!payload.success) {
        throw new WorkerAuthError(
          "invalid_worker_response",
          "Worker access token response was invalid"
        )
      }

      return {
        accessToken: payload.data.access_token,
        expiresAt: new Date(
          Date.now() + (payload.data.expires_in ?? 3600) * 1000
        ).toISOString(),
        rotatedRefreshToken: payload.data.refresh_token,
      }
    }

    const errorPayload = workerErrorSchema.safeParse(json)
    const errorCode = errorPayload.success
      ? errorPayload.data.error
      : "worker_request_failed"

    throw new WorkerAuthError(
      errorCode,
      `Worker access token request failed: ${response.status}`
    )
  }

  private async initiateOAuthFlow(): Promise<OAuthResult> {
    const workerBaseUrl = this.getWorkerBaseUrl()
    const callbackOrigin = window.location.origin
    const authorizationUrl = new URL(
      `${workerBaseUrl}/auth/${this.workerProvider}/start`
    )

    if (shouldUseFullPageOAuthFlow()) {
      return redirectToOAuthFlow(authorizationUrl.toString())
    }

    const popup = window.open(
      authorizationUrl.toString(),
      oauthPopupName(this.workerProvider),
      "width=500,height=600,left=200,top=100"
    )
    if (!popup) {
      return redirectToOAuthFlow(authorizationUrl.toString())
    }

    return new Promise<OAuthResult>((resolve, reject) => {
      const cleanup = () => {
        window.removeEventListener("message", handleMessage)
        clearInterval(timer)
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== callbackOrigin) {
          return
        }
        if (event.source !== popup) {
          return
        }

        // First-time (and every) authorization returns the refresh token, which
        // this device stores. The provider panel moves to the connected state.
        const connectedPayload = this.oauthSchemas.connected.safeParse(
          event.data
        )
        if (connectedPayload.success) {
          cleanup()
          resolve({
            type: "connected",
            refreshToken: connectedPayload.data.refresh_token,
          })
          return
        }

        const cancelledPayload = this.oauthSchemas.cancelled.safeParse(
          event.data
        )
        if (cancelledPayload.success) {
          cleanup()
          reject(new WorkerAuthError("oauth_cancelled", "OAuth cancelled"))
          return
        }

        const errorPayload = this.oauthSchemas.error.safeParse(event.data)
        if (errorPayload.success) {
          cleanup()
          reject(
            new WorkerAuthError(
              errorPayload.data.error ?? "oauth_error",
              errorPayload.data.error ?? "OAuth flow failed"
            )
          )
        }
      }

      const timer = setInterval(() => {
        if (popup.closed) {
          cleanup()
          reject(new WorkerAuthError("popup_closed", "Popup closed by user"))
        }
      }, 500)

      window.addEventListener("message", handleMessage)
    })
  }

  private async revokeRefreshTokenAtWorker(): Promise<void> {
    const refreshToken = this.refreshToken
    if (!refreshToken) {
      return
    }

    const response = await fetch(
      `${this.getWorkerBaseUrl()}/token/${this.workerProvider}/revoke`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    )

    if (!response.ok) {
      throw new WorkerAuthError(
        "revoke_failed",
        `Worker revoke failed: ${response.status}`
      )
    }
  }

  protected handleWorkerAuthError(error: unknown): void {
    if (!(error instanceof WorkerAuthError)) {
      this.lastErrorCode = "sync_unavailable"
      this.status = this.hasBoundContext() ? "authorized" : "unauthorized"
      return
    }

    if (
      error.code === "reauthorization_required" ||
      error.code === "drive_access_denied"
    ) {
      this.clearPersistedAuth()
      this.status = "unauthorized"
      return
    }

    this.lastErrorCode = "sync_unavailable"
    this.status = this.hasBoundContext() ? "authorized" : "unauthorized"
  }

  // ── Persistence ────────────────────────────────────────────
  private loadPersistedAccessToken(): WorkerAccessToken | null {
    return readSyncAccessToken(this.workerProvider)
  }

  private savePersistedRefreshToken(refreshToken: string): void {
    saveSyncRefreshToken(this.workerProvider, refreshToken)
  }

  private savePersistedAccessToken(accessToken: WorkerAccessToken): void {
    saveSyncAccessToken(this.workerProvider, accessToken)
  }

  private clearPersistedAccessToken(): void {
    clearSyncAccessToken(this.workerProvider)
  }

  private hasBoundContext(): boolean {
    return this.refreshToken !== null
  }

  protected clearLastError(): void {
    this.lastErrorCode = null
  }

  private restorePersistedStatus(): void {
    if (this.refreshToken) {
      this.status = "authorized"
      return
    }

    // No refresh token: drop any stale cached access token and stay unauthorized.
    this.clearPersistedAccessToken()
  }

  private clearPersistedAuth(): void {
    this.refreshToken = null
    clearSyncRefreshToken(this.workerProvider)
    this.clearPersistedAccessToken()
    this.clearCachedRemoteFiles()
  }

  protected getWorkerBaseUrl(): string {
    const workerBaseUrl = import.meta.env.VITE_AUTH_WORKER_URL
    if (!workerBaseUrl) {
      throw new WorkerAuthError(
        "missing_worker_url",
        "Missing VITE_AUTH_WORKER_URL"
      )
    }

    return workerBaseUrl.replace(/\/+$/, "")
  }
}

interface AuthorizedFetchOptions {
  allow404?: boolean
  allowRetry?: boolean
}

function redirectToOAuthFlow(authorizationUrl: string): Promise<never> {
  window.location.assign(authorizationUrl)
  return new Promise<never>(() => {})
}

/**
 * Serialises `task` across same-origin windows via the Web Locks API. Runs the
 * task directly where the API is unavailable (tests, non-window contexts).
 */
async function withCrossWindowLock<T>(
  name: string,
  task: () => Promise<T>
): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    return task()
  }
  return await navigator.locks.request(name, task)
}
function isAccessTokenFresh(accessToken: WorkerAccessToken): boolean {
  return (
    new Date(accessToken.expiresAt).getTime() >
    Date.now() + ACCESS_TOKEN_EXPIRY_SKEW_MS
  )
}
