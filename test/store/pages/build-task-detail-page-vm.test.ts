import { afterEach, describe, expect, it, vi } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import { buildTaskDetailPageVM } from "@/store/pages/build-task-detail-page-vm"

const taskId = "task-1" as TaskID
const goalId = "goal-1" as GoalID

const goal: GoalEntity = {
  id: goalId,
  title: "Goal",
  createdAt: new Date("2026-05-01T09:00:00"),
}

function task(overrides: Partial<TaskGroupEntity> = {}): TaskGroupEntity {
  return {
    id: taskId,
    goalId,
    title: "Task",
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...overrides,
  }
}

describe("buildTaskDetailPageVM", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("maps goal info and defaults with no runtime and no steps", () => {
    const vm = buildTaskDetailPageVM({
      task: task(),
      goal,
      taskRuntime: {},
      dismissedTaskIds: new Set(),
    })

    expect(vm.goalId).toBe(goalId)
    expect(vm.goalTitle).toBe("Goal")
    expect(vm.checklistSteps).toEqual([])
    expect(vm.completionRuntimeId).toBeUndefined()
    expect(vm.isDismissedToday).toBe(false)
  })

  it("joins checklist steps with the completion runtime's progress", () => {
    const withSteps = task({
      steps: [
        { id: "s1", title: "one" },
        { id: "s2", title: "two" },
      ],
    })
    const runtime: TaskRuntimeEntity = {
      id: taskId as unknown as TaskRuntimeID,
      taskId,
      arrangementStatus: "inProgress",
      source: "manual",
      stepsCompleted: ["s1", "orphan"],
    }

    const vm = buildTaskDetailPageVM({
      task: withSteps,
      goal,
      taskRuntime: { [runtime.id]: runtime },
      dismissedTaskIds: new Set(),
    })

    expect(vm.completionRuntimeId).toBe(runtime.id)
    expect(vm.checklistSteps).toEqual([
      { id: "s1", title: "one", done: true },
      { id: "s2", title: "two", done: false },
    ])
  })

  it("selects today's repeat point as the completion runtime", () => {
    vi.setSystemTime(new Date("2026-07-20T10:00:00"))
    const repeatTask = task({
      repeat: {
        rule: { mode: "daily", interval: 1 },
      },
    })
    const todayId = "task-1::2026-07-20" as TaskRuntimeID
    const yesterdayId = "task-1::2026-07-19" as TaskRuntimeID
    const taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity> = {
      [yesterdayId]: {
        id: yesterdayId,
        taskId,
        arrangementStatus: "todo",
        source: "repeatPolicy",
        plannedForDate: LocalDateKeySchema.parse("2026-07-19"),
      },
      [todayId]: {
        id: todayId,
        taskId,
        arrangementStatus: "todo",
        source: "repeatPolicy",
        plannedForDate: LocalDateKeySchema.parse("2026-07-20"),
      },
    }

    const vm = buildTaskDetailPageVM({
      task: repeatTask,
      goal: null,
      taskRuntime,
      dismissedTaskIds: new Set(),
    })

    expect(vm.completionRuntimeId).toBe(todayId)
    expect(vm.goalTitle).toBeUndefined()
  })

  it("reflects the day-scoped dismissal flag", () => {
    const vm = buildTaskDetailPageVM({
      task: task(),
      goal: null,
      taskRuntime: {},
      dismissedTaskIds: new Set([taskId]),
    })

    expect(vm.isDismissedToday).toBe(true)
  })
})
