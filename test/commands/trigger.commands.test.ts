import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  GoalEntity,
  GoalTriggerConfig,
} from "@/domain/entities/GoalEntity"
import type { GoalID } from "@/domain/value-objects/types"

const mocks = vi.hoisted(() => ({
  setGoalTriggerAtomic: vi.fn(),
  setGoalTriggerWithTaskNormalizationAtomic: vi.fn(),
  createGoalWithTriggerAtomic: vi.fn(),
  deleteGoalTriggerAtomic: vi.fn(),
  deleteDayRunsByTasks: vi.fn(),
  replan: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  setGoalTriggerAtomic: mocks.setGoalTriggerAtomic,
  setGoalTriggerWithTaskNormalizationAtomic:
    mocks.setGoalTriggerWithTaskNormalizationAtomic,
  createGoalWithTriggerAtomic: mocks.createGoalWithTriggerAtomic,
  deleteGoalTriggerAtomic: mocks.deleteGoalTriggerAtomic,
  deleteDayRunsByTasks: mocks.deleteDayRunsByTasks,
}))

vi.mock("@/store/app-store", () => ({
  useAppStore: {
    getState: () => ({ replan: mocks.replan }),
  },
}))

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}))

const {
  saveGoalTrigger,
  saveGoalTriggerWithTaskNormalization,
  createGoalWithTrigger,
  deleteGoalTrigger,
} = await import("@/commands/trigger.commands")

const goalId = "goal-1" as GoalID
const dailyTrigger: GoalTriggerConfig = {
  rule: { mode: "daily", interval: 1 },
  setDueOnReset: true,
}

function createGoal(): GoalEntity {
  return {
    id: goalId,
    title: "Goal",
    createdAt: new Date("2026-05-10T09:00:00"),
  }
}

describe("trigger.commands", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setGoalTriggerAtomic.mockResolvedValue("saved")
    mocks.setGoalTriggerWithTaskNormalizationAtomic.mockResolvedValue({
      result: "saved",
      normalizedTaskIds: [],
    })
    mocks.createGoalWithTriggerAtomic.mockResolvedValue("created")
    mocks.deleteGoalTriggerAtomic.mockResolvedValue("deleted")
    mocks.deleteDayRunsByTasks.mockResolvedValue(undefined)
    mocks.replan.mockResolvedValue(undefined)
  })

  it("saves a goal trigger through the atomic repository helper", async () => {
    const saved = await saveGoalTrigger(goalId, dailyTrigger)

    expect(saved).toBe(true)
    expect(mocks.setGoalTriggerAtomic).toHaveBeenCalledWith(
      goalId,
      dailyTrigger
    )
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("rejects trigger creation on goals with repeating tasks", async () => {
    mocks.setGoalTriggerAtomic.mockResolvedValue("repeat-tasks")

    const saved = await saveGoalTrigger(goalId, dailyTrigger)

    expect(saved).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Triggered goals cannot contain repeating tasks."
    )
  })

  it("creates a triggered goal atomically", async () => {
    const goal = createGoal()

    const created = await createGoalWithTrigger(goal, dailyTrigger)

    expect(created).toBe(true)
    expect(mocks.createGoalWithTriggerAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        id: goalId,
        trigger: dailyTrigger,
      })
    )
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("deletes a trigger through the atomic repository helper", async () => {
    const deleted = await deleteGoalTrigger(goalId)

    expect(deleted).toBe(true)
    expect(mocks.deleteGoalTriggerAtomic).toHaveBeenCalledWith(goalId)
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("toasts and fails when the trigger save loses the goal", async () => {
    mocks.setGoalTriggerAtomic.mockResolvedValue("goal-not-found")

    const saved = await saveGoalTrigger(goalId, dailyTrigger)

    expect(saved).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith("Goal not found.")
  })

  it("toasts the custom failure message when the trigger save throws", async () => {
    mocks.setGoalTriggerAtomic.mockRejectedValue(new Error("boom"))

    const saved = await saveGoalTrigger(goalId, dailyTrigger, "Custom fail")

    expect(saved).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith("Custom fail")
  })

  it("returns false without replanning when trigger deletion misses the goal", async () => {
    mocks.deleteGoalTriggerAtomic.mockResolvedValue("goal-not-found")

    const deleted = await deleteGoalTrigger(goalId)

    expect(deleted).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
  })

  it("toasts the fallback message when trigger deletion throws", async () => {
    mocks.deleteGoalTriggerAtomic.mockRejectedValue(new Error("boom"))

    const deleted = await deleteGoalTrigger(goalId)

    expect(deleted).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to delete trigger.")
  })

  it("toasts the fallback message when triggered goal creation is rejected", async () => {
    mocks.createGoalWithTriggerAtomic.mockResolvedValue("goal-exists")

    const created = await createGoalWithTrigger(createGoal(), dailyTrigger)

    expect(created).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Failed to create triggered goal."
    )
  })

  it("toasts the fallback message when triggered goal creation throws", async () => {
    mocks.createGoalWithTriggerAtomic.mockRejectedValue(new Error("boom"))

    const created = await createGoalWithTrigger(createGoal(), dailyTrigger)

    expect(created).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Failed to create triggered goal."
    )
  })
})

describe("saveGoalTriggerWithTaskNormalization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setGoalTriggerWithTaskNormalizationAtomic.mockResolvedValue({
      result: "saved",
      normalizedTaskIds: [],
    })
    mocks.deleteDayRunsByTasks.mockResolvedValue(undefined)
    mocks.replan.mockResolvedValue(undefined)
  })

  it("saves without touching day runs when no task was normalized", async () => {
    const saved = await saveGoalTriggerWithTaskNormalization(
      goalId,
      dailyTrigger
    )

    expect(saved).toBe(true)
    expect(
      mocks.setGoalTriggerWithTaskNormalizationAtomic
    ).toHaveBeenCalledWith(goalId, dailyTrigger)
    expect(mocks.deleteDayRunsByTasks).not.toHaveBeenCalled()
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("drops the normalized tasks' day runs before replanning", async () => {
    mocks.setGoalTriggerWithTaskNormalizationAtomic.mockResolvedValue({
      result: "saved",
      normalizedTaskIds: ["task-1", "task-2"],
    })

    const saved = await saveGoalTriggerWithTaskNormalization(
      goalId,
      dailyTrigger
    )

    expect(saved).toBe(true)
    expect(mocks.deleteDayRunsByTasks).toHaveBeenCalledWith([
      "task-1",
      "task-2",
    ])
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("toasts the failure message when the goal is missing", async () => {
    mocks.setGoalTriggerWithTaskNormalizationAtomic.mockResolvedValue({
      result: "goal-not-found",
      normalizedTaskIds: [],
    })

    const saved = await saveGoalTriggerWithTaskNormalization(
      goalId,
      dailyTrigger,
      "Custom fail"
    )

    expect(saved).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith("Custom fail")
  })

  it("toasts the fallback message when the atomic save throws", async () => {
    mocks.setGoalTriggerWithTaskNormalizationAtomic.mockRejectedValue(
      new Error("boom")
    )

    const saved = await saveGoalTriggerWithTaskNormalization(
      goalId,
      dailyTrigger
    )

    expect(saved).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to save trigger.")
  })
})
