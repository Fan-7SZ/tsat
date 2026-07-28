import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

// Break the base → panel → sync-store → providers import cycle and avoid
// pulling the whole store/Dexie chain into the node environment.
vi.mock("@/services/sync/provider/worker-backed-provider-panel", () => ({
  WorkerBackedProviderPanel: () => null,
}))

import {
  WorkerAuthError,
  WorkerBackedSyncProviderBase,
} from "@/services/sync/provider/worker-backed-sync-provider"
import {
  SYNC_ACCESS_TOKEN_STORAGE_KEY,
  SYNC_REFRESH_TOKEN_STORAGE_KEY,
} from "@/services/sync/sync-auth-storage"
import type { DeviceFileRef, DeviceSnapshot } from "@/services/sync/types"
import type { SyncPanelStatus } from "@/services/sync/sync-panel-types"

const WORKER_URL = "https://auth.test"
const CLOUD_URL = "https://cloud.test"

/** Minimal concrete subclass whose cloud IO all flows through authorizedFetch. */
class TestProvider extends WorkerBackedSyncProviderBase {
  cacheClearCount = 0

  constructor() {
    super("google", "google-drive")
  }

  protected async listDeviceFiles(): Promise<DeviceFileRef[]> {
    const response = await this.authorizedFetch(`${CLOUD_URL}/files`)
    const json = await this.parseJsonResponse(response)
    return (json as { files?: DeviceFileRef[] } | null)?.files ?? []
  }

  protected async readDeviceFileById(fileId: string): Promise<unknown | null> {
    const response = await this.authorizedFetch(
      `${CLOUD_URL}/files/${fileId}`,
      {},
      { allow404: true }
    )
    if (response.status === 404) {
      return null
    }
    return this.parseJsonResponse(response)
  }

  protected async writeDeviceFileByName(
    fileName: string,
    body: string
  ): Promise<void> {
    await this.authorizedFetch(`${CLOUD_URL}/files/by-name/${fileName}`, {
      method: "PUT",
      body,
    })
  }

  protected async deleteDeviceFileById(fileId: string): Promise<void> {
    await this.authorizedFetch(`${CLOUD_URL}/files/${fileId}`, {
      method: "DELETE",
    })
  }

  protected clearCachedRemoteFiles(): void {
    this.cacheClearCount += 1
  }

  protected async readErrorCode(response: Response): Promise<string> {
    const json = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    return json?.error ?? "cloud_request_failed"
  }
}

/** Typed access to the protected members under test. */
type BaseInternals = {
  getAccessToken(): Promise<string>
  authorizedFetch(
    url: string,
    init?: RequestInit,
    options?: { allow404?: boolean; allowRetry?: boolean }
  ): Promise<Response>
  parseJsonResponse(response: Response): Promise<unknown>
  getWorkerBaseUrl(): string
}

function internals(provider: TestProvider): BaseInternals {
  return provider as unknown as BaseInternals
}

function createLocalStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

let storage: ReturnType<typeof createLocalStorage>

function seedRefreshToken(token = "rt-1", provider = "google") {
  storage.setItem(
    SYNC_REFRESH_TOKEN_STORAGE_KEY,
    JSON.stringify({ provider, refreshToken: token })
  )
}

function seedAccessToken(accessToken: string, expiresInMs: number) {
  storage.setItem(
    SYNC_ACCESS_TOKEN_STORAGE_KEY,
    JSON.stringify({
      provider: "google",
      accessToken,
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    })
  )
}

function storedRefreshToken(): string | null {
  const raw = storage.getItem(SYNC_REFRESH_TOKEN_STORAGE_KEY)
  if (!raw) return null
  return (JSON.parse(raw) as { refreshToken: string }).refreshToken
}

function storedAccessToken(): { accessToken: string; expiresAt: string } | null {
  const raw = storage.getItem(SYNC_ACCESS_TOKEN_STORAGE_KEY)
  if (!raw) return null
  return JSON.parse(raw) as { accessToken: string; expiresAt: string }
}

function makeSnapshot(deviceId = "dev-1"): DeviceSnapshot {
  return {
    schemaVersion: 2,
    deviceId,
    syncedAt: "2026-07-26T00:00:00.000Z",
    contentHash: "hash-1",
    data: {} as DeviceSnapshot["data"],
    recordMeta: { "tasks:a": { updatedAt: 1, deletedAt: null } },
  }
}

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" })
})

beforeEach(() => {
  storage = createLocalStorage()
  vi.stubGlobal("window", { localStorage: storage })
  vi.stubEnv("VITE_AUTH_WORKER_URL", WORKER_URL)
})

afterEach(() => {
  server.resetHandlers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

afterAll(() => {
  server.close()
})

describe("constructor / status machine", () => {
  it("restores authorized status from a persisted refresh token", () => {
    seedRefreshToken()
    const provider = new TestProvider()
    expect(provider.getPanelStatus()).toBe("authorized")
    expect(provider.getConnectionStatus()).toBe("connected")
    expect(provider.getOccupiedStatus()).toBe("occupied")
  })

  it("starts unauthorized without a refresh token and drops a stale access token", () => {
    seedAccessToken("stale", 3_600_000)
    const provider = new TestProvider()
    expect(provider.getPanelStatus()).toBe("unauthorized")
    expect(provider.getConnectionStatus()).toBe("disconnected")
    expect(provider.getOccupiedStatus()).toBe("available")
    expect(storedAccessToken()).toBeNull()
  })

  it("notifies the panel status handler on status changes", async () => {
    seedRefreshToken()
    const provider = new TestProvider()
    const handler = vi.fn()
    provider.setPanelStatusChangeHandler(handler)
    await provider.disconnect()
    expect(handler).toHaveBeenCalledWith("unauthorized", null)
  })

})

describe("connect / disconnect", () => {
  it("connect is a no-op when a refresh token is already stored", async () => {
    seedRefreshToken()
    const provider = new TestProvider()
    await provider.connect()
    expect(provider.getPanelStatus()).toBe("authorized")
  })

  it("disconnect clears persisted auth and the remote-file cache", async () => {
    seedRefreshToken()
    seedAccessToken("at-1", 3_600_000)
    const provider = new TestProvider()
    await provider.disconnect()
    expect(provider.getPanelStatus()).toBe("unauthorized")
    expect(storedRefreshToken()).toBeNull()
    expect(storedAccessToken()).toBeNull()
    expect(provider.cacheClearCount).toBe(1)
  })
})

describe("getWorkerBaseUrl", () => {
  it("throws missing_worker_url when the env var is empty", () => {
    vi.stubEnv("VITE_AUTH_WORKER_URL", "")
    seedRefreshToken()
    const provider = new TestProvider()
    let caught: unknown
    try {
      internals(provider).getWorkerBaseUrl()
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(WorkerAuthError)
    expect((caught as WorkerAuthError).code).toBe("missing_worker_url")
  })

  it("strips trailing slashes", () => {
    vi.stubEnv("VITE_AUTH_WORKER_URL", "https://auth.test///")
    seedRefreshToken()
    const provider = new TestProvider()
    expect(internals(provider).getWorkerBaseUrl()).toBe("https://auth.test")
  })
})

describe("getAccessToken", () => {
  it("returns a fresh persisted access token without contacting the worker", async () => {
    seedRefreshToken()
    seedAccessToken("at-fresh", 10 * 60_000)
    const provider = new TestProvider()
    await expect(internals(provider).getAccessToken()).resolves.toBe("at-fresh")
  })

  it("treats a token expiring within the 30s skew as stale and refreshes it", async () => {
    seedRefreshToken("rt-1")
    seedAccessToken("at-old", 10_000) // < 30s skew
    let workerBody: unknown = null
    server.use(
      http.post(`${WORKER_URL}/token/google/access`, async ({ request }) => {
        workerBody = await request.json()
        return HttpResponse.json({ access_token: "at-new", expires_in: 1800 })
      })
    )

    const provider = new TestProvider()
    const statuses: SyncPanelStatus[] = []
    const occupiedDuringRefresh: string[] = []
    provider.setPanelStatusChangeHandler((status) => {
      statuses.push(status)
      if (status === "refreshing") {
        occupiedDuringRefresh.push(provider.getOccupiedStatus())
      }
    })

    await expect(internals(provider).getAccessToken()).resolves.toBe("at-new")
    expect(workerBody).toEqual({ refresh_token: "rt-1" })
    expect(statuses).toEqual(["refreshing", "authorized"])
    expect(occupiedDuringRefresh).toEqual(["occupied"])

    const stored = storedAccessToken()
    expect(stored?.accessToken).toBe("at-new")
    const remaining = new Date(stored!.expiresAt).getTime() - Date.now()
    expect(remaining).toBeGreaterThan(1_700_000)
    expect(remaining).toBeLessThanOrEqual(1_800_000)
  })

  it("defaults expires_in to 3600 seconds when the worker omits it", async () => {
    seedRefreshToken()
    server.use(
      http.post(`${WORKER_URL}/token/google/access`, () =>
        HttpResponse.json({ access_token: "at-default" })
      )
    )
    const provider = new TestProvider()
    await internals(provider).getAccessToken()
    const remaining =
      new Date(storedAccessToken()!.expiresAt).getTime() - Date.now()
    expect(remaining).toBeGreaterThan(3_500_000)
    expect(remaining).toBeLessThanOrEqual(3_600_000)
  })

  it("persists a rotated refresh token and uses it on the next refresh", async () => {
    seedRefreshToken("rt-1")
    const receivedRefreshTokens: string[] = []
    server.use(
      http.post(`${WORKER_URL}/token/google/access`, async ({ request }) => {
        const body = (await request.json()) as { refresh_token: string }
        receivedRefreshTokens.push(body.refresh_token)
        return HttpResponse.json({
          access_token: `at-${receivedRefreshTokens.length}`,
          expires_in: 3600,
          refresh_token: `rt-${receivedRefreshTokens.length + 1}`,
        })
      })
    )

    const provider = new TestProvider()
    await internals(provider).getAccessToken()
    expect(storedRefreshToken()).toBe("rt-2")

    // Force a second refresh; it must present the rotated token.
    storage.removeItem(SYNC_ACCESS_TOKEN_STORAGE_KEY)
    await internals(provider).getAccessToken()
    expect(receivedRefreshTokens).toEqual(["rt-1", "rt-2"])
    expect(storedRefreshToken()).toBe("rt-3")
  })

  it("deduplicates concurrent refreshes into a single worker request", async () => {
    seedRefreshToken("rt-1")
    let workerCalls = 0
    server.use(
      http.post(`${WORKER_URL}/token/google/access`, () => {
        workerCalls += 1
        return HttpResponse.json({ access_token: "at-shared" })
      })
    )

    const provider = new TestProvider()
    const tokens = await Promise.all([
      internals(provider).getAccessToken(),
      internals(provider).getAccessToken(),
      internals(provider).getAccessToken(),
    ])
    expect(tokens).toEqual(["at-shared", "at-shared", "at-shared"])
    expect(workerCalls).toBe(1)
  })

  it("re-reads a refresh token rotated by another window before refreshing", async () => {
    seedRefreshToken("rt-old")
    const provider = new TestProvider() // holds rt-old in memory
    // Another window refreshed meanwhile: the stored token rotated.
    seedRefreshToken("rt-rotated")

    let receivedRefreshToken: string | null = null
    server.use(
      http.post(`${WORKER_URL}/token/google/access`, async ({ request }) => {
        receivedRefreshToken = (
          (await request.json()) as { refresh_token: string }
        ).refresh_token
        return HttpResponse.json({ access_token: "at-new" })
      })
    )

    await expect(internals(provider).getAccessToken()).resolves.toBe("at-new")
    expect(receivedRefreshToken).toBe("rt-rotated")
  })

  it("clears auth when another window removed the stored refresh token", async () => {
    seedRefreshToken("rt-1")
    const provider = new TestProvider()
    // Another window disconnected: the key is gone, and this instance's
    // in-memory copy must not resurrect the binding.
    storage.removeItem(SYNC_REFRESH_TOKEN_STORAGE_KEY)

    await expect(internals(provider).getAccessToken()).rejects.toMatchObject({
      code: "reauthorization_required",
    })
    expect(provider.getPanelStatus()).toBe("unauthorized")
  })

  it("throws reauthorization_required when no refresh token exists", async () => {
    const provider = new TestProvider()
    await expect(internals(provider).getAccessToken()).rejects.toMatchObject({
      name: "WorkerAuthError",
      code: "reauthorization_required",
    })
  })

  it("maps an invalid worker payload to invalid_worker_response and stays authorized", async () => {
    seedRefreshToken()
    server.use(
      http.post(`${WORKER_URL}/token/google/access`, () =>
        HttpResponse.json({ access_token: "" })
      )
    )
    const provider = new TestProvider()
    await expect(internals(provider).getAccessToken()).rejects.toMatchObject({
      code: "invalid_worker_response",
    })
    expect(provider.getLastErrorCode()).toBe("sync_unavailable")
    expect(provider.getPanelStatus()).toBe("authorized") // still bound
  })

  it("propagates the worker error code on a non-2xx response", async () => {
    seedRefreshToken()
    server.use(
      http.post(`${WORKER_URL}/token/google/access`, () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 })
      )
    )
    const provider = new TestProvider()
    await expect(internals(provider).getAccessToken()).rejects.toMatchObject({
      code: "invalid_grant",
    })
  })

  it("falls back to worker_request_failed on a non-JSON error response", async () => {
    seedRefreshToken()
    server.use(
      http.post(
        `${WORKER_URL}/token/google/access`,
        () => new HttpResponse("boom", { status: 500 })
      )
    )
    const provider = new TestProvider()
    await expect(internals(provider).getAccessToken()).rejects.toMatchObject({
      code: "worker_request_failed",
    })
  })

  it("marks sync unavailable when the worker request fails at network level", async () => {
    seedRefreshToken()
    server.use(
      http.post(`${WORKER_URL}/token/google/access`, () =>
        HttpResponse.error()
      )
    )
    const provider = new TestProvider()
    await expect(internals(provider).getAccessToken()).rejects.toThrow()
    expect(provider.getLastErrorCode()).toBe("sync_unavailable")
    expect(provider.getPanelStatus()).toBe("authorized")
  })
})

describe("authorizedFetch", () => {
  it("sends the Bearer token and merges custom headers", async () => {
    seedRefreshToken()
    seedAccessToken("at-fresh", 3_600_000)
    let authHeader: string | null = null
    let customHeader: string | null = null
    server.use(
      http.get(`${CLOUD_URL}/files`, ({ request }) => {
        authHeader = request.headers.get("Authorization")
        customHeader = request.headers.get("X-Custom")
        return HttpResponse.json({ files: [] })
      })
    )
    const provider = new TestProvider()
    await internals(provider).authorizedFetch(`${CLOUD_URL}/files`, {
      headers: { "X-Custom": "yes" },
    })
    expect(authHeader).toBe("Bearer at-fresh")
    expect(customHeader).toBe("yes")
  })

  it("on 401 clears the cached token, refreshes, and retries once", async () => {
    seedRefreshToken()
    seedAccessToken("at-stale", 3_600_000)
    const authHeaders: (string | null)[] = []
    let workerCalls = 0
    server.use(
      http.get(`${CLOUD_URL}/files`, ({ request }) => {
        authHeaders.push(request.headers.get("Authorization"))
        if (authHeaders.length === 1) {
          return new HttpResponse(null, { status: 401 })
        }
        return HttpResponse.json({ files: [] })
      }),
      http.post(`${WORKER_URL}/token/google/access`, () => {
        workerCalls += 1
        return HttpResponse.json({ access_token: "at-renewed" })
      })
    )
    const provider = new TestProvider()
    const files = await provider.listDeviceDataFiles()
    expect(files).toEqual([])
    expect(authHeaders).toEqual(["Bearer at-stale", "Bearer at-renewed"])
    expect(workerCalls).toBe(1)
  })

  it("a second 401 maps through readErrorCode and clears auth on reauthorization_required", async () => {
    seedRefreshToken()
    seedAccessToken("at-1", 3_600_000)
    let cloudCalls = 0
    server.use(
      http.get(`${CLOUD_URL}/files`, () => {
        cloudCalls += 1
        return HttpResponse.json(
          { error: "reauthorization_required" },
          { status: 401 }
        )
      }),
      http.post(`${WORKER_URL}/token/google/access`, () =>
        HttpResponse.json({ access_token: "at-2" })
      )
    )
    const provider = new TestProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "reauthorization_required",
    })
    expect(cloudCalls).toBe(2)
    expect(storedRefreshToken()).toBeNull()
    expect(provider.getPanelStatus()).toBe("unauthorized")
  })

  it("returns the 404 response when allow404 is set", async () => {
    seedRefreshToken()
    seedAccessToken("at-1", 3_600_000)
    server.use(
      http.get(
        `${CLOUD_URL}/files/:id`,
        () => new HttpResponse(null, { status: 404 })
      )
    )
    const provider = new TestProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "missing" })
    ).resolves.toBeNull()
  })

  it("maps a 404 without allow404 through readErrorCode", async () => {
    seedRefreshToken()
    seedAccessToken("at-1", 3_600_000)
    server.use(
      http.get(
        `${CLOUD_URL}/files`,
        () => new HttpResponse("gone", { status: 404 })
      )
    )
    const provider = new TestProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "cloud_request_failed",
    })
    expect(provider.getLastErrorCode()).toBe("sync_unavailable")
  })

  it("retries a 429 honouring a numeric Retry-After header", async () => {
    seedRefreshToken()
    seedAccessToken("at-1", 3_600_000)
    let calls = 0
    server.use(
      http.get(`${CLOUD_URL}/files`, () => {
        calls += 1
        if (calls === 1) {
          return new HttpResponse(null, {
            status: 429,
            headers: { "Retry-After": "0.001" },
          })
        }
        return HttpResponse.json({ files: [] })
      })
    )
    const provider = new TestProvider()
    await expect(provider.listDeviceDataFiles()).resolves.toEqual([])
    expect(calls).toBe(2)
  })

  it("retries a 503 the same way as a 429", async () => {
    seedRefreshToken()
    seedAccessToken("at-1", 3_600_000)
    let calls = 0
    server.use(
      http.get(`${CLOUD_URL}/files`, () => {
        calls += 1
        if (calls === 1) {
          return new HttpResponse(null, {
            status: 503,
            headers: { "Retry-After": "0.001" },
          })
        }
        return HttpResponse.json({ files: [] })
      })
    )
    const provider = new TestProvider()
    await expect(provider.listDeviceDataFiles()).resolves.toEqual([])
    expect(calls).toBe(2)
  })

  it("uses exponential backoff when no Retry-After header is present", async () => {
    seedRefreshToken()
    seedAccessToken("at-1", 3_600_000)
    vi.spyOn(Math, "random").mockReturnValue(0) // jitter = 0 → delay exactly 1000ms
    let calls = 0
    server.use(
      http.get(`${CLOUD_URL}/files`, () => {
        calls += 1
        if (calls === 1) {
          return new HttpResponse(null, { status: 429 })
        }
        return HttpResponse.json({ files: [] })
      })
    )
    vi.useFakeTimers()
    const provider = new TestProvider()
    const promise = provider.listDeviceDataFiles()
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(promise).resolves.toEqual([])
    expect(calls).toBe(2)
  })

  it("caps a huge Retry-After at 30 seconds", async () => {
    seedRefreshToken()
    seedAccessToken("at-1", 3_600_000)
    let calls = 0
    server.use(
      http.get(`${CLOUD_URL}/files`, () => {
        calls += 1
        if (calls === 1) {
          return new HttpResponse(null, {
            status: 429,
            headers: { "Retry-After": "600" },
          })
        }
        return HttpResponse.json({ files: [] })
      })
    )
    vi.useFakeTimers()
    const provider = new TestProvider()
    const promise = provider.listDeviceDataFiles()
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(promise).resolves.toEqual([])
    expect(calls).toBe(2)
  })

  it("gives up after 3 retries and maps the final 429 to an error", async () => {
    seedRefreshToken()
    seedAccessToken("at-1", 3_600_000)
    let calls = 0
    server.use(
      http.get(`${CLOUD_URL}/files`, () => {
        calls += 1
        return HttpResponse.json(
          { error: "rate_limited" },
          { status: 429, headers: { "Retry-After": "0.001" } }
        )
      })
    )
    const provider = new TestProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "rate_limited",
    })
    expect(calls).toBe(4) // initial + 3 retries
  })
})

describe("parseJsonResponse", () => {
  it("parses valid JSON and throws invalid_response for a bad body", async () => {
    seedRefreshToken()
    const provider = new TestProvider()
    await expect(
      internals(provider).parseJsonResponse(new Response('{"a":1}'))
    ).resolves.toEqual({ a: 1 })
    await expect(
      internals(provider).parseJsonResponse(new Response("not json"))
    ).rejects.toThrow("Response body was not valid JSON")
  })
})

describe("device data shell", () => {
  beforeEach(() => {
    seedRefreshToken()
    seedAccessToken("at-1", 3_600_000)
  })

  it("readDeviceData parses a valid snapshot", async () => {
    const snapshot = makeSnapshot()
    server.use(
      http.get(`${CLOUD_URL}/files/:id`, () => HttpResponse.json(snapshot))
    )
    const provider = new TestProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "f-1" })
    ).resolves.toEqual(snapshot)
  })

  it("readDeviceData rejects an invalid snapshot with invalid_worker_response", async () => {
    server.use(
      http.get(`${CLOUD_URL}/files/:id`, () =>
        HttpResponse.json({ schemaVersion: 2 })
      )
    )
    const provider = new TestProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "f-1" })
    ).rejects.toMatchObject({ code: "invalid_worker_response" })
  })

  it("writeOwnDeviceData writes the serialized snapshot under the device file name", async () => {
    const snapshot = makeSnapshot("dev-9")
    let putUrl: string | null = null
    let putBody: string | null = null
    server.use(
      http.put(`${CLOUD_URL}/files/by-name/:name`, async ({ request }) => {
        putUrl = request.url
        putBody = await request.text()
        return HttpResponse.json({ ok: true })
      })
    )
    const provider = new TestProvider()
    await provider.writeOwnDeviceData(snapshot)
    expect(putUrl).toBe(`${CLOUD_URL}/files/by-name/track-sync-data-dev-9.json`)
    expect(JSON.parse(putBody!)).toEqual(snapshot)
  })

  it("deleteAllDeviceData deletes every listed file and clears the cache", async () => {
    const deleted: string[] = []
    server.use(
      http.get(`${CLOUD_URL}/files`, () =>
        HttpResponse.json({
          files: [
            { deviceId: "a", fileId: "f-a" },
            { deviceId: "b", fileId: "f-b" },
          ],
        })
      ),
      http.delete(`${CLOUD_URL}/files/:id`, ({ params }) => {
        deleted.push(params.id as string)
        return new HttpResponse(null, { status: 204 })
      })
    )
    const provider = new TestProvider()
    await provider.deleteAllDeviceData()
    expect(deleted).toEqual(["f-a", "f-b"])
    expect(provider.cacheClearCount).toBe(1)
  })
})

describe("clearRemoteCredential", () => {
  it("deletes all device data, revokes the token at the worker, and clears auth", async () => {
    seedRefreshToken("rt-1")
    seedAccessToken("at-1", 3_600_000)
    const deleted: string[] = []
    let revokeBody: unknown = null
    server.use(
      http.get(`${CLOUD_URL}/files`, () =>
        HttpResponse.json({ files: [{ deviceId: "a", fileId: "f-a" }] })
      ),
      http.delete(`${CLOUD_URL}/files/:id`, ({ params }) => {
        deleted.push(params.id as string)
        return new HttpResponse(null, { status: 204 })
      }),
      http.post(`${WORKER_URL}/token/google/revoke`, async ({ request }) => {
        revokeBody = await request.json()
        return HttpResponse.json({ ok: true })
      })
    )
    const provider = new TestProvider()
    await provider.clearRemoteCredential()
    expect(deleted).toEqual(["f-a"])
    expect(revokeBody).toEqual({ refresh_token: "rt-1" })
    expect(storedRefreshToken()).toBeNull()
    expect(storedAccessToken()).toBeNull()
    expect(provider.getPanelStatus()).toBe("unauthorized")
  })

  it("still clears local auth when the worker revoke fails", async () => {
    seedRefreshToken("rt-1")
    seedAccessToken("at-1", 3_600_000)
    server.use(
      http.get(`${CLOUD_URL}/files`, () => HttpResponse.json({ files: [] })),
      http.post(
        `${WORKER_URL}/token/google/revoke`,
        () => new HttpResponse(null, { status: 500 })
      )
    )
    const provider = new TestProvider()
    await expect(provider.clearRemoteCredential()).rejects.toMatchObject({
      code: "revoke_failed",
    })
    expect(storedRefreshToken()).toBeNull()
    expect(provider.getPanelStatus()).toBe("unauthorized")
  })

  it("makes no requests when no refresh token is held", async () => {
    const provider = new TestProvider()
    await provider.clearRemoteCredential() // unhandled requests would error
    expect(provider.getPanelStatus()).toBe("unauthorized")
  })
})
