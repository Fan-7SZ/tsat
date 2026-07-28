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

import { GoogleDriveProvider } from "@/services/sync/provider/google-provider/google-drive-provider"
import {
  SYNC_ACCESS_TOKEN_STORAGE_KEY,
  SYNC_REFRESH_TOKEN_STORAGE_KEY,
} from "@/services/sync/sync-auth-storage"
import type { DeviceSnapshot } from "@/services/sync/types"

const WORKER_URL = "https://auth.test"
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"

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
    JSON.stringify({ provider: "google", refreshToken: "rt-1" })
  )
  storage.setItem(
    SYNC_ACCESS_TOKEN_STORAGE_KEY,
    JSON.stringify({
      provider: "google",
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
  it("queries the appDataFolder and maps device files, skipping foreign names", async () => {
    let listUrl: URL | null = null
    server.use(
      http.get(DRIVE_FILES_URL, ({ request }) => {
        listUrl = new URL(request.url)
        return HttpResponse.json({
          files: [
            {
              id: "f-1",
              name: "track-sync-data-dev-1.json",
              md5Checksum: "md5-1",
            },
            { id: "f-2", name: "unrelated.txt" },
            { id: "f-3", name: "track-sync-data-dev-3.json" },
          ],
        })
      })
    )

    const provider = new GoogleDriveProvider()
    const refs = await provider.listDeviceDataFiles()

    expect(refs).toEqual([
      { deviceId: "dev-1", fileId: "f-1", changeToken: "md5-1" },
      { deviceId: "dev-3", fileId: "f-3", changeToken: undefined },
    ])
    expect(listUrl!.searchParams.get("spaces")).toBe("appDataFolder")
    expect(listUrl!.searchParams.get("pageSize")).toBe("1000")
    expect(listUrl!.searchParams.get("fields")).toBe("files(id,name,md5Checksum)")
    expect(listUrl!.searchParams.get("q")).toBe(
      "name contains 'track-sync-data-' and trashed = false"
    )
  })

  it("primes the name → id cache so a later write skips the lookup", async () => {
    const requests: string[] = []
    server.use(
      http.get(DRIVE_FILES_URL, () => {
        requests.push("list")
        return HttpResponse.json({
          files: [{ id: "f-1", name: "track-sync-data-dev-1.json" }],
        })
      }),
      http.patch(`${DRIVE_UPLOAD_URL}/:fileId`, ({ params }) => {
        requests.push(`patch:${params.fileId as string}`)
        return HttpResponse.json({ id: params.fileId })
      })
    )

    const provider = new GoogleDriveProvider()
    await provider.listDeviceDataFiles()
    await provider.writeOwnDeviceData(makeSnapshot("dev-1"))
    // No second "list" (name lookup) request: the cached id was used directly.
    expect(requests).toEqual(["list", "patch:f-1"])
  })

  it("rejects an invalid list payload with invalid_worker_response", async () => {
    server.use(
      http.get(DRIVE_FILES_URL, () => HttpResponse.json({ files: "nope" }))
    )
    const provider = new GoogleDriveProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      name: "WorkerAuthError",
      code: "invalid_worker_response",
    })
  })
})

describe("readDeviceData", () => {
  it("downloads the file with alt=media and parses the snapshot", async () => {
    const snapshot = makeSnapshot()
    let readUrl: URL | null = null
    let authHeader: string | null = null
    server.use(
      http.get(`${DRIVE_FILES_URL}/:fileId`, ({ request }) => {
        readUrl = new URL(request.url)
        authHeader = request.headers.get("Authorization")
        return HttpResponse.json(snapshot)
      })
    )
    const provider = new GoogleDriveProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "f-1" })
    ).resolves.toEqual(snapshot)
    expect(readUrl!.pathname).toBe("/drive/v3/files/f-1")
    expect(readUrl!.searchParams.get("alt")).toBe("media")
    expect(authHeader).toBe("Bearer at-fresh")
  })

  it("returns null when the file is missing (404)", async () => {
    server.use(
      http.get(
        `${DRIVE_FILES_URL}/:fileId`,
        () => new HttpResponse(null, { status: 404 })
      )
    )
    const provider = new GoogleDriveProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "gone" })
    ).resolves.toBeNull()
  })

  it("rejects a malformed snapshot with invalid_worker_response", async () => {
    server.use(
      http.get(`${DRIVE_FILES_URL}/:fileId`, () =>
        HttpResponse.json({ deviceId: "dev-1" })
      )
    )
    const provider = new GoogleDriveProvider()
    await expect(
      provider.readDeviceData({ deviceId: "dev-1", fileId: "f-1" })
    ).rejects.toMatchObject({ code: "invalid_worker_response" })
  })
})

describe("writeOwnDeviceData", () => {
  it("creates a new multipart file when the name lookup finds nothing", async () => {
    let lookupUrl: URL | null = null
    let createUrl: URL | null = null
    let createContentType: string | null = null
    let createBody: string | null = null
    server.use(
      http.get(DRIVE_FILES_URL, ({ request }) => {
        lookupUrl = new URL(request.url)
        return HttpResponse.json({ files: [] })
      }),
      http.post(DRIVE_UPLOAD_URL, async ({ request }) => {
        createUrl = new URL(request.url)
        createContentType = request.headers.get("Content-Type")
        createBody = await request.text()
        return HttpResponse.json({ id: "created-1" })
      })
    )

    const snapshot = makeSnapshot("dev-1")
    const provider = new GoogleDriveProvider()
    await provider.writeOwnDeviceData(snapshot)

    expect(lookupUrl!.searchParams.get("q")).toBe(
      "name = 'track-sync-data-dev-1.json' and trashed = false"
    )
    expect(lookupUrl!.searchParams.get("pageSize")).toBe("1")
    expect(createUrl!.searchParams.get("uploadType")).toBe("multipart")
    expect(createUrl!.searchParams.get("fields")).toBe("id")
    expect(createContentType).toMatch(
      /^multipart\/related; boundary=track-sync-/
    )
    expect(createBody).toContain('"name":"track-sync-data-dev-1.json"')
    expect(createBody).toContain('"parents":["appDataFolder"]')
    expect(createBody).toContain(JSON.stringify(snapshot))
  })

  it("caches the created id: the next write updates without a lookup", async () => {
    const requests: string[] = []
    server.use(
      http.get(DRIVE_FILES_URL, () => {
        requests.push("lookup")
        return HttpResponse.json({ files: [] })
      }),
      http.post(DRIVE_UPLOAD_URL, () => {
        requests.push("create")
        return HttpResponse.json({ id: "created-1" })
      }),
      http.patch(`${DRIVE_UPLOAD_URL}/:fileId`, ({ params, request }) => {
        const url = new URL(request.url)
        requests.push(
          `update:${params.fileId as string}:${url.searchParams.get("uploadType")}`
        )
        return HttpResponse.json({ id: params.fileId })
      })
    )

    const provider = new GoogleDriveProvider()
    await provider.writeOwnDeviceData(makeSnapshot("dev-1"))
    await provider.writeOwnDeviceData(makeSnapshot("dev-1"))
    expect(requests).toEqual(["lookup", "create", "update:created-1:media"])
  })

  it("updates in place when the name lookup finds an existing file", async () => {
    const requests: string[] = []
    let updateBody: string | null = null
    server.use(
      http.get(DRIVE_FILES_URL, () => {
        requests.push("lookup")
        return HttpResponse.json({ files: [{ id: "exist-9" }] })
      }),
      http.patch(`${DRIVE_UPLOAD_URL}/:fileId`, async ({ params, request }) => {
        requests.push(`update:${params.fileId as string}`)
        updateBody = await request.text()
        return HttpResponse.json({ id: params.fileId })
      })
    )

    const snapshot = makeSnapshot("dev-1")
    const provider = new GoogleDriveProvider()
    await provider.writeOwnDeviceData(snapshot)
    expect(requests).toEqual(["lookup", "update:exist-9"])
    expect(JSON.parse(updateBody!)).toEqual(snapshot)
  })

  it("falls back to create when the update hits a stale id (404)", async () => {
    const requests: string[] = []
    server.use(
      http.get(DRIVE_FILES_URL, () => {
        requests.push("lookup")
        return HttpResponse.json({ files: [{ id: "stale-1" }] })
      }),
      http.patch(`${DRIVE_UPLOAD_URL}/:fileId`, () => {
        requests.push("update")
        return new HttpResponse(null, { status: 404 })
      }),
      http.post(DRIVE_UPLOAD_URL, () => {
        requests.push("create")
        return HttpResponse.json({ id: "recreated-1" })
      })
    )

    const provider = new GoogleDriveProvider()
    await provider.writeOwnDeviceData(makeSnapshot("dev-1"))
    expect(requests).toEqual(["lookup", "update", "create"])
  })

  it("rejects an invalid create response with invalid_worker_response", async () => {
    server.use(
      http.get(DRIVE_FILES_URL, () => HttpResponse.json({ files: [] })),
      http.post(DRIVE_UPLOAD_URL, () => HttpResponse.json({ ok: true }))
    )
    const provider = new GoogleDriveProvider()
    await expect(
      provider.writeOwnDeviceData(makeSnapshot("dev-1"))
    ).rejects.toMatchObject({ code: "invalid_worker_response" })
  })

  it("rejects an invalid lookup response with invalid_worker_response", async () => {
    server.use(
      http.get(DRIVE_FILES_URL, () => HttpResponse.json({ files: 42 }))
    )
    const provider = new GoogleDriveProvider()
    await expect(
      provider.writeOwnDeviceData(makeSnapshot("dev-1"))
    ).rejects.toMatchObject({ code: "invalid_worker_response" })
  })
})

describe("deleteAllDeviceData", () => {
  it("deletes every device file and clears the name cache", async () => {
    const requests: string[] = []
    server.use(
      http.get(DRIVE_FILES_URL, ({ request }) => {
        const q = new URL(request.url).searchParams.get("q") ?? ""
        if (q.startsWith("name contains")) {
          requests.push("list")
          return HttpResponse.json({
            files: [
              { id: "f-1", name: "track-sync-data-dev-1.json" },
              { id: "f-2", name: "track-sync-data-dev-2.json" },
            ],
          })
        }
        requests.push("lookup")
        return HttpResponse.json({ files: [] })
      }),
      http.delete(`${DRIVE_FILES_URL}/:fileId`, ({ params }) => {
        requests.push(`delete:${params.fileId as string}`)
        return new HttpResponse(null, { status: 204 })
      }),
      http.post(DRIVE_UPLOAD_URL, () => {
        requests.push("create")
        return HttpResponse.json({ id: "new-1" })
      })
    )

    const provider = new GoogleDriveProvider()
    await provider.deleteAllDeviceData()
    // Cache was cleared: a follow-up write must look the name up again.
    await provider.writeOwnDeviceData(makeSnapshot("dev-1"))
    expect(requests).toEqual([
      "list",
      "delete:f-1",
      "delete:f-2",
      "lookup",
      "create",
    ])
  })
})

describe("error mapping (readErrorCode)", () => {
  it("maps a 403 access reason to drive_access_denied and clears auth", async () => {
    server.use(
      http.get(DRIVE_FILES_URL, () =>
        HttpResponse.json(
          {
            error: {
              code: 403,
              message: "The user has not granted the app access",
              errors: [{ reason: "accessNotConfigured" }],
            },
          },
          { status: 403 }
        )
      )
    )
    const provider = new GoogleDriveProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "drive_access_denied",
    })
    expect(storage.getItem(SYNC_REFRESH_TOKEN_STORAGE_KEY)).toBeNull()
    expect(provider.getPanelStatus()).toBe("unauthorized")
  })

  it("maps other 403 reasons to drive_request_failed and stays authorized", async () => {
    server.use(
      http.get(DRIVE_FILES_URL, () =>
        HttpResponse.json(
          { error: { code: 403, errors: [{ reason: "rateLimitExceeded" }] } },
          { status: 403 }
        )
      )
    )
    const provider = new GoogleDriveProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "drive_request_failed",
    })
    expect(provider.getLastErrorCode()).toBe("sync_unavailable")
    expect(provider.getPanelStatus()).toBe("authorized")
  })

  it("maps a non-JSON 500 to drive_request_failed", async () => {
    server.use(
      http.get(
        DRIVE_FILES_URL,
        () => new HttpResponse("Internal error", { status: 500 })
      )
    )
    const provider = new GoogleDriveProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "drive_request_failed",
    })
  })

  it("refreshes once on 401, then maps a repeated 401 to reauthorization_required", async () => {
    let driveCalls = 0
    let workerCalls = 0
    server.use(
      http.get(DRIVE_FILES_URL, () => {
        driveCalls += 1
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${WORKER_URL}/token/google/access`, () => {
        workerCalls += 1
        return HttpResponse.json({ access_token: "at-new", expires_in: 3600 })
      })
    )
    const provider = new GoogleDriveProvider()
    await expect(provider.listDeviceDataFiles()).rejects.toMatchObject({
      code: "reauthorization_required",
    })
    expect(driveCalls).toBe(2)
    expect(workerCalls).toBe(1)
    expect(storage.getItem(SYNC_REFRESH_TOKEN_STORAGE_KEY)).toBeNull()
    expect(provider.getPanelStatus()).toBe("unauthorized")
  })
})
