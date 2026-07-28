import { describe, expect, it } from "vitest"

import { STATUS_TONE, STATUS_TONE_HOVER } from "@/utils/status-tone"

describe("STATUS_TONE", () => {
  it("defines both tones", () => {
    expect(Object.keys(STATUS_TONE).sort()).toEqual(["amber", "green"])
  })

  it("carries the accent as border, washed fill and text", () => {
    expect(STATUS_TONE.amber).toContain("border-amber-600/30")
    expect(STATUS_TONE.amber).toContain("bg-amber-500/10")
    expect(STATUS_TONE.amber).toContain("text-amber-700")
    expect(STATUS_TONE.green).toContain("border-green-600/30")
    expect(STATUS_TONE.green).toContain("bg-green-600/10")
    expect(STATUS_TONE.green).toContain("text-green-700")
  })
})

describe("STATUS_TONE_HOVER", () => {
  it("adds hover states for the same tones", () => {
    expect(Object.keys(STATUS_TONE_HOVER).sort()).toEqual(["amber", "green"])
    expect(STATUS_TONE_HOVER.amber).toContain("hover:bg-amber-500/20")
    expect(STATUS_TONE_HOVER.green).toContain("hover:bg-green-600/20")
  })
})
