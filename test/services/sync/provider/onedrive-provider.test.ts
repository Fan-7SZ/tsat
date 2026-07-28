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

import { OneDriveProvider } from "@/services/sync/provider/onedrive-provider/onedrive-provider"
import {
  SYNC_ACCESS_TOKEN_STORAGE_KEY,
  SYNC_REFRESH_TOKEN_STORAGE_KEY,
} from "@/services/sync/sync-auth-storage"
import type { DeviceSnapshot } from "@/services/sync/types"

const WORKER_URL = "https://auth.test"
const GRAPH_URL = "https://graph.microsoft.com/v1.0"
const APPROOT_URL = `${GRAPH_URL}/me/drive/special/approot`
const CHILDREN_URL = `${GRAPH_URL}/me/drive/special/approot/children`
const ITEM_URL = `${GRAPH_URL}/me/drive/items/:fileId`
const DOWNLOAD_URL = "https://download.test/content/f-1"

function createLocalStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  }
}

let storage: ReturnType<typeof createLocalStorage>

function seedAuth() {
  storage.setItem(
    SYNC_REFRESH_TOKEN_STORAGE_KEY,
    JSON.stringify({ provider: "onedrive", refreshToken: "rt-1" })
  )
  storage.setItem(
    SYNC_ACCESS_TOKEN_STORAGE_KEY,
    JSON.stringify({
      provider: "onedrive",
      accessToken: "at-fresh",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
  )
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
  seedAuth()
})

afterEach(() => {
  server.resetHandlers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

afterAll(() => {
  server.close()
})

describe("listDeviceDataFiles", () => {
  it("lists the approot children and maps device files, skipping foreign names", async () => {
    let listUrl: URL | null = null
    let authHeader: string | null = null
    server.use(
      http.get(CHILDREN_URL, ({ request }) => {
        listUrl = new URL(request.url)
        authHeader = request.headers.get("Authorization")
        return HttpResponse.json({
          value: [
            { id: "i-1", name: "track-sync-data-dev-1.json", eTag: "etag-1" },
            { id: "i-2", name: "unrelated.txt" },
            // Starts with the prefix but is not a valid device file name.
            { id: "i-3", name: "track-sync-data-partial" },
            { id: "i-4", name: "track-sync-data-dev-4.json" },
          ],
        })
      })
    )

    const provider = new OneDriveProvider()
    const refs = await provider.listDeviceDataFiles()

    expect(refs).toEqual([
      { deviceId: "dev-1", fileId: "i-1", changeToken: "etag-1" },
      { deviceId: "dev-4", fileId: "i-4", changeToken: undefined },
    ])
    expect(listUrl!.searchParams.get("$select")).toBe("id,name,eTag")
    expect(listUrl!.searchParams.get("$top")).toBe("1000")
    expect(authHeader).toBe("Bearer at-fresh")
  })

  it("rejects an invalid list payload with invalid_worker_response", async () => {
    server.use(
      http.get(CHILDREN_URL, () => HttpResponse.json({ value: [{ id: "" }] }))
    )
    const provider = new OneDriveProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      name: "WorkerAuthError",
      code: "invalid_worker_response",
    })
  })
})

describe("readDeviceData", () => {
  it("resolves the download URL from $select metadata and downloads the snapshot", async () => {
    const snapshot = makeSnapshot()
    let metadataUrl: URL | null = null
    let preferHeader: string | null = null
    let downloadAccept: string | null = null
    server.use(
      http.get(ITEM_URL, ({ request }) => {
        metadataUrl = new URL(request.url)
        preferHeader = request.headers.get("Prefer")
        return HttpResponse.json({
          id: "f-1",
          "@microsoft.graph.downloadUrl": DOWNLOAD_URL,
        })
      }),
      http.get(DOWNLOAD_URL, ({ request }) => {
        downloadAccept = request.headers.get("Accept")
        return HttpResponse.json(snapshot)
      })
    )

    const provider = new OneDriveProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "f-1" })
    ).resolves.toEqual(snapshot)
    expect(metadataUrl!.pathname).toBe("/v1.0/me/drive/items/f-1")
    expect(metadataUrl!.searchParams.get("$select")).toBe(
      "id,name,@microsoft.graph.downloadUrl"
    )
    expect(metadataUrl!.searchParams.get("_ts")).toMatch(/^\d+$/)
    expect(preferHeader).toBe('odata.include-annotations="*"')
    expect(downloadAccept).toBe("application/json")
  })

  it("falls back to a select-less metadata request when $select omits the download URL", async () => {
    const snapshot = makeSnapshot()
    const metadataSelects: (string | null)[] = []
    server.use(
      http.get(ITEM_URL, ({ request }) => {
        const select = new URL(request.url).searchParams.get("$select")
        metadataSelects.push(select)
        if (select !== null) {
          return HttpResponse.json({ id: "f-1" })
        }
        return HttpResponse.json({
          id: "f-1",
          "@microsoft.graph.downloadUrl": DOWNLOAD_URL,
        })
      }),
      http.get(DOWNLOAD_URL, () => HttpResponse.json(snapshot))
    )

    const provider = new OneDriveProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "f-1" })
    ).resolves.toEqual(snapshot)
    expect(metadataSelects).toEqual(["id,name,@microsoft.graph.downloadUrl", null])
  })

  it("rejects when neither metadata variant includes a download URL", async () => {
    server.use(http.get(ITEM_URL, () => HttpResponse.json({ id: "f-1" })))
    const provider = new OneDriveProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "f-1" })
    ).rejects.toMatchObject({ code: "invalid_worker_response" })
  })

  it("returns null when the file metadata is missing (404)", async () => {
    server.use(
      http.get(ITEM_URL, () => new HttpResponse(null, { status: 404 }))
    )
    const provider = new OneDriveProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "gone" })
    ).resolves.toBeNull()
  })

  it("returns null when the download URL itself 404s", async () => {
    server.use(
      http.get(ITEM_URL, () =>
        HttpResponse.json({
          id: "f-1",
          "@microsoft.graph.downloadUrl": DOWNLOAD_URL,
        })
      ),
      http.get(DOWNLOAD_URL, () => new HttpResponse(null, { status: 404 }))
    )
    const provider = new OneDriveProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "f-1" })
    ).resolves.toBeNull()
  })

  it("rejects with drive_request_failed when the download fails", async () => {
    server.use(
      http.get(ITEM_URL, () =>
        HttpResponse.json({
          id: "f-1",
          "@microsoft.graph.downloadUrl": DOWNLOAD_URL,
        })
      ),
      http.get(DOWNLOAD_URL, () => new HttpResponse(null, { status: 500 }))
    )
    const provider = new OneDriveProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "f-1" })
    ).rejects.toMatchObject({ code: "drive_request_failed" })
  })

  it("rejects invalid metadata with invalid_worker_response", async () => {
    server.use(http.get(ITEM_URL, () => HttpResponse.json({ nope: true })))
    const provider = new OneDriveProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "f-1" })
    ).rejects.toMatchObject({ code: "invalid_worker_response" })
  })
})

describe("writeOwnDeviceData", () => {
  it("resolves the app root once and PUTs the file content under it", async () => {
    const requests: string[] = []
    let putUrl: string | null = null
    let putContentType: string | null = null
    let putBody: string | null = null
    server.use(
      http.get(APPROOT_URL, () => {
        requests.push("approot")
        return HttpResponse.json({ id: "root-1" })
      }),
      http.put(`${GRAPH_URL}/me/drive/items/*`, async ({ request }) => {
        requests.push("put")
        putUrl = request.url
        putContentType = request.headers.get("Content-Type")
        putBody = await request.text()
        return HttpResponse.json({ id: "item-1" })
      })
    )

    const snapshot = makeSnapshot("dev-1")
    const provider = new OneDriveProvider()
    await provider.writeOwnDeviceData(snapshot)
    await provider.writeOwnDeviceData(snapshot)

    // The app root id is cached after the first write.
    expect(requests).toEqual(["approot", "put", "put"])
    expect(putUrl).toBe(
      `${GRAPH_URL}/me/drive/items/root-1:/track-sync-data-dev-1.json:/content`
    )
    expect(putContentType).toBe("application/json; charset=UTF-8")
    expect(JSON.parse(putBody!)).toEqual(snapshot)
  })

  it("rejects an invalid write response with invalid_worker_response", async () => {
    server.use(
      http.get(APPROOT_URL, () => HttpResponse.json({ id: "root-1" })),
      http.put(`${GRAPH_URL}/me/drive/items/*`, () =>
        HttpResponse.json({ ok: true })
      )
    )
    const provider = new OneDriveProvider()
    await expect(
      provider.writeOwnDeviceData(makeSnapshot("dev-1"))
    ).rejects.toMatchObject({ code: "invalid_worker_response" })
  })

  it("rejects an invalid app root response with invalid_worker_response", async () => {
    server.use(http.get(APPROOT_URL, () => HttpResponse.json({ nope: 1 })))
    const provider = new OneDriveProvider()
    await expect(
      provider.writeOwnDeviceData(makeSnapshot("dev-1"))
    ).rejects.toMatchObject({ code: "invalid_worker_response" })
  })
})

describe("deleteAllDeviceData", () => {
  it("deletes every listed file, tolerating a 404, and clears the app root cache", async () => {
    const requests: string[] = []
    server.use(
      http.get(CHILDREN_URL, () => {
        requests.push("list")
        return HttpResponse.json({
          value: [
            { id: "i-1", name: "track-sync-data-dev-1.json" },
            { id: "i-2", name: "track-sync-data-dev-2.json" },
          ],
        })
      }),
      http.delete(ITEM_URL, ({ params }) => {
        requests.push(`delete:${params.fileId as string}`)
        if (params.fileId === "i-2") {
          // Already gone — allow404 makes this a success.
          return new HttpResponse(null, { status: 404 })
        }
        return new HttpResponse(null, { status: 204 })
      }),
      http.get(APPROOT_URL, () => {
        requests.push("approot")
        return HttpResponse.json({ id: "root-2" })
      }),
      http.put(`${GRAPH_URL}/me/drive/items/*`, () => {
        requests.push("put")
        return HttpResponse.json({ id: "item-1" })
      })
    )

    const provider = new OneDriveProvider()
    // Prime the app root cache, then verify deleteAllDeviceData clears it.
    await provider.writeOwnDeviceData(makeSnapshot("dev-1"))
    await provider.deleteAllDeviceData()
    await provider.writeOwnDeviceData(makeSnapshot("dev-1"))

    expect(requests).toEqual([
      "approot",
      "put",
      "list",
      "delete:i-1",
      "delete:i-2",
      "approot",
      "put",
    ])
  })
})

describe("error mapping (readErrorCode)", () => {
  it("maps a 403 accessDenied graph code to drive_access_denied and clears auth", async () => {
    server.use(
      http.get(CHILDREN_URL, () =>
        HttpResponse.json(
          { error: { code: "accessDenied", message: "Access denied" } },
          { status: 403 }
        )
      )
    )
    const provider = new OneDriveProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "drive_access_denied",
    })
    expect(storage.getItem(SYNC_REFRESH_TOKEN_STORAGE_KEY)).toBeNull()
    expect(provider.getPanelStatus()).toBe("unauthorized")
  })

  it("maps other 403 graph codes to drive_request_failed and stays authorized", async () => {
    server.use(
      http.get(CHILDREN_URL, () =>
        HttpResponse.json(
          { error: { code: "activityLimitReached" } },
          { status: 403 }
        )
      )
    )
    const provider = new OneDriveProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "drive_request_failed",
    })
    expect(provider.getLastErrorCode()).toBe("sync_unavailable")
    expect(provider.getPanelStatus()).toBe("authorized")
  })

  it("maps a non-JSON 500 to drive_request_failed", async () => {
    server.use(
      http.get(
        CHILDREN_URL,
        () => new HttpResponse("Server error", { status: 500 })
      )
    )
    const provider = new OneDriveProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "drive_request_failed",
    })
  })

  it("refreshes once on 401 (rotating the refresh token), then maps a repeated 401", async () => {
    let graphCalls = 0
    let workerBody: unknown = null
    server.use(
      http.get(CHILDREN_URL, () => {
        graphCalls += 1
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(
        `${WORKER_URL}/token/onedrive/access`,
        async ({ request }) => {
          workerBody = await request.json()
          return HttpResponse.json({
            access_token: "at-new",
            expires_in: 3600,
            refresh_token: "rt-rotated",
          })
        }
      )
    )
    const provider = new OneDriveProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "reauthorization_required",
    })
    expect(graphCalls).toBe(2)
    expect(workerBody).toEqual({ refresh_token: "rt-1" })
    // The rotated token was persisted before the second 401 cleared auth.
    expect(storage.getItem(SYNC_REFRESH_TOKEN_STORAGE_KEY)).toBeNull()
    expect(provider.getPanelStatus()).toBe("unauthorized")
  })
})
