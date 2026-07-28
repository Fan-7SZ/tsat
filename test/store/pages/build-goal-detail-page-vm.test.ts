import { describe, expect, it } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import { buildGoalDetailPageVM } from "@/store/pages/build-goal-detail-page-vm"

const goalId = "goal-1" as GoalID

const goal: GoalEntity = {
  id: goalId,
  title: "Goal",
  createdAt: new Date("2026-05-01T09:00:00"),
}

function task(
  id: string,
  overrides: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id: id as TaskID,
    goalId,
    title: `Task ${id}`,
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...overrides,
  }
}

describe("buildGoalDetailPageVM", () => {
  it("sums progress and time spent across tasks", () => {
    const vm = buildGoalDetailPageVM({
      goal,
      tasks: [
        task("a", { total: 4, completedCount: 1, estimatedDuration: 30 }),
        task("b", { total: 2, completedCount: 2 }),
      ],
      dependencyTree: null,
    })

    expect(vm.goal).toBe(goal)
    expect(vm.progress).toEqual({
      completedCount: 3,
      totalCount: 6,
      progressPercent: 50,
      // 30min × 1 completion; task b has no estimate.
      totalTimeSpentLabel: "30m",
    })
    expect(vm.createdByGoalTasks).toEqual([
      { taskId: "a", title: "Task a", currentComplete: 1, totalCount: 4 },
      { taskId: "b", title: "Task b", currentComplete: 2, totalCount: 2 },
    ])
  })

  it("reports 0% for a goal with no tasks", () => {
    const vm = buildGoalDetailPageVM({ goal, tasks: [], dependencyTree: null })

    expect(vm.progress.progressPercent).toBe(0)
    expect(vm.progress.totalTimeSpentLabel).toBe("0m")
    expect(vm.createdByGoalTasks).toEqual([])
    expect(vm.requiresTriggerNormalization).toBe(false)
  })

  it("caps progress at 100%", () => {
    const vm = buildGoalDetailPageVM({
      goal,
      tasks: [task("a", { total: 1, completedCount: 3 })],
      dependencyTree: null,
    })

    expect(vm.progress.progressPercent).toBe(100)
  })

  it("passes the dependency tree through", () => {
    const tree = { id: "dep-1" } as never
    const vm = buildGoalDetailPageVM({
      goal,
      tasks: [],
      dependencyTree: tree,
    })
    expect(vm.dependencyTree).toBe(tree)
  })

  it("requires trigger normalization for counter, repeat, or trigger tasks", () => {
    const plain = [task("a")]
    const counter = [task("a", { total: 3 })]
    const repeat = [
      task("a", { repeat: { rule: { mode: "daily", interval: 1 } } }),
    ]
    const trigger = [
      task("a", { trigger: { rule: { mode: "daily", interval: 1 } } }),
    ]

    const build = (tasks: TaskGroupEntity[]) =>
      buildGoalDetailPageVM({ goal, tasks, dependencyTree: null })
        .requiresTriggerNormalization

    expect(build(plain)).toBe(false)
    expect(build(counter)).toBe(true)
    expect(build(repeat)).toBe(true)
    expect(build(trigger)).toBe(true)
  })
})
