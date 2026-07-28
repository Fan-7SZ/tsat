import { describe, expect, it } from "vitest"

import {
  compareCompletion,
  compareDuration,
  compareGoal,
  compareStatus,
} from "@/utils/all-tasks-sort"
import type { AllTasksRowVM } from "@/domain/view-models/AllTasksPageVM"
import type { TaskID } from "@/domain/value-objects/types"

function row(overrides: Partial<AllTasksRowVM>): AllTasksRowVM {
  return {
    taskId: "t" as TaskID,
    title: "",
    inRuntime: false,
    runtimeStatus: null,
    dueAt: null,
    stepsCount: 0,
    completedCount: 0,
    totalCount: 0,
    ...overrides,
  }
}

describe("compareStatus", () => {
  it("orders inProgress → todo → done → not scheduled (null)", () => {
    const rows = [
      row({ runtimeStatus: "done" }),
      row({ runtimeStatus: null }),
      row({ runtimeStatus: "inProgress" }),
      row({ runtimeStatus: "todo" }),
    ]
    const sorted = [...rows].sort(compareStatus).map((r) => r.runtimeStatus)
    expect(sorted).toEqual(["inProgress", "todo", "done", null])
  })
})

describe("compareCompletion", () => {
  it("sorts by ratio ascending", () => {
    const low = row({ completedCount: 1, totalCount: 2 }) // 0.5
    const high = row({ completedCount: 3, totalCount: 4 }) // 0.75
    expect(compareCompletion(low, high)).toBeLessThan(0)
    expect(compareCompletion(high, low)).toBeGreaterThan(0)
  })

  it("sinks tasks with no steps (totalCount 0) to the bottom in asc", () => {
    const withSteps = row({ completedCount: 0, totalCount: 4 }) // 0
    const noSteps = row({ completedCount: 0, totalCount: 0 })
    expect(compareCompletion(withSteps, noSteps)).toBeLessThan(0)
    expect(compareCompletion(noSteps, withSteps)).toBeGreaterThan(0)
    expect(compareCompletion(noSteps, noSteps)).toBe(0)
  })
})

describe("compareGoal", () => {
  it("clusters rows of the same goal and orders goals by title", () => {
    const rows = [
      row({ title: "b1", goalTitle: "Beta" }),
      row({ title: "a1", goalTitle: "Alpha" }),
      row({ title: "b2", goalTitle: "Beta" }),
      row({ title: "a2", goalTitle: "Alpha" }),
    ]
    const sorted = [...rows].sort(compareGoal).map((r) => r.goalTitle)
    expect(sorted).toEqual(["Alpha", "Alpha", "Beta", "Beta"])
  })

  it("sinks standalone tasks (no goal) to the bottom in asc", () => {
    const withGoal = row({ goalTitle: "Alpha" })
    const standalone = row({ goalTitle: undefined })
    expect(compareGoal(withGoal, standalone)).toBeLessThan(0)
    expect(compareGoal(standalone, withGoal)).toBeGreaterThan(0)
    expect(compareGoal(standalone, standalone)).toBe(0)
  })
})

describe("compareDuration", () => {
  it("sorts by minutes ascending with undefined last", () => {
    const short = row({ estimatedDuration: 15 })
    const long = row({ estimatedDuration: 60 })
    const none = row({ estimatedDuration: undefined })
    expect(compareDuration(short, long)).toBeLessThan(0)
    expect(compareDuration(short, none)).toBeLessThan(0)
    expect(compareDuration(none, long)).toBeGreaterThan(0)
    expect(compareDuration(none, none)).toBe(0)
  })
})
