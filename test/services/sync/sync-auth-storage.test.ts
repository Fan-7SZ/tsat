import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  SYNC_ACCESS_TOKEN_STORAGE_KEY,
  SYNC_REFRESH_TOKEN_STORAGE_KEY,
  clearSyncAccessToken,
  clearSyncRefreshToken,
  isRefreshTokenRotation,
  readSyncAccessToken,
  readSyncRefreshToken,
  saveSyncAccessToken,
  saveSyncRefreshToken,
} from "@/services/sync/sync-auth-storage"

function rawToken(provider: string, refreshToken: string): string {
  return JSON.stringify({ provider, refreshToken })
}

function makeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: vi.fn((k: string) => map.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void map.set(k, String(v))),
    removeItem: vi.fn((k: string) => void map.delete(k)),
  }
}

describe("without a window (SSR / worker)", () => {
  // node environment: window is undefined by default.
  it("reads return null and writes are no-ops", () => {
    expect(readSyncRefreshToken("google")).toBeNull()
    expect(readSyncAccessToken("google")).toBeNull()
    expect(() => saveSyncRefreshToken("google", "rt")).not.toThrow()
    expect(() =>
      saveSyncAccessToken("google", {
        accessToken: "at",
        expiresAt: "2026-01-01T00:00:00.000Z",
      })
    ).not.toThrow()
    expect(() => clearSyncRefreshToken()).not.toThrow()
    expect(() => clearSyncAccessToken()).not.toThrow()
  })
})

describe("isRefreshTokenRotation", () => {
  it("true when the same provider swapped token values", () => {
    expect(
      isRefreshTokenRotation(
        rawToken("onedrive", "rt-1"),
        rawToken("onedrive", "rt-2")
      )
    ).toBe(true)
  })

  it("false when the binding appears (connect) or disappears (disconnect)", () => {
    expect(isRefreshTokenRotation(null, rawToken("onedrive", "rt-1"))).toBe(
      false
    )
    expect(isRefreshTokenRotation(rawToken("onedrive", "rt-1"), null)).toBe(
      false
    )
  })

  it("false when the provider changed", () => {
    expect(
      isRefreshTokenRotation(
        rawToken("google", "rt-1"),
        rawToken("onedrive", "rt-2")
      )
    ).toBe(false)
  })

  it("false when either side is malformed or empty", () => {
    expect(
      isRefreshTokenRotation("{oops", rawToken("onedrive", "rt-2"))
    ).toBe(false)
    expect(
      isRefreshTokenRotation(rawToken("onedrive", "rt-1"), rawToken("onedrive", ""))
    ).toBe(false)
  })
})

describe("with a window", () => {
  let storage: ReturnType<typeof makeStorage>

  beforeEach(() => {
    storage = makeStorage()
    vi.stubGlobal("window", { localStorage: storage })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("refresh token", () => {
    it("round-trips save → read for the same provider", () => {
      saveSyncRefreshToken("google", "refresh-1")
      expect(storage.setItem).toHaveBeenCalledWith(
        SYNC_REFRESH_TOKEN_STORAGE_KEY,
        JSON.stringify({ provider: "google", refreshToken: "refresh-1" })
      )
      expect(readSyncRefreshToken("google")).toBe("refresh-1")
    })

    it("returns null for a different provider", () => {
      saveSyncRefreshToken("google", "refresh-1")
      expect(readSyncRefreshToken("onedrive")).toBeNull()
    })

    it("returns null when nothing is stored", () => {
      expect(readSyncRefreshToken("google")).toBeNull()
    })

    it("returns null on malformed JSON", () => {
      storage.setItem(SYNC_REFRESH_TOKEN_STORAGE_KEY, "{oops")
      expect(readSyncRefreshToken("google")).toBeNull()
    })

    it("returns null when the stored token is empty", () => {
      storage.setItem(
        SYNC_REFRESH_TOKEN_STORAGE_KEY,
        JSON.stringify({ provider: "google", refreshToken: "" })
      )
      expect(readSyncRefreshToken("google")).toBeNull()
    })

    it("clears the stored token", () => {
      saveSyncRefreshToken("google", "refresh-1")
      clearSyncRefreshToken("google")
      expect(readSyncRefreshToken("google")).toBeNull()
    })
  })

  describe("access token", () => {
    const token = {
      accessToken: "access-1",
      expiresAt: "2026-06-01T00:00:00.000Z",
    }

    it("round-trips save → read for the same provider", () => {
      saveSyncAccessToken("google", token)
      expect(readSyncAccessToken("google")).toEqual(token)
    })

    it("returns null for a different provider", () => {
      saveSyncAccessToken("google", token)
      expect(readSyncAccessToken("onedrive")).toBeNull()
    })

    it("returns null when nothing is stored", () => {
      expect(readSyncAccessToken("google")).toBeNull()
    })

    it("returns null on malformed JSON", () => {
      storage.setItem(SYNC_ACCESS_TOKEN_STORAGE_KEY, "not json")
      expect(readSyncAccessToken("google")).toBeNull()
    })

    it("clears the stored token", () => {
      saveSyncAccessToken("google", token)
      clearSyncAccessToken("google")
      expect(readSyncAccessToken("google")).toBeNull()
    })
  })
})
