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
  patchTask: vi.fn(),
  putTask: vi.fn(),
  putTasks: vi.fn(),
  queryDependencyByGoal: vi.fn(),
  queryGoalById: vi.fn(),
  queryTaskById: vi.fn(),
  queryTasksByGoal: vi.fn(),
  queryRepeatLedger: vi.fn(),
  putRepeatLedger: vi.fn(),
  deleteRepeatLedger: vi.fn(),
  patchDep: vi.fn(),
  putDep: vi.fn(),
  deleteTaskCascadeAtomic: vi.fn(),
  deleteDayRunsByTasks: vi.fn(),
  rebindTaskGoalAtomic: vi.fn(),
  replan: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  patchTask: mocks.patchTask,
  putTask: mocks.putTask,
  putTasks: mocks.putTasks,
  queryDependencyByGoal: mocks.queryDependencyByGoal,
  queryGoalById: mocks.queryGoalById,
  queryTaskById: mocks.queryTaskById,
  queryTasksByGoal: mocks.queryTasksByGoal,
  queryRepeatLedger: mocks.queryRepeatLedger,
  putRepeatLedger: mocks.putRepeatLedger,
  deleteRepeatLedger: mocks.deleteRepeatLedger,
  patchDep: mocks.patchDep,
  putDep: mocks.putDep,
  deleteTaskCascadeAtomic: mocks.deleteTaskCascadeAtomic,
  deleteDayRunsByTasks: mocks.deleteDayRunsByTasks,
  rebindTaskGoalAtomic: mocks.rebindTaskGoalAtomic,
}))

vi.mock("@/store/app-store", () => ({
  useAppStore: {
    getState: () => ({ replan: mocks.replan }),
    setState: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}))

const {
  createTask,
  createTasks,
  updateTask,
  deleteTask,
  planTaskGoalRebind,
  rebindTaskGoal,
} = await import("@/commands/task.commands")

const goalId = "goal-1" as GoalID
const taskId = "task-1" as TaskID

function createGoal(patch: Partial<GoalEntity> = {}): GoalEntity {
  return {
    id: goalId,
    title: "Goal",
    createdAt: new Date("2026-05-10T09:00:00"),
    trigger: { rule: { mode: "daily", interval: 1 } },
    ...patch,
  }
}

function createTaskEntity(
  patch: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
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

describe("task.commands trigger-goal constraints", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryGoalById.mockResolvedValue(createGoal())
    mocks.queryDependencyByGoal.mockResolvedValue(null)
    mocks.queryTasksByGoal.mockResolvedValue([])
    mocks.queryTaskById.mockResolvedValue(createTaskEntity())
    mocks.putTask.mockResolvedValue(taskId)
    mocks.patchTask.mockResolvedValue(1)
    mocks.queryRepeatLedger.mockResolvedValue(null)
    mocks.putRepeatLedger.mockResolvedValue(undefined)
    mocks.deleteRepeatLedger.mockResolvedValue(undefined)
    mocks.replan.mockResolvedValue(undefined)
  })

  it("rejects creating a repeating task under a trigger-enabled goal", async () => {
    const created = await createTask(
      createTaskEntity({ repeat: { rule: { mode: "daily", interval: 1 } } })
    )

    expect(created).toBe(false)
    expect(mocks.putTask).not.toHaveBeenCalled()
    expect(mocks.replan).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Triggered goals cannot contain repeating tasks."
    )
  })

  it("allows creating a single-run task under a trigger-enabled goal", async () => {
    const created = await createTask(createTaskEntity())

    expect(created).toBe(true)
    expect(mocks.putTask).toHaveBeenCalledWith(createTaskEntity())
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("rejects updating a trigger-goal task into a repeating task", async () => {
    const updated = await updateTask(taskId, {
      repeat: { rule: { mode: "weekly", interval: 1, daysOfWeek: [1] } },
    })

    expect(updated).toBe(false)
    expect(mocks.patchTask).not.toHaveBeenCalled()
    expect(mocks.replan).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Triggered goals cannot contain repeating tasks."
    )
  })
})

// ── shared fixtures for the extended suites ─────────────────────────────────

const depId = "dep-1" as DependencyEntityID
const otherGoalId = "goal-2" as GoalID

const validRepeat = {
  rule: { mode: "daily", interval: 1 },
  startsAt: new Date("2026-05-11T00:00:00"),
  endsAt: new Date("2026-05-13T00:00:00"),
} as const

function plainGoal(patch: Partial<GoalEntity> = {}): GoalEntity {
  return createGoal({ trigger: undefined, ...patch })
}

function chainDep(): DependencyEntity {
  return {
    id: depId,
    belongTo: goalId,
    tree: [
      { data: "task-p", title: "P", parent: null, children: [1] },
      { data: taskId, title: "Task", parent: [0], children: [2] },
      { data: "task-c", title: "C", parent: [1], children: null },
    ],
  }
}

function resetTaskMocks(): void {
  vi.clearAllMocks()
  mocks.queryGoalById.mockResolvedValue(plainGoal())
  mocks.queryDependencyByGoal.mockResolvedValue(null)
  mocks.queryTasksByGoal.mockResolvedValue([])
  mocks.queryTaskById.mockResolvedValue(createTaskEntity())
  mocks.putTask.mockResolvedValue(taskId)
  mocks.putTasks.mockResolvedValue(undefined)
  mocks.patchTask.mockResolvedValue(1)
  mocks.queryRepeatLedger.mockResolvedValue(null)
  mocks.putRepeatLedger.mockResolvedValue(undefined)
  mocks.deleteRepeatLedger.mockResolvedValue(undefined)
  mocks.patchDep.mockResolvedValue(1)
  mocks.putDep.mockResolvedValue(depId)
  mocks.deleteTaskCascadeAtomic.mockResolvedValue(undefined)
  mocks.deleteDayRunsByTasks.mockResolvedValue(undefined)
  mocks.rebindTaskGoalAtomic.mockResolvedValue({
    result: "saved",
    normalized: false,
  })
  mocks.replan.mockResolvedValue(undefined)
}

describe("createTask", () => {
  beforeEach(resetTaskMocks)

  it("clears allowCrossDay on repeat tasks and syncs the ledger", async () => {
    const created = await createTask(
      createTaskEntity({ repeat: { ...validRepeat }, allowCrossDay: true })
    )

    expect(created).toBe(true)
    expect(mocks.putTask).toHaveBeenCalledWith(
      expect.objectContaining({ allowCrossDay: false })
    )
    const ledger = mocks.putRepeatLedger.mock.calls[0][0]
    expect(ledger.taskId).toBe(taskId)
    expect(Object.entries(ledger.points)).toEqual([
      ["2026-05-11", "planned"],
      ["2026-05-12", "planned"],
      ["2026-05-13", "planned"],
    ])
  })

  it("drops the ledger when the repeat window is unresolvable", async () => {
    // A repeat with neither start nor end resolves to no window: valid to
    // save, but there is nothing to enumerate into a ledger.
    const created = await createTask(
      createTaskEntity({ repeat: { rule: { mode: "daily", interval: 1 } } })
    )

    expect(created).toBe(true)
    expect(mocks.putRepeatLedger).not.toHaveBeenCalled()
    expect(mocks.deleteRepeatLedger).toHaveBeenCalledWith(taskId)
  })

  it("rejects a partial repeat range", async () => {
    const created = await createTask(
      createTaskEntity({
        repeat: {
          rule: { mode: "daily", interval: 1 },
          startsAt: new Date("2026-05-11T00:00:00"),
        },
      })
    )

    expect(created).toBe(false)
    expect(mocks.putTask).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Pick both start and end dates for the repeat period."
    )
  })

  it("rejects a total above the planned occurrences in the window", async () => {
    const created = await createTask(
      createTaskEntity({ repeat: { ...validRepeat }, total: 5 })
    )

    expect(created).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Completion count cannot exceed the 3 planned occurrences in the repeat window."
    )
  })

  it("rejects a task combining trigger and repeat", async () => {
    const created = await createTask(
      createTaskEntity({
        trigger: { rule: { mode: "daily", interval: 1 } },
        repeat: { ...validRepeat },
      })
    )

    expect(created).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Triggered tasks cannot use a repeat rule."
    )
  })

  it("rejects a task combining trigger and due date", async () => {
    const created = await createTask(
      createTaskEntity({
        trigger: { rule: { mode: "daily", interval: 1 } },
        dueAt: new Date("2026-06-01T00:00:00"),
      })
    )

    expect(created).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Triggered tasks cannot use a due date."
    )
  })

  it("skips goal context queries for a standalone task", async () => {
    const created = await createTask(createTaskEntity({ goalId: undefined }))

    expect(created).toBe(true)
    expect(mocks.queryGoalById).not.toHaveBeenCalled()
    expect(mocks.queryDependencyByGoal).not.toHaveBeenCalled()
  })

  it("toasts the custom failure message when persistence throws", async () => {
    mocks.putTask.mockRejectedValue(new Error("boom"))

    const created = await createTask(createTaskEntity(), "Custom create fail")

    expect(created).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith("Custom create fail")
  })
})

describe("createTasks", () => {
  beforeEach(resetTaskMocks)

  it("returns true immediately for an empty batch", async () => {
    const created = await createTasks([])

    expect(created).toBe(true)
    expect(mocks.putTasks).not.toHaveBeenCalled()
    expect(mocks.replan).not.toHaveBeenCalled()
  })

  it("persists a batch in one bulk write with normalization applied", async () => {
    const single = createTaskEntity()
    const repeating = createTaskEntity({
      id: "task-2" as TaskID,
      repeat: { ...validRepeat },
      allowCrossDay: true,
    })

    const created = await createTasks([single, repeating])

    expect(created).toBe(true)
    expect(mocks.putTasks).toHaveBeenCalledTimes(1)
    expect(mocks.putTasks).toHaveBeenCalledWith(
      [single, expect.objectContaining({ id: "task-2", allowCrossDay: false })],
      // Ledgers ride the same transaction: none for the single task, a merged
      // ledger for the repeating one.
      [
        { taskId, ledger: null },
        {
          taskId: "task-2",
          ledger: expect.objectContaining({ taskId: "task-2" }),
        },
      ]
    )
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("aborts the whole batch when one task fails validation", async () => {
    const invalid = createTaskEntity({
      id: "task-2" as TaskID,
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-11T00:00:00"),
      },
    })

    const created = await createTasks([createTaskEntity(), invalid])

    expect(created).toBe(false)
    expect(mocks.putTasks).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Pick both start and end dates for the repeat period."
    )
  })

  it("toasts the fallback message when the bulk write throws", async () => {
    mocks.putTasks.mockRejectedValue(new Error("boom"))

    const created = await createTasks([createTaskEntity()])

    expect(created).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to create tasks.")
  })
})

describe("updateTask", () => {
  beforeEach(resetTaskMocks)

  it("returns false when the task does not exist", async () => {
    mocks.queryTaskById.mockResolvedValue(null)

    const updated = await updateTask(taskId, { notes: "x" })

    expect(updated).toBe(false)
    expect(mocks.patchTask).not.toHaveBeenCalled()
  })

  it("applies a plain patch without validation or replan", async () => {
    const updated = await updateTask(taskId, { notes: "x" })

    expect(updated).toBe(true)
    expect(mocks.queryGoalById).not.toHaveBeenCalled()
    expect(mocks.patchTask).toHaveBeenCalledWith(taskId, { notes: "x" })
    expect(mocks.replan).not.toHaveBeenCalled()
  })

  it("propagates a title change into the dependency tree", async () => {
    mocks.queryDependencyByGoal.mockResolvedValue(chainDep())

    const updated = await updateTask(taskId, { title: "Renamed" })

    expect(updated).toBe(true)
    expect(mocks.patchDep).toHaveBeenCalledWith(depId, {
      tree: [
        { data: "task-p", title: "P", parent: null, children: [1] },
        { data: taskId, title: "Renamed", parent: [0], children: [2] },
        { data: "task-c", title: "C", parent: [1], children: null },
      ],
    })
  })

  it("leaves the dependency untouched when the task is not in its tree", async () => {
    const dep = chainDep()
    dep.tree.splice(1, 1)
    mocks.queryDependencyByGoal.mockResolvedValue(dep)

    const updated = await updateTask(taskId, { title: "Renamed" })

    expect(updated).toBe(true)
    expect(mocks.patchDep).not.toHaveBeenCalled()
  })

  it("returns false when the patch updates no rows", async () => {
    mocks.patchTask.mockResolvedValue(0)

    const updated = await updateTask(taskId, { notes: "x" })

    expect(updated).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
  })

  it("syncs the ledger and clears old runs when a task turns repeat", async () => {
    const updated = await updateTask(taskId, { repeat: { ...validRepeat } })

    expect(updated).toBe(true)
    expect(mocks.putRepeatLedger).toHaveBeenCalledTimes(1)
    expect(mocks.deleteDayRunsByTasks).toHaveBeenCalledWith([taskId])
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("deletes the ledger when the repeat rule is removed", async () => {
    mocks.queryTaskById.mockResolvedValue(
      createTaskEntity({ repeat: { ...validRepeat } })
    )

    const updated = await updateTask(taskId, { repeat: undefined })

    expect(updated).toBe(true)
    expect(mocks.deleteRepeatLedger).toHaveBeenCalledWith(taskId)
    expect(mocks.deleteDayRunsByTasks).not.toHaveBeenCalled()
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("toasts the fallback message when the patch throws", async () => {
    mocks.patchTask.mockRejectedValue(new Error("boom"))

    const updated = await updateTask(taskId, { notes: "x" })

    expect(updated).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to update task.")
  })
})

describe("deleteTask", () => {
  beforeEach(resetTaskMocks)

  it("returns false when the task does not exist", async () => {
    mocks.queryTaskById.mockResolvedValue(null)

    const deleted = await deleteTask(taskId)

    expect(deleted).toBe(false)
    expect(mocks.deleteTaskCascadeAtomic).not.toHaveBeenCalled()
  })

  it("deletes a standalone task through the atomic cascade", async () => {
    mocks.queryTaskById.mockResolvedValue(
      createTaskEntity({ goalId: undefined })
    )

    const deleted = await deleteTask(taskId)

    expect(deleted).toBe(true)
    expect(mocks.queryGoalById).not.toHaveBeenCalled()
    expect(mocks.deleteTaskCascadeAtomic).toHaveBeenCalledWith(taskId, [])
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("bridges the dependency chain around the removed node", async () => {
    mocks.queryDependencyByGoal.mockResolvedValue(chainDep())
    mocks.queryTasksByGoal.mockResolvedValue([
      createTaskEntity({ id: "task-p" as TaskID }),
      createTaskEntity(),
      createTaskEntity({ id: "task-c" as TaskID }),
    ])

    const deleted = await deleteTask(taskId)

    expect(deleted).toBe(true)
    expect(mocks.deleteTaskCascadeAtomic).toHaveBeenCalledWith(taskId, [
      {
        id: depId,
        belongTo: goalId,
        tree: [
          { data: "task-p", title: "P", parent: null, children: [1] },
          { data: "task-c", title: "C", parent: [0], children: null },
        ],
      },
    ])
  })

  it("keeps the dependency untouched when the node is absent", async () => {
    const dep = chainDep()
    dep.tree.splice(1, 1)
    mocks.queryDependencyByGoal.mockResolvedValue(dep)

    const deleted = await deleteTask(taskId)

    expect(deleted).toBe(true)
    expect(mocks.deleteTaskCascadeAtomic).toHaveBeenCalledWith(taskId, [])
  })

  it("refuses the deletion when the remaining tree loses repeat integrity", async () => {
    const invalidSibling = createTaskEntity({
      id: "task-p" as TaskID,
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-11T00:00:00"),
      },
    })
    mocks.queryDependencyByGoal.mockResolvedValue(chainDep())
    mocks.queryTasksByGoal.mockResolvedValue([
      invalidSibling,
      createTaskEntity(),
      createTaskEntity({ id: "task-c" as TaskID }),
    ])

    const deleted = await deleteTask(taskId)

    expect(deleted).toBe(false)
    expect(mocks.deleteTaskCascadeAtomic).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Pick both start and end dates for the repeat period."
    )
  })

  it("toasts the fallback message when deletion throws", async () => {
    mocks.deleteTaskCascadeAtomic.mockRejectedValue(new Error("boom"))

    const deleted = await deleteTask(taskId)

    expect(deleted).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to delete task.")
  })
})

describe("planTaskGoalRebind", () => {
  beforeEach(resetTaskMocks)

  it("returns null when the task does not exist", async () => {
    mocks.queryTaskById.mockResolvedValue(null)

    expect(await planTaskGoalRebind(taskId, otherGoalId)).toBeNull()
  })

  it("returns null when the goal is unchanged", async () => {
    expect(await planTaskGoalRebind(taskId, goalId)).toBeNull()
  })

  it("requires normalization when detaching a counter task to standalone", async () => {
    mocks.queryTaskById.mockResolvedValue(createTaskEntity({ total: 3 }))

    const plan = await planTaskGoalRebind(taskId, undefined)

    expect(plan).toEqual({
      taskId,
      fromGoalId: goalId,
      toGoalId: undefined,
      requiresNormalization: true,
    })
    expect(mocks.queryGoalById).not.toHaveBeenCalled()
  })

  it("requires normalization when moving a repeat task under a triggered goal", async () => {
    mocks.queryTaskById.mockResolvedValue(
      createTaskEntity({ repeat: { ...validRepeat } })
    )
    mocks.queryGoalById.mockResolvedValue(
      createGoal({ id: otherGoalId })
    )

    const plan = await planTaskGoalRebind(taskId, otherGoalId)

    expect(plan?.requiresNormalization).toBe(true)
  })

  it("needs no normalization when moving a counter task to a plain goal", async () => {
    mocks.queryTaskById.mockResolvedValue(createTaskEntity({ total: 3 }))
    mocks.queryGoalById.mockResolvedValue(
      plainGoal({ id: otherGoalId })
    )

    const plan = await planTaskGoalRebind(taskId, otherGoalId)

    expect(plan?.requiresNormalization).toBe(false)
  })

  it("needs no normalization when detaching a single-run task", async () => {
    const plan = await planTaskGoalRebind(taskId, undefined)

    expect(plan?.requiresNormalization).toBe(false)
  })
})

describe("rebindTaskGoal", () => {
  beforeEach(resetTaskMocks)

  it("returns false when the task does not exist", async () => {
    mocks.queryTaskById.mockResolvedValue(null)

    expect(await rebindTaskGoal(taskId, otherGoalId)).toBe(false)
    expect(mocks.rebindTaskGoalAtomic).not.toHaveBeenCalled()
  })

  it("is a no-op success when the goal is unchanged", async () => {
    expect(await rebindTaskGoal(taskId, goalId)).toBe(true)
    expect(mocks.rebindTaskGoalAtomic).not.toHaveBeenCalled()
    expect(mocks.replan).not.toHaveBeenCalled()
  })

  it("rebinds through the atomic helper and replans", async () => {
    const moved = await rebindTaskGoal(taskId, otherGoalId)

    expect(moved).toBe(true)
    expect(mocks.rebindTaskGoalAtomic).toHaveBeenCalledWith({
      taskId,
      toGoalId: otherGoalId,
      normalize: false,
      newDependencyId: expect.any(String),
    })
    expect(mocks.deleteDayRunsByTasks).not.toHaveBeenCalled()
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("drops stale day runs when the rebind normalized the task", async () => {
    mocks.rebindTaskGoalAtomic.mockResolvedValue({
      result: "saved",
      normalized: true,
    })

    const moved = await rebindTaskGoal(taskId, otherGoalId, {
      normalize: true,
    })

    expect(moved).toBe(true)
    expect(mocks.rebindTaskGoalAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ normalize: true })
    )
    expect(mocks.deleteDayRunsByTasks).toHaveBeenCalledWith([taskId])
  })

  it("returns false when the atomic rebind loses the task", async () => {
    mocks.rebindTaskGoalAtomic.mockResolvedValue({ result: "task-not-found" })

    expect(await rebindTaskGoal(taskId, otherGoalId)).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
  })

  it("toasts the fallback message when the rebind throws", async () => {
    mocks.rebindTaskGoalAtomic.mockRejectedValue(new Error("boom"))

    expect(await rebindTaskGoal(taskId, otherGoalId)).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to move task.")
  })
})
