import { describe, expect, it } from "vitest"

import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  TaskRuntimeEntity,
  TaskRuntimeStatus,
} from "@/domain/entities/TaskRuntimeEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import { selectCrossDayCarryOver } from "@/utils/cross-day-sweep"

function task(
  id: string,
  patch: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id: id as TaskID,
    title: id,
    createdAt: new Date("2026-05-10T09:00:00"),
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

function runtime(
  taskId: string,
  arrangementStatus: TaskRuntimeStatus
): TaskRuntimeEntity {
  return {
    id: taskId as TaskRuntimeID,
    taskId: taskId as TaskID,
    arrangementStatus,
    source: "default",
  }
}

function asRuntimeRecord(
  runtimes: TaskRuntimeEntity[]
): Record<TaskRuntimeID, TaskRuntimeEntity> {
  return Object.fromEntries(runtimes.map((r) => [r.id, r]))
}

describe("selectCrossDayCarryOver", () => {
  it("keeps an in-progress runtime of an allowCrossDay task and its goal id", () => {
    const result = selectCrossDayCarryOver({
      tasks: [
        task("t1", { goalId: "goal-1" as GoalID, allowCrossDay: true }),
      ],
      taskRuntime: asRuntimeRecord([runtime("t1", "inProgress")]),
    })

    expect(Object.keys(result.taskRuntime)).toEqual(["t1"])
    expect([...result.keptGoalIds]).toEqual(["goal-1"])
  })

  it("drops an allowCrossDay task that is not in progress", () => {
    const result = selectCrossDayCarryOver({
      tasks: [task("t1", { allowCrossDay: true })],
      taskRuntime: asRuntimeRecord([
        runtime("t1", "todo"),
      ]),
    })

    expect(result.taskRuntime).toEqual({})
  })

  it("drops an in-progress task without allowCrossDay", () => {
    const result = selectCrossDayCarryOver({
      tasks: [task("t1", { allowCrossDay: false })],
      taskRuntime: asRuntimeRecord([runtime("t1", "inProgress")]),
    })

    expect(result.taskRuntime).toEqual({})
  })

  it("never keeps a repeat task even if it looks eligible", () => {
    const result = selectCrossDayCarryOver({
      tasks: [
        task("t1", {
          allowCrossDay: true,
          repeat: { rule: { mode: "daily", interval: 1 } },
        }),
      ],
      taskRuntime: asRuntimeRecord([runtime("t1", "inProgress")]),
    })

    expect(result.taskRuntime).toEqual({})
  })

  it("keeps only the goal ids of kept tasks and drops the rest", () => {
    const result = selectCrossDayCarryOver({
      tasks: [
        task("keep", { goalId: "goal-1" as GoalID, allowCrossDay: true }),
        task("dropStatus", { goalId: "goal-2" as GoalID, allowCrossDay: true }),
        task("dropFlag", { goalId: "goal-2" as GoalID, allowCrossDay: false }),
      ],
      taskRuntime: asRuntimeRecord([
        runtime("keep", "inProgress"),
        runtime("dropStatus", "todo"),
        runtime("dropFlag", "inProgress"),
        runtime("orphan", "inProgress"), // no matching task
      ]),
    })

    expect(Object.keys(result.taskRuntime)).toEqual(["keep"])
    expect([...result.keptGoalIds]).toEqual(["goal-1"])
  })
})
