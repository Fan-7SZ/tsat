import { describe, expect, it } from "vitest"

import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import {
  computeGoalCompletionCounts,
  computeGoalCompletionRatio,
} from "@/utils/goal-progress"

const goalId = "goal-1" as GoalID
const otherGoalId = "goal-2" as GoalID

function createTask(
  id: string,
  patch: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id: id as TaskID,
    goalId,
    title: id,
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

describe("computeGoalCompletionCounts", () => {
  it("sums completedCount and total across the goal's tasks only", () => {
    const tasks: Record<TaskID, TaskGroupEntity> = {
      ["a" as TaskID]: createTask("a", { total: 3, completedCount: 1 }),
      ["b" as TaskID]: createTask("b", { total: 2, completedCount: 2 }),
      ["c" as TaskID]: createTask("c", {
        goalId: otherGoalId,
        total: 5,
        completedCount: 5,
      }),
    }

    expect(computeGoalCompletionCounts(goalId, tasks)).toEqual({
      completedCount: 3,
      totalCount: 5,
    })
  })

  it("returns zeros for a goal with no tasks", () => {
    expect(computeGoalCompletionCounts(goalId, {})).toEqual({
      completedCount: 0,
      totalCount: 0,
    })
  })
})

describe("computeGoalCompletionRatio", () => {
  it("returns completed / total in [0, 1]", () => {
    const tasks: Record<TaskID, TaskGroupEntity> = {
      ["a" as TaskID]: createTask("a", { total: 4, completedCount: 1 }),
    }

    expect(computeGoalCompletionRatio(goalId, tasks)).toBe(0.25)
  })

  it("returns 1 for a goal with no planned total so it sorts last", () => {
    expect(computeGoalCompletionRatio(goalId, {})).toBe(1)
  })
})
