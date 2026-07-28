import { afterEach, describe, expect, it, vi } from "vitest"

import {
  isInApplyRemote,
  notifyChange,
  setNotifyHandler,
  withApplyingRemote,
} from "@/services/sync/sync-broadcast"

afterEach(() => {
  setNotifyHandler(null)
})

describe("notifyChange / setNotifyHandler", () => {
  it("invokes the registered handler", () => {
    const handler = vi.fn()
    setNotifyHandler(handler)
    notifyChange()
    notifyChange()
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it("is a no-op without a handler", () => {
    setNotifyHandler(null)
    expect(() => notifyChange()).not.toThrow()
  })

  it("replaces a previously registered handler", () => {
    const first = vi.fn()
    const second = vi.fn()
    setNotifyHandler(first)
    setNotifyHandler(second)
    notifyChange()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe("withApplyingRemote / isInApplyRemote", () => {
  it("marks the inbound-apply window and resets afterwards", async () => {
    expect(isInApplyRemote()).toBe(false)
    const result = await withApplyingRemote(async () => {
      expect(isInApplyRemote()).toBe(true)
      return 42
    })
    expect(result).toBe(42)
    expect(isInApplyRemote()).toBe(false)
  })

  it("supports nesting via a depth counter", async () => {
    await withApplyingRemote(async () => {
      await withApplyingRemote(async () => {
        expect(isInApplyRemote()).toBe(true)
      })
      // Still inside the outer apply.
      expect(isInApplyRemote()).toBe(true)
    })
    expect(isInApplyRemote()).toBe(false)
  })

  it("resets the flag even when the wrapped fn rejects", async () => {
    await expect(
      withApplyingRemote(async () => {
        throw new Error("boom")
      })
    ).rejects.toThrow("boom")
    expect(isInApplyRemote()).toBe(false)
  })
})
