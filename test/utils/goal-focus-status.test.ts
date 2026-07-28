import { describe, expect, it } from "vitest"

import type { GoalFocusStatus } from "@/domain/derived/GoalFocus"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import {
  getBlockingGoalFocusStatuses,
  hasBlockingGoalFocusStatus,
  mergeGoalFocusStatuses,
  normalizeGoalFocus,
  normalizeGoalFocusStatuses,
  upsertGoalFocusStatus,
} from "@/utils/goal-focus-status"

const goalId = "goal-1" as GoalID
const taskId = "task-1" as TaskID
const dateKey = "2026-05-13" as LocalDateKey

const manualFocus: GoalFocusStatus = { kind: "manualFocus", isBlocking: false }
const autoPlanned: GoalFocusStatus = {
  kind: "autoPlannedTask",
  isBlocking: false,
  runtimeKeys: ["r1", "r2"],
}
const goalDueAt = new Date("2026-05-31T23:59:00")
const goalDue: GoalFocusStatus = {
  kind: "goalDuePolicy",
  isBlocking: true,
  dueAt: goalDueAt,
}
const taskDue: GoalFocusStatus = {
  kind: "taskDuePolicy",
  isBlocking: true,
  taskId,
  taskTitle: "Task 1",
  dueAt: new Date("2026-05-20T23:59:00"),
}
const manualToday: GoalFocusStatus = {
  kind: "manualTodayTask",
  isBlocking: true,
  taskId,
  taskTitle: "Task 1",
}
const repeatPoint: GoalFocusStatus = {
  kind: "repeatPolicyPoint",
  isBlocking: true,
  taskId,
  taskTitle: "Task 1",
  plannedForDate: dateKey,
}
const taskTrigger: GoalFocusStatus = {
  kind: "taskTriggerPolicy",
  isBlocking: true,
  taskId,
  taskTitle: "Task 1",
  firedDate: dateKey,
}

describe("upsertGoalFocusStatus", () => {
  it("appends a status with a new key and sorts by priority", () => {
    const result = upsertGoalFocusStatus([manualFocus], manualToday)

    // manualTodayTask has the highest priority and sorts first.
    expect(result.map((s) => s.kind)).toEqual([
      "manualTodayTask",
      "manualFocus",
    ])
  })

  it("replaces a status with the same key", () => {
    const updated: GoalFocusStatus = {
      ...taskDue,
      taskTitle: "Renamed",
    } as GoalFocusStatus
    const result = upsertGoalFocusStatus([taskDue], updated)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ taskTitle: "Renamed" })
  })

  it("accepts a null/undefined base list", () => {
    expect(upsertGoalFocusStatus(null, manualFocus)).toEqual([manualFocus])
    expect(upsertGoalFocusStatus(undefined, manualFocus)).toEqual([manualFocus])
  })

  it("unions runtimeKeys when upserting autoPlannedTask", () => {
    const result = upsertGoalFocusStatus([autoPlanned], {
      kind: "autoPlannedTask",
      isBlocking: false,
      runtimeKeys: ["r2", "r3"],
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ runtimeKeys: ["r1", "r2", "r3"] })
  })

  it("keeps manual and trigger placed focus rows apart (keyed by source)", () => {
    const triggerFocus: GoalFocusStatus = {
      kind: "manualFocus",
      isBlocking: false,
      source: "trigger",
    }
    const result = upsertGoalFocusStatus([manualFocus], triggerFocus)

    expect(result).toHaveLength(2)
  })

  it("keys date-carrying statuses by their date", () => {
    const otherDue: GoalFocusStatus = {
      kind: "goalDuePolicy",
      isBlocking: true,
      dueAt: new Date("2026-06-30T23:59:00"),
    }
    expect(upsertGoalFocusStatus([goalDue], otherDue)).toHaveLength(2)
  })
})

describe("mergeGoalFocusStatuses", () => {
  it("merges lists, dedupes by key and sorts by priority", () => {
    const result = mergeGoalFocusStatuses(
      [manualFocus, goalDue],
      null,
      undefined,
      [goalDue, repeatPoint, taskTrigger, taskDue, manualToday, autoPlanned]
    )

    expect(result.map((s) => s.kind)).toEqual([
      "manualTodayTask",
      "repeatPolicyPoint",
      "taskTriggerPolicy",
      "taskDuePolicy",
      "goalDuePolicy",
      "manualFocus",
      "autoPlannedTask",
    ])
  })

  it("returns [] with no input", () => {
    expect(mergeGoalFocusStatuses()).toEqual([])
  })
})

describe("blocking helpers", () => {
  it("filters down to blocking statuses", () => {
    expect(
      getBlockingGoalFocusStatuses([manualFocus, goalDue, autoPlanned])
    ).toEqual([goalDue])
    expect(getBlockingGoalFocusStatuses(null)).toEqual([])
  })

  it("reports whether any blocking status exists", () => {
    expect(hasBlockingGoalFocusStatus([manualFocus, autoPlanned])).toBe(false)
    expect(hasBlockingGoalFocusStatus([manualFocus, taskDue])).toBe(true)
    expect(hasBlockingGoalFocusStatus(undefined)).toBe(false)
  })
})

describe("normalizeGoalFocusStatuses", () => {
  it("returns [] without a runtime or statuses", () => {
    expect(normalizeGoalFocusStatuses(null)).toEqual([])
    expect(normalizeGoalFocusStatuses(undefined)).toEqual([])
  })

  it("normalizes every kind, restoring defaults and flags", () => {
    const result = normalizeGoalFocusStatuses({
      id: goalId,
      isFocused: true,
      focusStatuses: [
        manualFocus,
        { kind: "autoPlannedTask", isBlocking: false, runtimeKeys: ["r1", "r1"] },
        goalDue,
        taskDue,
        manualToday,
        repeatPoint,
        taskTrigger,
      ],
    })

    expect(result.map((s) => s.kind)).toEqual([
      "manualTodayTask",
      "repeatPolicyPoint",
      "taskTriggerPolicy",
      "taskDuePolicy",
      "goalDuePolicy",
      "manualFocus",
      "autoPlannedTask",
    ])

    expect(result.find((s) => s.kind === "manualFocus")).toEqual({
      kind: "manualFocus",
      isBlocking: false,
      source: "manual",
    })
    expect(result.find((s) => s.kind === "autoPlannedTask")).toEqual({
      kind: "autoPlannedTask",
      isBlocking: false,
      runtimeKeys: ["r1"],
    })

    const due = result.find((s) => s.kind === "goalDuePolicy")
    expect(due).toMatchObject({ isBlocking: true })
    if (due?.kind === "goalDuePolicy") {
      expect(due.dueAt).toBeInstanceOf(Date)
      expect(due.dueAt.getTime()).toBe(goalDueAt.getTime())
      expect(due.dueAt).not.toBe(goalDueAt) // a fresh Date instance
    }

    expect(result.find((s) => s.kind === "repeatPolicyPoint")).toMatchObject({
      isBlocking: true,
      taskId,
      plannedForDate: dateKey,
    })
    expect(result.find((s) => s.kind === "taskTriggerPolicy")).toMatchObject({
      isBlocking: true,
      firedDate: dateKey,
    })
    expect(result.find((s) => s.kind === "manualTodayTask")).toMatchObject({
      isBlocking: true,
      taskTitle: "Task 1",
    })
  })
})

describe("normalizeGoalFocus", () => {
  it("builds an unfocused runtime from nothing", () => {
    expect(normalizeGoalFocus(goalId, null)).toEqual({
      id: goalId,
      isFocused: false,
      focusStatuses: [],
    })
  })

  it("is focused once any status exists", () => {
    const result = normalizeGoalFocus(goalId, {
      id: goalId,
      isFocused: false,
      focusStatuses: [manualFocus],
    })

    expect(result.isFocused).toBe(true)
    expect(result.focusStatuses).toHaveLength(1)
  })
})
