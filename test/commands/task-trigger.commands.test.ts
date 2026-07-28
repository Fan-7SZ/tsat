import { beforeEach, describe, expect, it, vi } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type {
  TaskGroupEntity,
  TaskTriggerConfig,
} from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"

const mocks = vi.hoisted(() => ({
  queryTaskById: vi.fn(),
  queryGoalById: vi.fn(),
  queryDependencyByGoal: vi.fn(),
  queryTasksByGoal: vi.fn(),
  setTaskTriggerAtomic: vi.fn(),
  deleteTaskTriggerAtomic: vi.fn(),
  replan: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  queryTaskById: mocks.queryTaskById,
  queryGoalById: mocks.queryGoalById,
  queryDependencyByGoal: mocks.queryDependencyByGoal,
  queryTasksByGoal: mocks.queryTasksByGoal,
  setTaskTriggerAtomic: mocks.setTaskTriggerAtomic,
  deleteTaskTriggerAtomic: mocks.deleteTaskTriggerAtomic,
}))

vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: () => ({ replan: mocks.replan }) },
}))

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))

const { saveTaskTrigger, deleteTaskTrigger } = await import(
  "@/commands/task-trigger.commands"
)

const goalId = "goal-1" as GoalID
const taskId = "task-1" as TaskID

const windowlessTrigger: TaskTriggerConfig = {
  rule: { mode: "daily", interval: 1 },
}

function task(patch: Partial<TaskGroupEntity> = {}): TaskGroupEntity {
  return {
    id: taskId,
    title: "Task",
    createdAt: new Date("2026-05-10T09:00:00"),
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

function goal(): GoalEntity {
  return {
    id: goalId,
    title: "Goal",
    createdAt: new Date("2026-05-10T09:00:00"),
  }
}

describe("task-trigger.commands", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryTaskById.mockResolvedValue(task())
    mocks.queryGoalById.mockResolvedValue(goal())
    mocks.queryDependencyByGoal.mockResolvedValue(null)
    mocks.queryTasksByGoal.mockResolvedValue([])
    mocks.setTaskTriggerAtomic.mockResolvedValue("saved")
    mocks.deleteTaskTriggerAtomic.mockResolvedValue("deleted")
    mocks.replan.mockResolvedValue(undefined)
  })

  describe("saveTaskTrigger", () => {
    it("returns false when the task does not exist", async () => {
      mocks.queryTaskById.mockResolvedValue(null)

      const saved = await saveTaskTrigger(taskId, windowlessTrigger)

      expect(saved).toBe(false)
      expect(mocks.setTaskTriggerAtomic).not.toHaveBeenCalled()
    })

    it("saves a windowless trigger on a standalone task without goal queries", async () => {
      const saved = await saveTaskTrigger(taskId, windowlessTrigger)

      expect(saved).toBe(true)
      expect(mocks.queryGoalById).not.toHaveBeenCalled()
      expect(mocks.setTaskTriggerAtomic).toHaveBeenCalledWith(
        taskId,
        windowlessTrigger
      )
      expect(mocks.replan).toHaveBeenCalledTimes(1)
    })

    it("loads the goal context for a goal-bound task before saving", async () => {
      mocks.queryTaskById.mockResolvedValue(task({ goalId }))

      const saved = await saveTaskTrigger(taskId, {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-11T00:00:00"),
        endsAt: new Date("2026-05-13T00:00:00"),
      })

      expect(saved).toBe(true)
      expect(mocks.queryGoalById).toHaveBeenCalledWith(goalId)
      expect(mocks.queryDependencyByGoal).toHaveBeenCalledWith(goalId)
      expect(mocks.queryTasksByGoal).toHaveBeenCalledWith(goalId)
      expect(mocks.setTaskTriggerAtomic).toHaveBeenCalledTimes(1)
    })

    it("rejects a partial trigger window", async () => {
      const saved = await saveTaskTrigger(taskId, {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-11T00:00:00"),
      })

      expect(saved).toBe(false)
      expect(mocks.setTaskTriggerAtomic).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Pick both start and end dates for the trigger period."
      )
    })

    it("rejects a trigger window ending before it starts", async () => {
      const saved = await saveTaskTrigger(taskId, {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-13T00:00:00"),
        endsAt: new Date("2026-05-11T00:00:00"),
      })

      expect(saved).toBe(false)
      expect(mocks.setTaskTriggerAtomic).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Trigger period end must be on or after the start date."
      )
    })

    it("toasts when the atomic save reports a repeat task", async () => {
      mocks.setTaskTriggerAtomic.mockResolvedValue("repeat-task")

      const saved = await saveTaskTrigger(taskId, windowlessTrigger)

      expect(saved).toBe(false)
      expect(mocks.replan).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Repeating tasks cannot use a trigger."
      )
    })

    it("toasts and fails when the atomic save loses the task", async () => {
      mocks.setTaskTriggerAtomic.mockResolvedValue("task-not-found")

      const saved = await saveTaskTrigger(taskId, windowlessTrigger)

      expect(saved).toBe(false)
      expect(mocks.replan).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith("Task not found.")
    })

    it("toasts the fallback message when the save throws", async () => {
      mocks.setTaskTriggerAtomic.mockRejectedValue(new Error("boom"))

      const saved = await saveTaskTrigger(taskId, windowlessTrigger)

      expect(saved).toBe(false)
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to save trigger.")
    })
  })

  describe("deleteTaskTrigger", () => {
    it("deletes the trigger and replans", async () => {
      const deleted = await deleteTaskTrigger(taskId)

      expect(deleted).toBe(true)
      expect(mocks.deleteTaskTriggerAtomic).toHaveBeenCalledWith(taskId)
      expect(mocks.replan).toHaveBeenCalledTimes(1)
    })

    it("returns false when the task is not found", async () => {
      mocks.deleteTaskTriggerAtomic.mockResolvedValue("task-not-found")

      const deleted = await deleteTaskTrigger(taskId)

      expect(deleted).toBe(false)
      expect(mocks.replan).not.toHaveBeenCalled()
    })

    it("toasts and returns false when deletion throws", async () => {
      mocks.deleteTaskTriggerAtomic.mockRejectedValue(new Error("boom"))

      const deleted = await deleteTaskTrigger(taskId)

      expect(deleted).toBe(false)
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to delete trigger.")
    })
  })
})
