import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_POLICY,
  readPolicyFromStorage,
  writePolicyToStorage,
} from "@/services/planner/policy-storage"

const KEY = "track-planner-policy"

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: vi.fn((k: string) => map.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void map.set(k, String(v))),
    removeItem: vi.fn((k: string) => void map.delete(k)),
    clear: vi.fn(() => map.clear()),
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

describe("readPolicyFromStorage", () => {
  it("returns the default policy when nothing is stored", () => {
    expect(readPolicyFromStorage()).toEqual(DEFAULT_POLICY)
  })

  it("round-trips a policy written by writePolicyToStorage", () => {
    const policy = {
      dailyCapacityMinutes: 300,
      taskForcedTodoDays: 1,
      goalForcedFocusDays: 2,
      maxFocusGoals: 5,
    }
    writePolicyToStorage(policy)
    expect(storage.setItem).toHaveBeenCalledWith(KEY, JSON.stringify(policy))
    expect(readPolicyFromStorage()).toEqual(policy)
  })

  it("floors fractional numbers", () => {
    storage.setItem(
      KEY,
      JSON.stringify({
        dailyCapacityMinutes: 300.9,
        taskForcedTodoDays: 1.5,
        goalForcedFocusDays: 2.2,
        maxFocusGoals: 4.7,
      })
    )
    expect(readPolicyFromStorage()).toEqual({
      dailyCapacityMinutes: 300,
      taskForcedTodoDays: 1,
      goalForcedFocusDays: 2,
      maxFocusGoals: 4,
    })
  })

  it("allows 0 for the day-window fields but not for capacity/maxFocusGoals", () => {
    storage.setItem(
      KEY,
      JSON.stringify({
        dailyCapacityMinutes: 0,
        taskForcedTodoDays: 0,
        goalForcedFocusDays: 0,
        maxFocusGoals: 0,
      })
    )
    expect(readPolicyFromStorage()).toEqual({
      dailyCapacityMinutes: DEFAULT_POLICY.dailyCapacityMinutes,
      taskForcedTodoDays: 0,
      goalForcedFocusDays: 0,
      maxFocusGoals: DEFAULT_POLICY.maxFocusGoals,
    })
  })

  it("falls back per-field for invalid values (negative / NaN / non-number)", () => {
    storage.setItem(
      KEY,
      JSON.stringify({
        dailyCapacityMinutes: -5,
        taskForcedTodoDays: "3",
        goalForcedFocusDays: null,
        // maxFocusGoals missing entirely
      })
    )
    expect(readPolicyFromStorage()).toEqual(DEFAULT_POLICY)
  })

  it("rejects non-finite numbers", () => {
    // 1e999 overflows to Infinity through JSON.parse
    storage.setItem(
      KEY,
      '{"dailyCapacityMinutes":1e999,"taskForcedTodoDays":2,"goalForcedFocusDays":2,"maxFocusGoals":2}'
    )
    const policy = readPolicyFromStorage()
    expect(policy.dailyCapacityMinutes).toBe(DEFAULT_POLICY.dailyCapacityMinutes)
    expect(policy.taskForcedTodoDays).toBe(2)
  })

  it("returns the default policy on malformed JSON", () => {
    storage.setItem(KEY, "{not json")
    expect(readPolicyFromStorage()).toEqual(DEFAULT_POLICY)
  })

  it("returns the default policy when localStorage throws", () => {
    storage.getItem.mockImplementation(() => {
      throw new Error("denied")
    })
    expect(readPolicyFromStorage()).toEqual(DEFAULT_POLICY)
  })
})
