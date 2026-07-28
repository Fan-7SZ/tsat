import { describe, expect, it } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { GoalID, TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import { deriveGoalFocus } from "@/services/planner/derive-goal-focus"

const now = new Date("2026-05-13T10:00:00")
const todayKey = LocalDateKeySchema.parse("2026-05-13")

const policy = {
  dailyCapacityMinutes: 480,
  taskForcedTodoDays: 0,
  goalForcedFocusDays: 0,
  maxFocusGoals: 3,
}

const goalA = "goal-a" as GoalID
const goalB = "goal-b" as GoalID

function goal(id: GoalID): GoalEntity {
  return { id, title: id, createdAt: new Date("2026-05-01T09:00:00") }
}

function task(id: string, goalId: GoalID): TaskGroupEntity {
  return {
    id: id as TaskID,
    goalId,
    title: id,
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
  }
}

function defaultRun(taskId: string): TaskRuntimeEntity {
  return {
    id: taskId as TaskRuntimeID,
    taskId: taskId as TaskID,
    arrangementStatus: "todo",
    source: "default",
  }
}

describe("deriveGoalFocus", () => {
  it("derives manual focus from today's intent records and auto focus from default runs", () => {
    const result = deriveGoalFocus({
      goals: { [goalA]: goal(goalA), [goalB]: goal(goalB) },
      tasks: { "t-a": task("t-a", goalA), "t-b": task("t-b", goalB) } as never,
      taskRuntime: { "t-b": defaultRun("t-b") } as never,
      manualFocuses: {
        [goalA]: { goalId: goalA, dateKey: todayKey },
      } as never,
      policy,
      now,
    })

    expect(result[goalA]!.isFocused).toBe(true)
    // A row written before `source` existed reads as user-placed.
    expect(result[goalA]!.focusStatuses).toEqual([
      { kind: "manualFocus", isBlocking: false, source: "manual" },
    ])
    expect(result[goalB]!.isFocused).toBe(true)
    expect(result[goalB]!.focusStatuses).toEqual([
      { kind: "autoPlannedTask", isBlocking: false, runtimeKeys: ["t-b"] },
    ])
  })

  it("carries a trigger-placed focus through as a non-blocking reason", () => {
    const result = deriveGoalFocus({
      goals: { [goalA]: goal(goalA) },
      tasks: { "t-a": task("t-a", goalA) } as never,
      taskRuntime: {} as never,
      manualFocuses: {
        [goalA]: { goalId: goalA, dateKey: todayKey, source: "trigger" },
      } as never,
      policy,
      now,
    })

    // Same shape as a hand-placed focus — only the wording differs downstream.
    // It must stay non-blocking, or un-focusing it would be impossible again.
    expect(result[goalA]!.focusStatuses).toEqual([
      { kind: "manualFocus", isBlocking: false, source: "trigger" },
    ])
  })

  it("ignores stale manual focus from an earlier day", () => {
    const result = deriveGoalFocus({
      goals: { [goalA]: goal(goalA) },
      tasks: { "t-a": task("t-a", goalA) } as never,
      taskRuntime: {},
      manualFocuses: {
        [goalA]: {
          goalId: goalA,
          dateKey: LocalDateKeySchema.parse("2026-05-12"),
        },
      } as never,
      policy,
      now,
    })

    expect(result[goalA]!.isFocused).toBe(false)
    expect(result[goalA]!.focusStatuses).toEqual([])
  })

  // Regression: a goal with an in-progress auto task could never be un-focused
  // — the surviving (un-deletable) run kept re-deriving the focus.
  it("an in-progress default run is not auto-focus evidence", () => {
    const result = deriveGoalFocus({
      goals: { [goalA]: goal(goalA) },
      tasks: { "t-a": task("t-a", goalA) } as never,
      taskRuntime: {
        "t-a": { ...defaultRun("t-a"), arrangementStatus: "inProgress" },
      } as never,
      manualFocuses: {},
      policy,
      now,
    })

    expect(result[goalA]!.isFocused).toBe(false)
    expect(result[goalA]!.focusStatuses).toEqual([])
  })

  it("un-focusing is pure data: without default runs the auto status vanishes", () => {
    const withRuns = deriveGoalFocus({
      goals: { [goalA]: goal(goalA) },
      tasks: { "t-a": task("t-a", goalA) } as never,
      taskRuntime: { "t-a": defaultRun("t-a") } as never,
      manualFocuses: {},
      policy,
      now,
    })
    const withoutRuns = deriveGoalFocus({
      goals: { [goalA]: goal(goalA) },
      tasks: { "t-a": task("t-a", goalA) } as never,
      taskRuntime: {},
      manualFocuses: {},
      policy,
      now,
    })

    expect(withRuns[goalA]!.isFocused).toBe(true)
    expect(withoutRuns[goalA]!.isFocused).toBe(false)
  })
})
