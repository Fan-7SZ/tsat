import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { ActivityID, TaskID } from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import type { RunMutation } from "@/persistence/repository"

const mocks = vi.hoisted(() => ({
  patchActivityDate: vi.fn(),
  queryDayRun: vi.fn(),
  applyRunMutation: vi.fn(),
  replan: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  patchActivityDate: mocks.patchActivityDate,
  queryDayRun: mocks.queryDayRun,
  applyRunMutation: mocks.applyRunMutation,
}))

vi.mock("@/store/app-store", () => ({
  useAppStore: {
    getState: () => ({ replan: mocks.replan }),
  },
}))

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }))

const {
  addCompletionRecord,
  removeCompletionRecord,
  updateCompletionRecordDate,
  setRepeatPointStatus,
} = await import("@/commands/completion.commands")

const taskId = "task-1" as TaskID

function counterTask(): TaskGroupEntity {
  return {
    id: taskId,
    title: "Counter",
    createdAt: new Date("2026-06-01T09:00:00"),
    total: 5,
    completedCount: 1,
  }
}

function repeatTask(): TaskGroupEntity {
  return {
    ...counterTask(),
    repeat: { rule: { mode: "daily", interval: 1 } },
  }
}

function lastMutation(): RunMutation {
  return mocks.applyRunMutation.mock.calls.at(-1)![0] as RunMutation
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.applyRunMutation.mockResolvedValue(undefined)
  mocks.queryDayRun.mockResolvedValue(null)
  mocks.replan.mockResolvedValue(undefined)
})

describe("addCompletionRecord (counter)", () => {
  it("commits the activity and the recount as ONE mutation", async () => {
    const ok = await addCompletionRecord(
      counterTask(),
      LocalDateKeySchema.parse("2026-06-11")
    )

    expect(ok).toBe(true)
    expect(mocks.applyRunMutation).toHaveBeenCalledTimes(1)
    const mutation = lastMutation()
    const written = mutation.putActivities![0] as ActivityEntity
    expect(written.kind).toBe("task-done")
    expect(written.recordedDateKey).toBe("2026-06-11")
    expect(mutation.recomputeCompletedCountFor).toEqual([taskId])
    expect(mocks.replan).toHaveBeenCalled()
  })

  it("toasts the fallback message when the mutation throws", async () => {
    mocks.applyRunMutation.mockRejectedValueOnce(new Error("boom"))

    const ok = await addCompletionRecord(
      counterTask(),
      LocalDateKeySchema.parse("2026-06-11")
    )

    expect(ok).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Failed to add completion record."
    )
  })
})

describe("removeCompletionRecord (counter)", () => {
  it("deletes the record and recounts in the same mutation", async () => {
    const ok = await removeCompletionRecord(
      counterTask(),
      "act-2026-06-10" as ActivityID
    )

    expect(ok).toBe(true)
    expect(lastMutation()).toEqual({
      deleteActivityIds: ["act-2026-06-10"],
      retractDoneRunIds: undefined,
      recomputeCompletedCountFor: [taskId],
    })
  })

  it("retracts the encoded runtime for runtime-derived stable ids", async () => {
    const ok = await removeCompletionRecord(
      counterTask(),
      "act::task-done::task-1" as ActivityID
    )

    expect(ok).toBe(true)
    // The done→todo flip happens inside the transaction (retractDoneRunIds),
    // not as a separate read-then-write.
    expect(lastMutation()).toEqual({
      deleteActivityIds: ["act::task-done::task-1"],
      retractDoneRunIds: ["task-1"],
      recomputeCompletedCountFor: [taskId],
    })
  })

  it("passes no retraction for ids without the task-done prefix", async () => {
    const ok = await removeCompletionRecord(
      counterTask(),
      "act::repeat-skip::task-1" as ActivityID
    )

    expect(ok).toBe(true)
    expect(lastMutation().retractDoneRunIds).toBeUndefined()
  })

  it("toasts the fallback message when the mutation throws", async () => {
    mocks.applyRunMutation.mockRejectedValueOnce(new Error("boom"))

    const ok = await removeCompletionRecord(
      counterTask(),
      "act-x" as ActivityID
    )

    expect(ok).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Failed to remove completion record."
    )
  })
})

describe("updateCompletionRecordDate", () => {
  it("patches the activity date and replans", async () => {
    const ok = await updateCompletionRecordDate(
      "act-1" as ActivityID,
      LocalDateKeySchema.parse("2026-06-12")
    )

    expect(ok).toBe(true)
    expect(mocks.patchActivityDate).toHaveBeenCalledWith("act-1", "2026-06-12")
    expect(mocks.replan).toHaveBeenCalledTimes(1)
  })

  it("toasts the fallback message when the patch throws", async () => {
    mocks.patchActivityDate.mockRejectedValueOnce(new Error("boom"))

    const ok = await updateCompletionRecordDate(
      "act-1" as ActivityID,
      LocalDateKeySchema.parse("2026-06-12")
    )

    expect(ok).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Failed to update completion record."
    )
  })
})

describe("setRepeatPointStatus", () => {
  const dateKey = LocalDateKeySchema.parse("2026-06-09")
  const pointRuntimeId = `${taskId}::${dateKey}`

  it("marks completed with its resolution record and recount in one mutation", async () => {
    const ok = await setRepeatPointStatus(repeatTask(), dateKey, "completed")

    expect(ok).toBe(true)
    expect(mocks.applyRunMutation).toHaveBeenCalledTimes(1)
    const mutation = lastMutation()
    expect(mutation.ledgerMarks).toEqual([
      { taskId, dateKey, status: "completed" },
    ])
    expect(mutation.putActivities![0]).toMatchObject({
      id: `act::task-done::repeat-resolution::${taskId}::${dateKey}`,
      kind: "task-done",
      plannedForDate: dateKey,
    })
    expect(mutation.recomputeCompletedCountFor).toEqual([taskId])
  })

  it("clears both record shapes and retracts the run when a point returns to planned", async () => {
    const ok = await setRepeatPointStatus(repeatTask(), dateKey, "planned")

    expect(ok).toBe(true)
    const mutation = lastMutation()
    expect(mutation.ledgerMarks).toEqual([
      { taskId, dateKey, status: "planned" },
    ])
    // Both the repeat-resolution record and the runtime-derived record go, and
    // a still-done run is flipped back inside the same transaction.
    expect(mutation.deleteActivityIds).toEqual([
      `act::task-done::repeat-resolution::${taskId}::${dateKey}`,
      `act::task-done::${pointRuntimeId}`,
    ])
    expect(mutation.retractDoneRunIds).toEqual([pointRuntimeId])
    expect(mutation.recomputeCompletedCountFor).toEqual([taskId])
  })

  it("folds the skip write-set into the same mutation when skipping a live point", async () => {
    mocks.queryDayRun.mockResolvedValue({
      id: pointRuntimeId as never,
      taskId,
      arrangementStatus: "todo",
      source: "repeatPolicy",
      plannedForDate: dateKey,
      dateKey,
    })

    const ok = await setRepeatPointStatus(repeatTask(), dateKey, "skipped")

    expect(ok).toBe(true)
    expect(mocks.applyRunMutation).toHaveBeenCalledTimes(1)
    const mutation = lastMutation()
    expect(mutation.ledgerMarks).toEqual([
      { taskId, dateKey, status: "skipped" },
    ])
    expect(mutation.deleteRunIds).toEqual([pointRuntimeId])
    expect(mutation.putActivities![0]).toMatchObject({
      id: `act::repeat-skip::${pointRuntimeId}`,
      kind: "repeat-skip",
    })
    expect(mutation.recomputeCompletedCountFor).toEqual([taskId])
  })

  it("skips the run teardown when the point has no live run", async () => {
    mocks.queryDayRun.mockResolvedValue(null)

    const ok = await setRepeatPointStatus(repeatTask(), dateKey, "skipped")

    expect(ok).toBe(true)
    const mutation = lastMutation()
    expect(mutation.deleteRunIds).toBeUndefined()
    expect(mutation.putActivities).toBeUndefined()
  })

  it("toasts the fallback message when the mutation throws", async () => {
    mocks.applyRunMutation.mockRejectedValueOnce(new Error("boom"))

    const ok = await setRepeatPointStatus(repeatTask(), dateKey, "completed")

    expect(ok).toBe(false)
    expect(mocks.replan).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Failed to update repeat point."
    )
  })
})
