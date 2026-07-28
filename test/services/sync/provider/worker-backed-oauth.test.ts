// @vitest-environment happy-dom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockInstance,
} from "vitest"
import { WorkerBackedSyncProviderBase } from "@/services/sync/provider/worker-backed-sync-provider"
import {
  SYNC_ACCESS_TOKEN_STORAGE_KEY,
  SYNC_REFRESH_TOKEN_STORAGE_KEY,
} from "@/services/sync/sync-auth-storage"
import { shouldUseFullPageOAuthFlow } from "@/utils/oauth-window"
import type { DeviceFileRef } from "@/services/sync/types"
import type {
  SyncPanelErrorCode,
  SyncPanelStatus,
} from "@/services/sync/sync-panel-types"

// The panel pulls in the sync store / UI tree — irrelevant for the OAuth state
// machine under test, so stub it out.
vi.mock("@/services/sync/provider/worker-backed-provider-panel", () => ({
  WorkerBackedProviderPanel: () => null,
}))

vi.mock("@/utils/oauth-window", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/oauth-window")>()
  return { ...actual, shouldUseFullPageOAuthFlow: vi.fn(() => false) }
})

const mockShouldUseFullPageOAuthFlow = vi.mocked(shouldUseFullPageOAuthFlow)

class TestProvider extends WorkerBackedSyncProviderBase {
  constructor() {
    super("google", "google-drive")
  }
  protected async listDeviceFiles(): Promise<DeviceFileRef[]> {
    return []
  }
  protected async readDeviceFileById(): Promise<unknown | null> {
    return null
  }
  protected async writeDeviceFileByName(): Promise<void> {}
  protected async deleteDeviceFileById(): Promise<void> {}
  protected clearCachedRemoteFiles(): void {}
  protected async readErrorCode(): Promise<string> {
    return "test_error"
  }
}

// Node >= 22 ships a built-in `localStorage` global that is non-functional
// without `--localstorage-file`, and the vitest happy-dom environment keeps it,
// so `window.localStorage` has no usable methods here. Stub a working shim.
function makeStorageShim() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    },
  }
}

interface FakePopup {
  closed: boolean
  close: Mock
  focus: Mock
}

function makeFakePopup(): FakePopup {
  return { closed: false, close: vi.fn(), focus: vi.fn() }
}

function postOAuthMessage(
  data: unknown,
  {
    origin = window.location.origin,
    source,
  }: { origin?: string; source?: unknown } = {}
): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data,
      origin,
      source: source as Window | null,
    })
  )
}

async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
  }
}

describe("WorkerBackedSyncProviderBase OAuth flow", () => {
  let popup: FakePopup
  let openSpy: MockInstance<typeof window.open>
  let assignSpy: MockInstance<typeof window.location.assign>

  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorageShim())
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockShouldUseFullPageOAuthFlow.mockReturnValue(false)
    vi.stubEnv("VITE_AUTH_WORKER_URL", "https://worker.example/")
    popup = makeFakePopup()
    openSpy = vi
      .spyOn(window, "open")
      .mockReturnValue(popup as unknown as Window)
    assignSpy = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("persisted state restore", () => {
    it("constructs as authorized when localStorage holds this provider's refresh token", () => {
      window.localStorage.setItem(
        SYNC_REFRESH_TOKEN_STORAGE_KEY,
        JSON.stringify({ provider: "google", refreshToken: "persisted-rt" })
      )
      const provider = new TestProvider()
      expect(provider.getPanelStatus()).toBe("authorized")
      expect(provider.getConnectionStatus()).toBe("connected")
      expect(provider.getOccupiedStatus()).toBe("occupied")
    })

    it("does not restore another provider's refresh token and clears the leftover access token", () => {
      window.localStorage.setItem(
        SYNC_REFRESH_TOKEN_STORAGE_KEY,
        JSON.stringify({ provider: "onedrive", refreshToken: "other-rt" })
      )
      window.localStorage.setItem(
        SYNC_ACCESS_TOKEN_STORAGE_KEY,
        JSON.stringify({
          provider: "google",
          accessToken: "stale",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        })
      )
      const provider = new TestProvider()
      expect(provider.getPanelStatus()).toBe("unauthorized")
      expect(
        window.localStorage.getItem(SYNC_ACCESS_TOKEN_STORAGE_KEY)
      ).toBeNull()
    })
  })

  describe("connect", () => {
    it("connect is a no-op without opening a popup when a refresh token is already held", async () => {
      window.localStorage.setItem(
        SYNC_REFRESH_TOKEN_STORAGE_KEY,
        JSON.stringify({ provider: "google", refreshToken: "persisted-rt" })
      )
      const provider = new TestProvider()
      await provider.connect()
      expect(provider.getPanelStatus()).toBe("authorized")
      expect(openSpy).not.toHaveBeenCalled()
    })

    it("connected message: persists the refresh token and enters authorized", async () => {
      const provider = new TestProvider()
      const transitions: Array<{
        status: SyncPanelStatus
        errorCode: SyncPanelErrorCode | null
      }> = []
      provider.setPanelStatusChangeHandler((status, errorCode) => {
        transitions.push({ status, errorCode })
      })

      const connectPromise = provider.connect()

      // While the popup is open: authorizing / connecting / available
      expect(provider.getPanelStatus()).toBe("authorizing")
      expect(provider.getConnectionStatus()).toBe("connecting")
      expect(provider.getOccupiedStatus()).toBe("available")
      // The trailing slash is stripped before building /auth/google/start
      expect(openSpy).toHaveBeenCalledWith(
        "https://worker.example/auth/google/start",
        "google-oauth",
        "width=500,height=600,left=200,top=100"
      )

      postOAuthMessage(
        {
          type: "oauth:connected",
          provider: "google",
          refresh_token: "fresh-rt",
        },
        { source: popup }
      )
      await connectPromise

      expect(provider.getPanelStatus()).toBe("authorized")
      expect(provider.getConnectionStatus()).toBe("connected")
      expect(provider.getOccupiedStatus()).toBe("occupied")
      expect(provider.getLastErrorCode()).toBeNull()
      expect(
        JSON.parse(
          window.localStorage.getItem(SYNC_REFRESH_TOKEN_STORAGE_KEY) ?? "null"
        )
      ).toEqual({ provider: "google", refreshToken: "fresh-rt" })
      expect(transitions).toEqual([
        { status: "authorizing", errorCode: null },
        { status: "authorized", errorCode: null },
      ])
    })

    it("cleans up the listener and poll timer after connected", async () => {
      vi.useFakeTimers()
      const provider = new TestProvider()
      const connectPromise = provider.connect()
      expect(vi.getTimerCount()).toBe(1)

      postOAuthMessage(
        { type: "oauth:connected", provider: "google", refresh_token: "rt" },
        { source: popup }
      )
      await connectPromise
      expect(vi.getTimerCount()).toBe(0)

      // Listener removed: a later cancelled message no longer affects the state
      postOAuthMessage(
        { type: "oauth:cancelled", provider: "google" },
        { source: popup }
      )
      popup.closed = true
      await vi.advanceTimersByTimeAsync(2_000)
      expect(provider.getPanelStatus()).toBe("authorized")
    })

    it("cancelled message: back to unauthorized with no error code (user gave up)", async () => {
      const provider = new TestProvider()
      const connectPromise = provider.connect()
      postOAuthMessage(
        { type: "oauth:cancelled", provider: "google" },
        { source: popup }
      )
      await connectPromise
      expect(provider.getPanelStatus()).toBe("unauthorized")
      expect(provider.getLastErrorCode()).toBeNull()
      expect(
        window.localStorage.getItem(SYNC_REFRESH_TOKEN_STORAGE_KEY)
      ).toBeNull()
    })

    it("error message (any error code): records authorization_failed", async () => {
      const provider = new TestProvider()
      const connectPromise = provider.connect()
      postOAuthMessage(
        {
          type: "oauth:error",
          provider: "google",
          error: "server_exploded",
          recoverable: false,
        },
        { source: popup }
      )
      await connectPromise
      expect(provider.getPanelStatus()).toBe("unauthorized")
      expect(provider.getLastErrorCode()).toBe("authorization_failed")
    })

    it("access_denied error message: treated as a user refusal, no error code", async () => {
      const provider = new TestProvider()
      const connectPromise = provider.connect()
      postOAuthMessage(
        {
          type: "oauth:error",
          provider: "google",
          error: "access_denied",
          recoverable: true,
        },
        { source: popup }
      )
      await connectPromise
      expect(provider.getPanelStatus()).toBe("unauthorized")
      expect(provider.getLastErrorCode()).toBeNull()
    })

    it("error message without an error field: falls back to oauth_error, records authorization_failed", async () => {
      const provider = new TestProvider()
      const connectPromise = provider.connect()
      postOAuthMessage(
        { type: "oauth:error", provider: "google" },
        { source: popup }
      )
      await connectPromise
      expect(provider.getPanelStatus()).toBe("unauthorized")
      expect(provider.getLastErrorCode()).toBe("authorization_failed")
    })

    it("ignores messages with a mismatched schema / origin / source", async () => {
      const provider = new TestProvider()
      let settled = false
      const connectPromise = provider.connect().finally(() => {
        settled = true
      })

      // provider literal mismatch
      postOAuthMessage(
        { type: "oauth:connected", provider: "onedrive", refresh_token: "x" },
        { source: popup }
      )
      // unknown type
      postOAuthMessage({ type: "totally-unrelated" }, { source: popup })
      // empty refresh_token (rejected by min(1))
      postOAuthMessage(
        { type: "oauth:connected", provider: "google", refresh_token: "" },
        { source: popup }
      )
      // wrong origin
      postOAuthMessage(
        { type: "oauth:connected", provider: "google", refresh_token: "evil" },
        { origin: "https://evil.example", source: popup }
      )
      // source is not the popup
      postOAuthMessage(
        { type: "oauth:connected", provider: "google", refresh_token: "spoof" },
        { source: { closed: false } }
      )

      await flushMicrotasks()
      expect(settled).toBe(false)
      expect(provider.getPanelStatus()).toBe("authorizing")

      postOAuthMessage(
        { type: "oauth:connected", provider: "google", refresh_token: "real" },
        { source: popup }
      )
      await connectPromise
      expect(provider.getPanelStatus()).toBe("authorized")
      expect(
        JSON.parse(
          window.localStorage.getItem(SYNC_REFRESH_TOKEN_STORAGE_KEY) ?? "null"
        )
      ).toEqual({ provider: "google", refreshToken: "real" })
    })

    it("user closes the popup: the 500ms poll notices and returns to unauthorized, no error code", async () => {
      vi.useFakeTimers()
      const provider = new TestProvider()
      const connectPromise = provider.connect()

      await vi.advanceTimersByTimeAsync(500)
      expect(provider.getPanelStatus()).toBe("authorizing")

      popup.closed = true
      await vi.advanceTimersByTimeAsync(500)
      await connectPromise

      expect(provider.getPanelStatus()).toBe("unauthorized")
      expect(provider.getLastErrorCode()).toBeNull()
      expect(vi.getTimerCount()).toBe(0)
    })

    it("window.open blocked (null): falls back to a full-page redirect, promise stays pending", async () => {
      openSpy.mockReturnValue(null)
      const provider = new TestProvider()
      let settled = false
      void provider.connect().finally(() => {
        settled = true
      })

      await flushMicrotasks()
      expect(assignSpy).toHaveBeenCalledWith(
        "https://worker.example/auth/google/start"
      )
      expect(settled).toBe(false)
      expect(provider.getPanelStatus()).toBe("authorizing")
    })

    it("shouldUseFullPageOAuthFlow true: redirects the full page without opening a popup", async () => {
      mockShouldUseFullPageOAuthFlow.mockReturnValue(true)
      const provider = new TestProvider()
      let settled = false
      void provider.connect().finally(() => {
        settled = true
      })

      await flushMicrotasks()
      expect(openSpy).not.toHaveBeenCalled()
      expect(assignSpy).toHaveBeenCalledWith(
        "https://worker.example/auth/google/start"
      )
      expect(settled).toBe(false)
    })

    it("missing VITE_AUTH_WORKER_URL: connect fails and records authorization_failed", async () => {
      vi.stubEnv("VITE_AUTH_WORKER_URL", "")
      const provider = new TestProvider()
      await provider.connect()
      expect(provider.getPanelStatus()).toBe("unauthorized")
      expect(provider.getLastErrorCode()).toBe("authorization_failed")
      expect(openSpy).not.toHaveBeenCalled()
    })
  })

  describe("disconnect", () => {
    it("clears local credentials and returns to unauthorized", async () => {
      const provider = new TestProvider()
      const connectPromise = provider.connect()
      postOAuthMessage(
        { type: "oauth:connected", provider: "google", refresh_token: "rt" },
        { source: popup }
      )
      await connectPromise
      expect(provider.getPanelStatus()).toBe("authorized")

      await provider.disconnect()
      expect(provider.getPanelStatus()).toBe("unauthorized")
      expect(provider.getOccupiedStatus()).toBe("available")
      expect(
        window.localStorage.getItem(SYNC_REFRESH_TOKEN_STORAGE_KEY)
      ).toBeNull()
      expect(
        window.localStorage.getItem(SYNC_ACCESS_TOKEN_STORAGE_KEY)
      ).toBeNull()
    })
  })
})
