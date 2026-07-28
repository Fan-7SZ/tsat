import { beforeEach, describe, expect, it, vi } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"

const mocks = vi.hoisted(() => ({
  applyDailyTriggerResetsAtomic: vi.fn(),
  queryEntitySnapshot: vi.fn(),
  queryDayRuns: vi.fn(),
  queryAllTasks: vi.fn(),
  sweepDayBoundaryAtomic: vi.fn(),
  ensureTagCatalogReady: vi.fn(),
  queryLastFullReplanDateKey: vi.fn(),
  putLastFullReplanDateKey: vi.fn(),
  prepareTrackDb: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  applyDailyTriggerResetsAtomic: mocks.applyDailyTriggerResetsAtomic,
  queryEntitySnapshot: mocks.queryEntitySnapshot,
  queryDayRuns: mocks.queryDayRuns,
  queryAllTasks: mocks.queryAllTasks,
  sweepDayBoundaryAtomic: mocks.sweepDayBoundaryAtomic,
  ensureTagCatalogReady: mocks.ensureTagCatalogReady,
  queryLastFullReplanDateKey: mocks.queryLastFullReplanDateKey,
  putLastFullReplanDateKey: mocks.putLastFullReplanDateKey,
}))

vi.mock("@/persistence/db", () => ({
  prepareTrackDb: mocks.prepareTrackDb,
}))

const { runTriggerResetIfNeeded, refreshRuntimeNow, awaitBootReady, useAppStore } =
  await import("@/store/app-store")
const { toLocalDateKey } = await import("@/utils/date")

const goalId = "goal-1" as GoalID
const taskId = "task-1" as TaskID
const runtimeId = "task-1" as TaskRuntimeID

const goal: GoalEntity = {
  id: goalId,
  title: "Triggered goal",
  createdAt: new Date("2026-05-10T09:00:00"),
  trigger: { rule: { mode: "daily", interval: 1 } },
}

const task: TaskGroupEntity = {
  id: taskId,
  goalId,
  title: "Task",
  createdAt: new Date("2026-05-10T09:00:00"),
  total: 1,
  completedCount: 1,
}

describe("runTriggerResetIfNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryDayRuns.mockResolvedValue([
      {
        id: runtimeId,
        taskId,
        arrangementStatus: "todo",
        source: "manual",
        dateKey: "2026-05-13",
      },
    ])
    mocks.applyDailyTriggerResetsAtomic.mockResolvedValue(undefined)
    mocks.queryEntitySnapshot.mockResolvedValue({
      goals: { [goalId]: goal },
      tasks: { [taskId]: task },
      deps: {},
      goalTriggerStates: {},
      taskTriggerStates: {},
    })
  })

  it("writes dueAt to the end of the triggered local day", async () => {
    const didReset = await runTriggerResetIfNeeded(
      new Date("2026-05-13T10:30:00")
    )

    expect(didReset).toBe(true)
    // Goal resets and the stale-run cleanup travel in ONE atomic call.
    expect(mocks.applyDailyTriggerResetsAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        goalResets: [
          expect.objectContaining({
            goalId,
            lastTriggeredDateKey: "2026-05-13",
            dueAt: new Date("2026-05-13T23:59:59.999"),
          }),
        ],
        resetTaskIds: [taskId],
      })
    )
  })

  it("resets a task-level trigger and records its state", async () => {
    const triggerTaskId = "task-2" as TaskID
    const triggerTask: TaskGroupEntity = {
      id: triggerTaskId,
      goalId,
      title: "Triggered task",
      createdAt: new Date("2026-05-10T09:00:00"),
      trigger: { rule: { mode: "daily", interval: 1 } },
      total: 1,
      completedCount: 1,
    }
    mocks.queryEntitySnapshot.mockResolvedValue({
      goals: {},
      tasks: { [triggerTaskId]: triggerTask },
      deps: {},
      goalTriggerStates: {},
      taskTriggerStates: {},
    })

    const didReset = await runTriggerResetIfNeeded(
      new Date("2026-05-13T10:30:00")
    )

    expect(didReset).toBe(true)
    expect(mocks.applyDailyTriggerResetsAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        taskResets: [
          {
            taskId: triggerTaskId,
            lastTriggeredDateKey: "2026-05-13",
          },
        ],
        resetTaskIds: [triggerTaskId],
      })
    )
  })

  it("returns false when nothing is pending", async () => {
    mocks.queryEntitySnapshot.mockResolvedValue({
      goals: { [goalId]: { ...goal, trigger: undefined } },
      tasks: { [taskId]: task },
      deps: {},
      goalTriggerStates: {},
      taskTriggerStates: {},
    })

    const didReset = await runTriggerResetIfNeeded(
      new Date("2026-05-13T10:30:00")
    )

    expect(didReset).toBe(false)
    expect(mocks.applyDailyTriggerResetsAtomic).not.toHaveBeenCalled()
  })

  it("skips a goal that already triggered today", async () => {
    mocks.queryEntitySnapshot.mockResolvedValue({
      goals: { [goalId]: goal },
      tasks: { [taskId]: task },
      deps: {},
      goalTriggerStates: {
        [goalId]: { lastTriggeredDateKey: "2026-05-13" },
      },
      taskTriggerStates: {},
    })

    const didReset = await runTriggerResetIfNeeded(
      new Date("2026-05-13T10:30:00")
    )

    expect(didReset).toBe(false)
  })

  it("a one-shot rule with no next fire is due the fire day itself", async () => {
    mocks.queryEntitySnapshot.mockResolvedValue({
      goals: {
        [goalId]: {
          ...goal,
          trigger: {
            rule: { mode: "custom", date: [new Date("2026-05-13T00:00:00")] },
          },
        },
      },
      tasks: { [taskId]: task },
      deps: {},
      goalTriggerStates: {},
      taskTriggerStates: {},
    })

    await runTriggerResetIfNeeded(new Date("2026-05-13T10:30:00"))

    expect(mocks.applyDailyTriggerResetsAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        goalResets: [
          expect.objectContaining({
            dueAt: new Date("2026-05-13T23:59:59.999"),
            lastTriggeredDateKey: "2026-05-13",
          }),
        ],
      })
    )
  })

  it("leaves dueAt unset when the trigger opts out of setDueOnReset", async () => {
    mocks.queryEntitySnapshot.mockResolvedValue({
      goals: {
        [goalId]: {
          ...goal,
          trigger: { ...goal.trigger!, setDueOnReset: false },
        },
      },
      tasks: { [taskId]: task },
      deps: {},
      goalTriggerStates: {},
      taskTriggerStates: {},
    })

    await runTriggerResetIfNeeded(new Date("2026-05-13T10:30:00"))

    expect(mocks.applyDailyTriggerResetsAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        goalResets: [expect.objectContaining({ dueAt: undefined })],
      })
    )
  })

  it("returns false when the snapshot read fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})
    mocks.queryEntitySnapshot.mockRejectedValue(new Error("dexie down"))

    const didReset = await runTriggerResetIfNeeded(
      new Date("2026-05-13T10:30:00")
    )

    expect(didReset).toBe(false)
    consoleError.mockRestore()
  })
})

describe("refreshRuntimeNow", () => {
  const replan = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    replan.mockResolvedValue(undefined)
    useAppStore.setState({ replan })
    mocks.queryEntitySnapshot.mockResolvedValue({
      goals: {},
      tasks: {},
      deps: {},
      goalTriggerStates: {},
      taskTriggerStates: {},
    })
    mocks.queryDayRuns.mockResolvedValue([])
    mocks.queryAllTasks.mockResolvedValue([])
    mocks.sweepDayBoundaryAtomic.mockResolvedValue(undefined)
  })

  it("returns false while the runtime day marker is still valid", async () => {
    useAppStore.setState({
      runtimeValidUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    const swept = await refreshRuntimeNow()

    expect(swept).toBe(false)
    expect(mocks.sweepDayBoundaryAtomic).not.toHaveBeenCalled()
    expect(replan).not.toHaveBeenCalled()
  })

  it("sweeps, trigger-resets and full-replans once the marker expired", async () => {
    useAppStore.setState({
      runtimeValidUntil: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    })

    const swept = await refreshRuntimeNow()

    expect(swept).toBe(true)
    expect(mocks.sweepDayBoundaryAtomic).toHaveBeenCalledWith(
      expect.any(Set),
      expect.any(Set),
      toLocalDateKey(new Date())
    )
    // The sweep re-arms the day marker for tonight.
    expect(
      new Date(useAppStore.getState().runtimeValidUntil).getTime()
    ).toBeGreaterThan(Date.now())
    expect(replan).toHaveBeenCalledWith("full")
  })
})

describe("awaitBootReady", () => {
  const replan = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    replan.mockResolvedValue(undefined)
    useAppStore.setState({
      replan,
      runtimeValidUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    mocks.prepareTrackDb.mockResolvedValue(undefined)
    mocks.ensureTagCatalogReady.mockResolvedValue(undefined)
    mocks.queryEntitySnapshot.mockResolvedValue({
      goals: {},
      tasks: {},
      deps: {},
      goalTriggerStates: {},
      taskTriggerStates: {},
    })
    mocks.queryDayRuns.mockResolvedValue([])
    mocks.queryLastFullReplanDateKey.mockResolvedValue(
      toLocalDateKey(new Date())
    )
  })

  it("boots to ready with a partial replan and stays idempotent", async () => {
    await awaitBootReady()

    expect(useAppStore.getState().bootStatus).toBe("ready")
    expect(mocks.prepareTrackDb).toHaveBeenCalledTimes(1)
    expect(mocks.ensureTagCatalogReady).toHaveBeenCalledTimes(1)
    // Runtime not expired → partial scope regardless of the full-replan marker.
    expect(replan).toHaveBeenCalledWith("partial")

    // Second call must share the first bootstrap run.
    await awaitBootReady()
    expect(mocks.prepareTrackDb).toHaveBeenCalledTimes(1)
  })
})
