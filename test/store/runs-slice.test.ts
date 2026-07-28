import { describe, expect, it, vi, beforeEach } from "vitest"

import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import {
  createStableActivityId,
  createStableRepeatResolutionActivityId,
} from "@/domain/entities/ActivityEntity"
import { counterRunId } from "@/utils/task-runtime"
import { toLocalDateKey } from "@/utils/date"

const mocks = vi.hoisted(() => ({
  queryDayRun: vi.fn(),
  queryDayRunsByTask: vi.fn(),
  queryTaskById: vi.fn(),
  applyRunMutation: vi.fn(),
  clearDayRuns: vi.fn(),
  putManualFocus: vi.fn(),
  deleteManualFocus: vi.fn(),
  deleteAutoRunsForGoal: vi.fn(),
  replan: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  queryDayRun: mocks.queryDayRun,
  queryDayRunsByTask: mocks.queryDayRunsByTask,
  queryTaskById: mocks.queryTaskById,
  applyRunMutation: mocks.applyRunMutation,
  clearDayRuns: mocks.clearDayRuns,
  putManualFocus: mocks.putManualFocus,
  deleteManualFocus: mocks.deleteManualFocus,
  deleteAutoRunsForGoal: mocks.deleteAutoRunsForGoal,
}))

const { createRunsSlice } = await import("@/store/slices/runs.slice")

const taskId = "task-1" as TaskID
const dateKey = LocalDateKeySchema.parse("2026-07-24")
const runId = `${taskId}::${dateKey}` as TaskRuntimeID

const task: TaskGroupEntity = {
  id: taskId,
  title: "Repeat task",
  createdAt: new Date("2026-07-01T09:00:00"),
  total: 5,
  completedCount: 1,
  repeat: {
    rule: { mode: "daily", interval: 1 },
    startsAt: new Date("2026-07-01T00:00:00"),
    endsAt: new Date("2026-07-31T00:00:00"),
  },
}

const repeatRun: DayRunEntity = {
  id: runId,
  taskId,
  arrangementStatus: "inProgress",
  source: "repeatPolicy",
  plannedForDate: dateKey,
  dateKey,
}

function createSlice() {
  const state = { replan: mocks.replan }
  return createRunsSlice(
    vi.fn(),
    () => state as never,
    {} as never
  )
}

async function flush() {
  await vi.waitFor(() => expect(mocks.applyRunMutation).toHaveBeenCalled())
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.applyRunMutation.mockResolvedValue(undefined)
  mocks.replan.mockResolvedValue(undefined)
})

describe("transitionTaskStatus (dayRuns)", () => {
  it("commits run status, activity, counter and ledger point as ONE mutation", async () => {
    mocks.queryDayRun.mockResolvedValue(repeatRun)
    mocks.queryTaskById.mockResolvedValue(task)

    createSlice().transitionTaskStatus(runId, "done")
    await flush()

    // The invariant contract: everything a completion touches rides a single
    // applyRunMutation call (one Dexie transaction) — never split across calls.
    expect(mocks.applyRunMutation).toHaveBeenCalledTimes(1)
    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.putRuns).toEqual([
      { ...repeatRun, arrangementStatus: "done" },
    ])
    expect(mutation.putActivities).toEqual([
      expect.objectContaining({
        id: `act::task-done::${runId}`,
        kind: "task-done",
        taskId,
        plannedForDate: dateKey,
      }),
    ])
    // completedCount is not patched in place: it is re-derived from the records
    // above at the end of the same transaction.
    expect(mutation.taskPatches).toBeUndefined()
    expect(mutation.recomputeCompletedCountFor).toEqual([taskId])
    expect(mutation.ledgerMarks).toEqual([
      { taskId, dateKey, status: "completed" },
    ])
    expect(mocks.replan).toHaveBeenCalledWith("partial")
  })

  it("retracting done reverses counter and ledger in the same mutation", async () => {
    mocks.queryDayRun.mockResolvedValue({
      ...repeatRun,
      arrangementStatus: "done",
    })
    mocks.queryTaskById.mockResolvedValue({ ...task, completedCount: 2 })

    createSlice().transitionTaskStatus(runId, "todo")
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.deleteActivityIds).toEqual([`act::task-done::${runId}`])
    expect(mutation.taskPatches).toBeUndefined()
    expect(mutation.recomputeCompletedCountFor).toEqual([taskId])
    expect(mutation.ledgerMarks).toEqual([
      { taskId, dateKey, status: "planned" },
    ])
  })
})

describe("removeTaskRuntime (dayRuns)", () => {
  it("removing a manual run of a trigger task records the dismissal atomically", async () => {
    const manualRun: DayRunEntity = {
      id: taskId as unknown as TaskRuntimeID,
      taskId,
      arrangementStatus: "todo",
      source: "manual",
      dateKey,
    }
    mocks.queryDayRun.mockResolvedValue(manualRun)
    mocks.queryTaskById.mockResolvedValue({
      ...task,
      repeat: undefined,
      trigger: { rule: { mode: "daily", interval: 1 } },
    })

    createSlice().removeTaskRuntime(manualRun.id)
    await flush()

    expect(mocks.applyRunMutation).toHaveBeenCalledTimes(1)
    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.deleteRunIds).toEqual([manualRun.id])
    expect(mutation.putDismissals).toEqual([
      expect.objectContaining({ taskId }),
    ])
  })

  it("skipping a repeat run deletes it and marks the ledger point together", async () => {
    mocks.queryDayRun.mockResolvedValue({
      ...repeatRun,
      arrangementStatus: "todo",
    })
    mocks.queryTaskById.mockResolvedValue(task)

    createSlice().skipRepeatTask(runId)
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.deleteRunIds).toEqual([runId])
    expect(mutation.putActivities).toEqual([
      expect.objectContaining({ kind: "repeat-skip", taskId }),
    ])
    expect(mutation.ledgerMarks).toEqual([
      { taskId, dateKey, status: "skipped" },
    ])
  })

  it("removing a repeat run routes to skip semantics (no ghost reappearance)", async () => {
    mocks.queryDayRun.mockResolvedValue({
      ...repeatRun,
      arrangementStatus: "todo",
    })
    mocks.queryTaskById.mockResolvedValue(task)

    // removeTaskRuntime re-enters the slice via get().skipRepeatTask, so the
    // fake state must contain the slice's own actions.
    const state: Record<string, unknown> = { replan: mocks.replan }
    const slice = createRunsSlice(vi.fn(), () => state as never, {} as never)
    Object.assign(state, slice)

    slice.removeTaskRuntime(runId)
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.deleteRunIds).toEqual([runId])
    expect(mutation.putActivities).toEqual([
      expect.objectContaining({ kind: "repeat-skip" }),
    ])
  })

  it("removing an open auto-planned run records a dismissal", async () => {
    mocks.queryDayRun.mockResolvedValue({
      id: runId,
      taskId,
      arrangementStatus: "todo",
      source: "default",
      dateKey,
    })
    mocks.queryTaskById.mockResolvedValue({ ...task, repeat: undefined })

    createSlice().removeTaskRuntime(runId)
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.deleteRunIds).toEqual([runId])
    expect(mutation.putDismissals).toEqual([
      expect.objectContaining({ taskId }),
    ])
    expect(mocks.replan).toHaveBeenCalledWith("partial")
  })

  it("removing a done manual run of a plain task records no dismissal", async () => {
    mocks.queryDayRun.mockResolvedValue({
      id: runId,
      taskId,
      arrangementStatus: "done",
      source: "manual",
      dateKey,
    })
    mocks.queryTaskById.mockResolvedValue({ ...task, repeat: undefined })

    createSlice().removeTaskRuntime(runId)
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.putDismissals).toBeUndefined()
  })

  it("does nothing when the run no longer exists", async () => {
    mocks.queryDayRun.mockResolvedValue(undefined)

    createSlice().removeTaskRuntime(runId)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.applyRunMutation).not.toHaveBeenCalled()
    expect(mocks.replan).not.toHaveBeenCalled()
  })
})

describe("setGoalFocus", () => {
  const goalId = "goal-1" as GoalID

  it("focusing writes a day-scoped manual focus then replans the focus scope", async () => {
    mocks.putManualFocus.mockResolvedValue(undefined)

    createSlice().setGoalFocus(goalId, true)
    await vi.waitFor(() => expect(mocks.replan).toHaveBeenCalledWith("focus"))

    expect(mocks.putManualFocus).toHaveBeenCalledWith(
      goalId,
      toLocalDateKey(new Date())
    )
    expect(mocks.deleteManualFocus).not.toHaveBeenCalled()
  })

  it("unfocusing removes the focus intent AND the goal's auto-planned runs", async () => {
    mocks.deleteManualFocus.mockResolvedValue(undefined)
    mocks.deleteAutoRunsForGoal.mockResolvedValue(undefined)

    createSlice().setGoalFocus(goalId, false)
    await vi.waitFor(() => expect(mocks.replan).toHaveBeenCalledWith("focus"))

    expect(mocks.deleteManualFocus).toHaveBeenCalledWith(goalId)
    expect(mocks.deleteAutoRunsForGoal).toHaveBeenCalledWith(goalId)
    expect(mocks.putManualFocus).not.toHaveBeenCalled()
  })
})

describe("upsertTaskRuntime", () => {
  it("stamps the runtime as a today dayRun and clears a manual dismissal", async () => {
    createSlice().upsertTaskRuntime({
      id: runId,
      taskId,
      arrangementStatus: "todo",
      source: "manual",
    })
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.putRuns).toEqual([
      {
        id: runId,
        taskId,
        arrangementStatus: "todo",
        source: "manual",
        dateKey: toLocalDateKey(new Date()),
      },
    ])
    expect(mutation.deleteDismissalTaskIds).toEqual([taskId])
    expect(mocks.replan).toHaveBeenCalledWith("partial")
  })

  it("does not clear dismissals for non-manual runtimes", async () => {
    createSlice().upsertTaskRuntime({
      id: runId,
      taskId,
      arrangementStatus: "todo",
      source: "default",
    })
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.deleteDismissalTaskIds).toBeUndefined()
  })
})

describe("addTaskRun", () => {
  it("creates the first date-scoped counter run of the day", async () => {
    mocks.queryDayRunsByTask.mockResolvedValue([])

    createSlice().addTaskRun(taskId)
    await flush()

    const todayKey = toLocalDateKey(new Date())
    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.putRuns).toEqual([
      {
        id: counterRunId(taskId, todayKey, 1),
        taskId,
        arrangementStatus: "todo",
        source: "manual",
        dateKey: todayKey,
      },
    ])
    expect(mutation.deleteDismissalTaskIds).toEqual([taskId])
    expect(mocks.replan).toHaveBeenCalledWith("partial")
  })

  it("picks the lowest unused sequence for today", async () => {
    const todayKey = toLocalDateKey(new Date())
    const existingId = counterRunId(taskId, todayKey, 1)
    mocks.queryDayRunsByTask.mockResolvedValue([
      {
        id: existingId,
        taskId,
        arrangementStatus: "done",
        source: "manual",
        dateKey: todayKey,
      },
    ])

    createSlice().addTaskRun(taskId)
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.putRuns[0].id).toBe(counterRunId(taskId, todayKey, 2))
  })
})

describe("transitionTaskStatus edge branches", () => {
  it("is a no-op when the status does not change", async () => {
    mocks.queryDayRun.mockResolvedValue(repeatRun)

    createSlice().transitionTaskStatus(runId, "inProgress")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.applyRunMutation).not.toHaveBeenCalled()
    expect(mocks.replan).not.toHaveBeenCalled()
  })

  it("is a no-op when the run does not exist", async () => {
    mocks.queryDayRun.mockResolvedValue(undefined)

    createSlice().transitionTaskStatus(runId, "done")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.applyRunMutation).not.toHaveBeenCalled()
  })

  it("entering inProgress records a task-in-progress activity without counters", async () => {
    mocks.queryDayRun.mockResolvedValue({
      ...repeatRun,
      arrangementStatus: "todo",
    })
    mocks.queryTaskById.mockResolvedValue(task)

    createSlice().transitionTaskStatus(runId, "inProgress")
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.putActivities).toEqual([
      expect.objectContaining({
        id: createStableActivityId("task-in-progress", runId),
        kind: "task-in-progress",
      }),
    ])
    expect(mutation.recomputeCompletedCountFor).toBeUndefined()
    expect(mutation.ledgerMarks).toBeUndefined()
  })

  it("backing out of inProgress removes the task-in-progress activity", async () => {
    mocks.queryDayRun.mockResolvedValue(repeatRun) // inProgress
    mocks.queryTaskById.mockResolvedValue(task)

    createSlice().transitionTaskStatus(runId, "todo")
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.deleteActivityIds).toEqual([
      createStableActivityId("task-in-progress", runId),
    ])
  })

  it("completing a non-repeat run recomputes the counter without ledger marks", async () => {
    const manualId = taskId as unknown as TaskRuntimeID
    mocks.queryDayRun.mockResolvedValue({
      id: manualId,
      taskId,
      arrangementStatus: "todo",
      source: "manual",
      dateKey,
    })
    mocks.queryTaskById.mockResolvedValue({ ...task, repeat: undefined })

    createSlice().transitionTaskStatus(manualId, "done")
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.ledgerMarks).toBeUndefined()
    expect(mutation.recomputeCompletedCountFor).toEqual([taskId])
  })

  it("still updates the run when the task record is gone", async () => {
    mocks.queryDayRun.mockResolvedValue({
      ...repeatRun,
      arrangementStatus: "todo",
    })
    mocks.queryTaskById.mockResolvedValue(undefined)

    createSlice().transitionTaskStatus(runId, "done")
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.putRuns).toEqual([
      { ...repeatRun, arrangementStatus: "done" },
    ])
    expect(mutation.putActivities).toBeUndefined()
    expect(mocks.replan).toHaveBeenCalledWith("partial")
  })
})

describe("resolveRepeatDebt", () => {
  it("resolving as done writes the resolution activity, ledger point and counter atomically", async () => {
    mocks.queryDayRun.mockResolvedValue({
      ...repeatRun,
      arrangementStatus: "todo",
    })
    mocks.queryTaskById.mockResolvedValue(task)

    createSlice().resolveRepeatDebt(runId, "done")
    await flush()

    expect(mocks.applyRunMutation).toHaveBeenCalledTimes(1)
    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.deleteRunIds).toEqual([runId])
    expect(mutation.putActivities).toEqual([
      expect.objectContaining({
        id: createStableRepeatResolutionActivityId("task-done", taskId, dateKey),
        kind: "task-done",
        plannedForDate: dateKey,
      }),
    ])
    expect(mutation.ledgerMarks).toEqual([
      { taskId, dateKey, status: "completed" },
    ])
    expect(mutation.recomputeCompletedCountFor).toEqual([taskId])
  })

  it("resolving as skip marks the point skipped", async () => {
    mocks.queryDayRun.mockResolvedValue({
      ...repeatRun,
      arrangementStatus: "todo",
    })
    mocks.queryTaskById.mockResolvedValue(task)

    createSlice().resolveRepeatDebt(runId, "skip")
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.putActivities).toEqual([
      expect.objectContaining({ kind: "repeat-skip" }),
    ])
    expect(mutation.ledgerMarks).toEqual([
      { taskId, dateKey, status: "skipped" },
    ])
  })

  it("ignores non-repeat runs (no plannedForDate)", async () => {
    mocks.queryDayRun.mockResolvedValue({
      id: runId,
      taskId,
      arrangementStatus: "todo",
      source: "manual",
      dateKey,
    })

    createSlice().resolveRepeatDebt(runId, "done")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.applyRunMutation).not.toHaveBeenCalled()
    expect(mocks.replan).not.toHaveBeenCalled()
  })

  it("just drops the run when the task record is gone", async () => {
    mocks.queryDayRun.mockResolvedValue({
      ...repeatRun,
      arrangementStatus: "todo",
    })
    mocks.queryTaskById.mockResolvedValue(undefined)

    createSlice().resolveRepeatDebt(runId, "done")
    await flush()

    expect(mocks.applyRunMutation).toHaveBeenCalledWith({
      deleteRunIds: [runId],
    })
    expect(mocks.replan).toHaveBeenCalledWith("partial")
  })
})

describe("restoreSkippedRepeatTask", () => {
  it("recreates the run, deletes both skip-activity id shapes and re-plans the point", async () => {
    createSlice().restoreSkippedRepeatTask(runId, taskId, dateKey)
    await flush()

    const mutation = mocks.applyRunMutation.mock.calls[0]![0]
    expect(mutation.putRuns).toEqual([
      {
        id: runId,
        taskId,
        arrangementStatus: "todo",
        source: "repeatPolicy",
        plannedForDate: dateKey,
        dateKey: toLocalDateKey(new Date()),
      },
    ])
    expect(mutation.deleteActivityIds).toEqual([
      createStableActivityId("repeat-skip", runId),
      createStableRepeatResolutionActivityId("repeat-skip", taskId, dateKey),
    ])
    expect(mutation.ledgerMarks).toEqual([
      { taskId, dateKey, status: "planned" },
    ])
    expect(mocks.replan).toHaveBeenCalledWith("partial")
  })
})

describe("upsertStepsCompleted", () => {
  it("writes the step progress onto the run", async () => {
    mocks.queryDayRun.mockResolvedValue(repeatRun)

    createSlice().upsertStepsCompleted(runId, ["s1", "s2"])
    await flush()

    expect(mocks.applyRunMutation).toHaveBeenCalledWith({
      putRuns: [{ ...repeatRun, stepsCompleted: ["s1", "s2"] }],
    })
  })

  it("is a no-op when the run does not exist", async () => {
    mocks.queryDayRun.mockResolvedValue(undefined)

    createSlice().upsertStepsCompleted(runId, ["s1"])
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.applyRunMutation).not.toHaveBeenCalled()
  })
})
