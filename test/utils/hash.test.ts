import { describe, expect, it } from "vitest"

import { sha256Hex } from "@/utils/hash"

describe("sha256Hex", () => {
  it("hashes the empty string to the well-known digest", async () => {
    await expect(sha256Hex("")).resolves.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
  })

  it("hashes 'abc' to the well-known digest", async () => {
    await expect(sha256Hex("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
  })

  it("returns 64 lowercase hex characters", async () => {
    const digest = await sha256Hex("track")
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })
})
