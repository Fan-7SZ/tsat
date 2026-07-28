import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEVICE_DATA_FILE_PREFIX,
  deviceDataFileName,
  getDeviceId,
  isDeviceDataFileName,
  parseDeviceIdFromFileName,
} from "@/services/sync/device-id"

function makeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: vi.fn((k: string) => map.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void map.set(k, String(v))),
    removeItem: vi.fn((k: string) => void map.delete(k)),
  }
}

let storage: ReturnType<typeof makeStorage>

beforeEach(() => {
  storage = makeStorage()
  vi.stubGlobal("localStorage", storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getDeviceId", () => {
  it("generates a UUID and persists it on first call", () => {
    const id = getDeviceId()
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    expect(storage.setItem).toHaveBeenCalledWith("track-device-id", id)
  })

  it("returns the stored id on subsequent calls without rewriting", () => {
    const first = getDeviceId()
    storage.setItem.mockClear()
    expect(getDeviceId()).toBe(first)
    expect(storage.setItem).not.toHaveBeenCalled()
  })
})

describe("device data file names", () => {
  it("builds and recognizes device data file names", () => {
    const name = deviceDataFileName("abc-123")
    expect(name).toBe("track-sync-data-abc-123.json")
    expect(name.startsWith(DEVICE_DATA_FILE_PREFIX)).toBe(true)
    expect(isDeviceDataFileName(name)).toBe(true)
  })

  it("rejects non-matching names", () => {
    expect(isDeviceDataFileName("other-file.json")).toBe(false)
    expect(isDeviceDataFileName("track-sync-data-abc.txt")).toBe(false)
  })

  it("round-trips the device id through the file name", () => {
    expect(parseDeviceIdFromFileName(deviceDataFileName("dev-42"))).toBe(
      "dev-42"
    )
  })

  it("returns null when parsing a non device-data file name", () => {
    expect(parseDeviceIdFromFileName("notes.json")).toBeNull()
    expect(parseDeviceIdFromFileName("track-sync-data-x.txt")).toBeNull()
  })
})
