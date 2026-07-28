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
  queryGoalById: vi.fn(),
  queryTasksByGoal: vi.fn(),
  queryDependencyById: vi.fn(),
  putDep: vi.fn(),
  patchDep: vi.fn(),
  deleteDep: vi.fn(),
  replan: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  queryGoalById: mocks.queryGoalById,
  queryTasksByGoal: mocks.queryTasksByGoal,
  queryDependencyById: mocks.queryDependencyById,
  putDep: mocks.putDep,
  patchDep: mocks.patchDep,
  deleteDep: mocks.deleteDep,
}))

vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: () => ({ replan: mocks.replan }) },
}))

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))

const { createDependency, updateDependency, deleteDependency } = await import(
  "@/commands/dependency.commands"
)

const goalId = "goal-1" as GoalID
const depId = "dep-1" as DependencyEntityID
const taskAId = "task-a" as TaskID
const taskBId = "task-b" as TaskID

function goal(): GoalEntity {
  return {
    id: goalId,
    title: "Goal",
    createdAt: new Date("2026-05-10T09:00:00"),
  }
}

function task(id: TaskID, patch: Partial<TaskGroupEntity> = {}): TaskGroupEntity {
  return {
    id,
    goalId,
    title: `Task ${id}`,
    createdAt: new Date("2026-05-10T09:00:00"),
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

function chainDep(): DependencyEntity {
  return {
    id: depId,
    belongTo: goalId,
    tree: [
      { data: taskAId, title: "A", parent: null, children: [1] },
      { data: taskBId, title: "B", parent: [0], children: null },
    ],
  }
}

// A task with only a repeat start date is invalid (partial range) and makes
// validateTreeRepeatIntegrity fail for any tree containing it.
function partialRepeatTask(id: TaskID): TaskGroupEntity {
  return task(id, {
    repeat: {
      rule: { mode: "daily", interval: 1 },
      startsAt: new Date("2026-05-11T00:00:00"),
    },
  })
}

describe("dependency.commands", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryGoalById.mockResolvedValue(goal())
    mocks.queryTasksByGoal.mockResolvedValue([task(taskAId), task(taskBId)])
    mocks.queryDependencyById.mockResolvedValue(chainDep())
    mocks.putDep.mockResolvedValue(depId)
    mocks.patchDep.mockResolvedValue(1)
    mocks.deleteDep.mockResolvedValue(undefined)
    mocks.replan.mockResolvedValue(undefined)
  })

  describe("createDependency", () => {
    it("persists a valid dependency tree and replans", async () => {
      const created = await createDependency(chainDep())

      expect(created).toBe(true)
      expect(mocks.putDep).toHaveBeenCalledWith(chainDep())
      expect(mocks.replan).toHaveBeenCalledTimes(1)
    })

    it("rejects a tree containing a task with a partial repeat range", async () => {
      mocks.queryTasksByGoal.mockResolvedValue([
        partialRepeatTask(taskAId),
        task(taskBId),
      ])

      const created = await createDependency(chainDep())

      expect(created).toBe(false)
      expect(mocks.putDep).not.toHaveBeenCalled()
      expect(mocks.replan).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Pick both start and end dates for the repeat period."
      )
    })

    it("toasts the fallback message when persistence fails", async () => {
      mocks.putDep.mockRejectedValue(new Error("boom"))

      const created = await createDependency(chainDep())

      expect(created).toBe(false)
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to update dependency graph."
      )
    })
  })

  describe("updateDependency", () => {
    it("returns false when the dependency does not exist", async () => {
      mocks.queryDependencyById.mockResolvedValue(null)

      const updated = await updateDependency(depId, { tree: [] })

      expect(updated).toBe(false)
      expect(mocks.patchDep).not.toHaveBeenCalled()
    })

    it("skips tree validation when the patch has no tree", async () => {
      const updated = await updateDependency(depId, { belongTo: goalId })

      expect(updated).toBe(true)
      expect(mocks.queryGoalById).not.toHaveBeenCalled()
      expect(mocks.patchDep).toHaveBeenCalledWith(depId, { belongTo: goalId })
      expect(mocks.replan).toHaveBeenCalledTimes(1)
    })

    it("validates and applies a tree patch", async () => {
      const nextTree = chainDep().tree
      const updated = await updateDependency(depId, { tree: nextTree })

      expect(updated).toBe(true)
      expect(mocks.patchDep).toHaveBeenCalledWith(depId, { tree: nextTree })
      expect(mocks.replan).toHaveBeenCalledTimes(1)
    })

    it("rejects a tree patch that breaks repeat integrity", async () => {
      mocks.queryTasksByGoal.mockResolvedValue([
        partialRepeatTask(taskAId),
        task(taskBId),
      ])

      const updated = await updateDependency(depId, { tree: chainDep().tree })

      expect(updated).toBe(false)
      expect(mocks.patchDep).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Pick both start and end dates for the repeat period."
      )
    })

    it("returns false when the patch updates no rows", async () => {
      mocks.patchDep.mockResolvedValue(0)

      const updated = await updateDependency(depId, { belongTo: goalId })

      expect(updated).toBe(false)
      expect(mocks.replan).not.toHaveBeenCalled()
    })

    it("toasts the custom failure message when the patch throws", async () => {
      mocks.patchDep.mockRejectedValue(new Error("boom"))

      const updated = await updateDependency(
        depId,
        { belongTo: goalId },
        "Custom failure"
      )

      expect(updated).toBe(false)
      expect(mocks.toastError).toHaveBeenCalledWith("Custom failure")
    })
  })

  describe("deleteDependency", () => {
    it("deletes the dependency and replans", async () => {
      const deleted = await deleteDependency(depId)

      expect(deleted).toBe(true)
      expect(mocks.deleteDep).toHaveBeenCalledWith(depId)
      expect(mocks.replan).toHaveBeenCalledTimes(1)
    })

    it("toasts and returns false when deletion fails", async () => {
      mocks.deleteDep.mockRejectedValue(new Error("boom"))

      const deleted = await deleteDependency(depId)

      expect(deleted).toBe(false)
      expect(mocks.replan).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to update dependency graph."
      )
    })
  })
})
