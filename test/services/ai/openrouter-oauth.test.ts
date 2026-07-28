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
import {
  connectOpenRouter,
  exchangeOpenRouterCode,
  hasStoredOpenRouterVerifier,
} from "@/services/ai/openrouter-oauth"

const VERIFIER_STORAGE_KEY = "track-openrouter-code-verifier"

// Node >= 22 ships built-in (partly non-functional) web storage globals that the
// vitest happy-dom environment keeps, so stub a working in-memory shim.
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

/** Wait (with REAL setTimeout) until cond is true. */
async function waitUntil(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !cond(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  expect(cond()).toBe(true)
}

async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return window
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

function okKeyResponse(key: string) {
  return { ok: true, json: async () => ({ key }) }
}

describe("openrouter-oauth", () => {
  let sessionShim: ReturnType<typeof makeStorageShim>
  let assignSpy: MockInstance<typeof window.location.assign>
  let fetchMock: Mock

  beforeEach(() => {
    sessionShim = makeStorageShim()
    vi.stubGlobal("sessionStorage", sessionShim)
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    assignSpy = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe("connectOpenRouter", () => {
    it("builds the auth URL, stores the verifier, and redirects the full page; the promise stays pending", async () => {
      let settled = false
      const connectPromise = connectOpenRouter()
      void connectPromise.catch(() => {}).finally(() => {
        settled = true
      })
      await waitUntil(() => assignSpy.mock.calls.length === 1)

      const authUrl = new URL(assignSpy.mock.calls[0][0] as string)
      expect(authUrl.origin).toBe("https://openrouter.ai")
      expect(authUrl.pathname).toBe("/auth")
      expect(authUrl.searchParams.get("callback_url")).toBe(
        window.location.origin + "/auth/openrouter"
      )
      expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256")

      // The verifier is in sessionStorage and challenge = base64url(SHA-256(verifier))
      const verifier = sessionShim.getItem(VERIFIER_STORAGE_KEY)
      expect(verifier).toBeTruthy()
      expect(hasStoredOpenRouterVerifier()).toBe(true)
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier as string)
      )
      expect(authUrl.searchParams.get("code_challenge")).toBe(
        base64UrlEncode(new Uint8Array(digest))
      )

      // The redirect leaves this tab — the promise must not settle here.
      await flushMicrotasks()
      expect(settled).toBe(false)
    })
  })

  describe("exchangeOpenRouterCode", () => {
    it("sends code + verifier and clears the verifier on success", async () => {
      sessionShim.setItem(VERIFIER_STORAGE_KEY, "verifier-ok")
      fetchMock.mockResolvedValue(okKeyResponse("sk-or-key-1"))

      await expect(exchangeOpenRouterCode("code-ok")).resolves.toBe(
        "sk-or-key-1"
      )
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [exchangeUrl, exchangeInit] = fetchMock.mock.calls[0] as [
        string,
        RequestInit,
      ]
      expect(exchangeUrl).toBe("https://openrouter.ai/api/v1/auth/keys")
      expect(exchangeInit.method).toBe("POST")
      expect(JSON.parse(exchangeInit.body as string)).toEqual({
        code: "code-ok",
        code_verifier: "verifier-ok",
        code_challenge_method: "S256",
      })
      expect(sessionShim.getItem(VERIFIER_STORAGE_KEY)).toBeNull()
      expect(hasStoredOpenRouterVerifier()).toBe(false)
    })

    it("rejects missing_verifier without a stored verifier", async () => {
      await expect(exchangeOpenRouterCode("code-missing-verifier")).rejects.toThrow(
        "missing_verifier"
      )
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("HTTP 4xx: rejects exchange_failed and clears the verifier (code judged invalid)", async () => {
      sessionShim.setItem(VERIFIER_STORAGE_KEY, "verifier-http")
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({}),
      })
      await expect(exchangeOpenRouterCode("code-http-fail")).rejects.toThrow(
        "exchange_failed"
      )
      expect(sessionShim.getItem(VERIFIER_STORAGE_KEY)).toBeNull()
    })

    it("HTTP 5xx: rejects exchange_failed but keeps the verifier for a retry", async () => {
      sessionShim.setItem(VERIFIER_STORAGE_KEY, "verifier-5xx")
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      })
      await expect(exchangeOpenRouterCode("code-5xx")).rejects.toThrow(
        "exchange_failed"
      )
      expect(sessionShim.getItem(VERIFIER_STORAGE_KEY)).toBe("verifier-5xx")
    })

    it("rejects exchange_failed when the response lacks a key or it is empty", async () => {
      sessionShim.setItem(VERIFIER_STORAGE_KEY, "verifier-nokey")
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
      await expect(exchangeOpenRouterCode("code-no-key")).rejects.toThrow(
        "exchange_failed"
      )

      sessionShim.setItem(VERIFIER_STORAGE_KEY, "verifier-emptykey")
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ key: "" }) })
      await expect(exchangeOpenRouterCode("code-empty-key")).rejects.toThrow(
        "exchange_failed"
      )
    })

    it("concurrent calls for the same code share one request (strict-mode double-effect guard)", async () => {
      sessionShim.setItem(VERIFIER_STORAGE_KEY, "verifier-dedupe")
      fetchMock.mockResolvedValue(okKeyResponse("sk-or-dedupe"))

      const first = exchangeOpenRouterCode("code-dedupe")
      const second = exchangeOpenRouterCode("code-dedupe")
      expect(second).toBe(first)
      await expect(first).resolves.toBe("sk-or-dedupe")
      await expect(second).resolves.toBe("sk-or-dedupe")
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("a failed exchange is evicted from the cache: retrying the same code re-requests and can succeed", async () => {
      sessionShim.setItem(VERIFIER_STORAGE_KEY, "verifier-cache")
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      })
      await expect(exchangeOpenRouterCode("code-retry")).rejects.toThrow(
        "exchange_failed"
      )

      // The 5xx kept the verifier; once the server recovers the same code succeeds
      fetchMock.mockResolvedValue(okKeyResponse("sk-or-retried"))
      await expect(exchangeOpenRouterCode("code-retry")).resolves.toBe(
        "sk-or-retried"
      )
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe("hasStoredOpenRouterVerifier", () => {
    it("returns true/false depending on whether a verifier is stored", () => {
      expect(hasStoredOpenRouterVerifier()).toBe(false)
      sessionShim.setItem(VERIFIER_STORAGE_KEY, "v")
      expect(hasStoredOpenRouterVerifier()).toBe(true)
    })
  })
})
