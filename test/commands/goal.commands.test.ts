import { beforeEach, describe, expect, it, vi } from "vitest"

import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  DependencyEntityID,
  GoalID,
  TaskID,
} from "@/domain/value-objects/types"

const mocks = vi.hoisted(() => ({
  putGoal: vi.fn(),
  patchGoal: vi.fn(),
  deleteGoalCascadeAtomic: vi.fn(),
  queryGoalById: vi.fn(),
  queryTasksByGoal: vi.fn(),
  queryDependencyByGoal: vi.fn(),
  replan: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  putGoal: mocks.putGoal,
  patchGoal: mocks.patchGoal,
  deleteGoalCascadeAtomic: mocks.deleteGoalCascadeAtomic,
  queryGoalById: mocks.queryGoalById,
  queryTasksByGoal: mocks.queryTasksByGoal,
  queryDependencyByGoal: mocks.queryDependencyByGoal,
}))

vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: () => ({ replan: mocks.replan }) },
}))

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))

const { createGoal, updateGoal, deleteGoal } = await import(
  "@/commands/goal.commands"
)

const goalId = "goal-1" as GoalID
const depId = "dep-1" as DependencyEntityID
const taskId = "task-1" as TaskID

function goal(patch: Partial<GoalEntity> = {}): GoalEntity {
  return {
    id: goalId,
    title: "Goal",
    createdAt: new Date("2026-05-10T09:00:00"),
    ...patch,
  }
}

function task(patch: Partial<TaskGroupEntity> = {}): TaskGroupEntity {
  return {
    id: taskId,
    goalId,
    title: "Task",
    createdAt: new Date("2026-05-10T09:00:00"),
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

function dep(): DependencyEntity {
  return {
    id: depId,
    belongTo: goalId,
    tree: [{ data: taskId, title: "Task", parent: null, children: null }],
  }
}

describe("goal.commands", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.putGoal.mockResolvedValue(goalId)
    mocks.patchGoal.mockResolvedValue(1)
    mocks.deleteGoalCascadeAtomic.mockResolvedValue(undefined)
    mocks.queryGoalById.mockResolvedValue(goal())
    mocks.queryTasksByGoal.mockResolvedValue([task()])
    mocks.queryDependencyByGoal.mockResolvedValue(null)
    mocks.replan.mockResolvedValue(undefined)
  })

  describe("createGoal", () => {
    it("persists the goal and replans", async () => {
      const created = await createGoal(goal())

      expect(created).toBe(true)
      expect(mocks.putGoal).toHaveBeenCalledWith(goal())
      expect(mocks.replan).toHaveBeenCalledTimes(1)
    })

    it("rejects a triggered goal with a fixed due date", async () => {
      const created = await createGoal(
        goal({
          trigger: { rule: { mode: "daily", interval: 1 } },
          dueAt: new Date("2026-06-01T00:00:00"),
        })
      )

      expect(created).toBe(false)
      expect(mocks.putGoal).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Triggered goals cannot use a fixed due date."
      )
    })

    it("toasts the fallback message when persistence fails", async () => {
      mocks.putGoal.mockRejectedValue(new Error("boom"))

      const created = await createGoal(goal())

      expect(created).toBe(false)
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to create goal.")
    })
  })

  describe("updateGoal", () => {
    it("returns false when the goal does not exist", async () => {
      mocks.queryGoalById.mockResolvedValue(null)

      const updated = await updateGoal(goalId, { title: "New" })

      expect(updated).toBe(false)
      expect(mocks.patchGoal).not.toHaveBeenCalled()
    })

    it("applies a plain patch without replanning", async () => {
      const updated = await updateGoal(goalId, { title: "New" })

      expect(updated).toBe(true)
      expect(mocks.patchGoal).toHaveBeenCalledWith(goalId, { title: "New" })
      expect(mocks.replan).not.toHaveBeenCalled()
    })

    it("rejects setting a due date on a triggered goal", async () => {
      mocks.queryGoalById.mockResolvedValue(
        goal({ trigger: { rule: { mode: "daily", interval: 1 } } })
      )

      const updated = await updateGoal(goalId, {
        dueAt: new Date("2026-06-01T00:00:00"),
      })

      expect(updated).toBe(false)
      expect(mocks.patchGoal).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Triggered goals cannot use a fixed due date."
      )
    })

    it("rejects enabling a trigger while repeat tasks exist", async () => {
      mocks.queryTasksByGoal.mockResolvedValue([
        task({ repeat: { rule: { mode: "daily", interval: 1 } } }),
      ])

      const updated = await updateGoal(goalId, {
        trigger: { rule: { mode: "daily", interval: 1 } },
      })

      expect(updated).toBe(false)
      expect(mocks.patchGoal).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Triggered goals cannot contain repeating tasks."
      )
    })

    it("allows enabling a trigger when no repeat tasks exist", async () => {
      const updated = await updateGoal(goalId, {
        trigger: { rule: { mode: "daily", interval: 1 } },
      })

      expect(updated).toBe(true)
      expect(mocks.patchGoal).toHaveBeenCalledTimes(1)
      // Trigger changes alone do not schedule a replan (only dueAt does).
      expect(mocks.replan).not.toHaveBeenCalled()
    })

    it("replans after a due date change when the tree stays valid", async () => {
      mocks.queryDependencyByGoal.mockResolvedValue(dep())

      const updated = await updateGoal(goalId, {
        dueAt: new Date("2026-06-01T00:00:00"),
      })

      expect(updated).toBe(true)
      expect(mocks.replan).toHaveBeenCalledTimes(1)
    })

    it("rejects a due date change when tree repeat integrity breaks", async () => {
      mocks.queryDependencyByGoal.mockResolvedValue(dep())
      mocks.queryTasksByGoal.mockResolvedValue([
        task({
          repeat: {
            rule: { mode: "daily", interval: 1 },
            startsAt: new Date("2026-05-11T00:00:00"),
          },
        }),
      ])

      const updated = await updateGoal(goalId, {
        dueAt: new Date("2026-06-01T00:00:00"),
      })

      expect(updated).toBe(false)
      expect(mocks.patchGoal).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Pick both start and end dates for the repeat period."
      )
    })

    it("returns false when the patch updates no rows", async () => {
      mocks.patchGoal.mockResolvedValue(0)

      const updated = await updateGoal(goalId, { title: "New" })

      expect(updated).toBe(false)
      expect(mocks.replan).not.toHaveBeenCalled()
    })

    it("toasts the custom failure message when the patch throws", async () => {
      mocks.patchGoal.mockRejectedValue(new Error("boom"))

      const updated = await updateGoal(goalId, { title: "New" }, "Custom fail")

      expect(updated).toBe(false)
      expect(mocks.toastError).toHaveBeenCalledWith("Custom fail")
    })
  })

  describe("deleteGoal", () => {
    it("returns false when the goal does not exist", async () => {
      mocks.queryGoalById.mockResolvedValue(null)

      const deleted = await deleteGoal(goalId)

      expect(deleted).toBe(false)
      expect(mocks.deleteGoalCascadeAtomic).not.toHaveBeenCalled()
    })

    it("deletes through the atomic cascade and replans", async () => {
      const deleted = await deleteGoal(goalId)

      expect(deleted).toBe(true)
      expect(mocks.deleteGoalCascadeAtomic).toHaveBeenCalledWith(goalId)
      expect(mocks.replan).toHaveBeenCalledTimes(1)
    })

    it("toasts and returns false when deletion fails", async () => {
      mocks.deleteGoalCascadeAtomic.mockRejectedValue(new Error("boom"))

      const deleted = await deleteGoal(goalId)

      expect(deleted).toBe(false)
      expect(mocks.replan).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith("Failed to delete goal.")
    })
  })
})
