import { beforeEach, describe, expect, it, vi } from "vitest"

import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import { toLocalDateKey } from "@/utils/date"
import { DEFAULT_POLICY } from "@/services/planner/policy-storage"

const mocks = vi.hoisted(() => ({
  applyReplanAtomic: vi.fn(),
  putLastFullReplanDateKey: vi.fn(),
  plannerReplan: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  applyReplanAtomic: mocks.applyReplanAtomic,
  putLastFullReplanDateKey: mocks.putLastFullReplanDateKey,
}))

vi.mock("@/services/planner/create-planner", () => ({
  createPlannerService: () => ({ replan: mocks.plannerReplan }),
}))

const { createPlannerSlice } = await import("@/store/slices/planner.slice")
type PlannerSlice = import("@/store/slices/planner.slice").PlannerSlice

const POLICY_KEY = "track-planner-policy"

function stubLocalStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  })
  return map
}

function createSlice() {
  let state: PlannerSlice
  const set = (partial: Partial<PlannerSlice>) => {
    state = { ...state, ...partial }
  }
  state = createPlannerSlice(
    set as never,
    (() => state) as never,
    {} as never
  )
  return { slice: () => state }
}

const taskId = "task-1" as TaskID
const yesterdayKey = LocalDateKeySchema.parse("2020-02-02")

function dayRun(id: string, patch: Partial<DayRunEntity> = {}): DayRunEntity {
  return {
    id: id as TaskRuntimeID,
    taskId,
    arrangementStatus: "todo",
    source: "default",
    dateKey: yesterdayKey,
    ...patch,
  } as DayRunEntity
}

type ReplanDiff = {
  putRuns: DayRunEntity[]
  deleteRunIds: TaskRuntimeID[]
  result: unknown
}

/** Wires applyReplanAtomic to feed the callback and capture its diff. */
function captureReplanDiff(runRows: DayRunEntity[]) {
  const captured: { diff?: ReplanDiff } = {}
  mocks.applyReplanAtomic.mockImplementation(
    async (fn: (snapshot: unknown, rows: DayRunEntity[]) => ReplanDiff) => {
      captured.diff = fn({}, runRows)
      return captured.diff.result
    }
  )
  return captured
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  stubLocalStorage()
  mocks.putLastFullReplanDateKey.mockResolvedValue(undefined)
  mocks.plannerReplan.mockReturnValue({ taskRuntime: {} })
})

describe("createPlannerSlice", () => {
  it("boots with the default policy when storage is empty", () => {
    expect(createSlice().slice().policy).toEqual(DEFAULT_POLICY)
  })

  it("updatePolicy merges the patch, persists it, and triggers a partial replan", async () => {
    const map = stubLocalStorage()
    captureReplanDiff([])
    const { slice } = createSlice()

    slice().updatePolicy({ maxFocusGoals: 5 })

    expect(slice().policy).toEqual({ ...DEFAULT_POLICY, maxFocusGoals: 5 })
    expect(JSON.parse(map.get(POLICY_KEY)!)).toEqual(slice().policy)

    await vi.waitFor(() =>
      expect(mocks.applyReplanAtomic).toHaveBeenCalledTimes(1)
    )
    // updatePolicy replans with "partial" scope → no full-replan stamp.
    expect(mocks.plannerReplan).toHaveBeenCalledWith(
      expect.objectContaining({ policy: slice().policy }),
      "partial"
    )
    expect(mocks.putLastFullReplanDateKey).not.toHaveBeenCalled()
  })

  it("replan diff-applies planner output: unchanged kept, changed re-put, missing deleted, new stamped today", async () => {
    const unchanged = dayRun("keep")
    const changed = dayRun("flip")
    const dropped = dayRun("drop")
    const captured = captureReplanDiff([unchanged, changed, dropped])

    const fresh = {
      id: "fresh" as TaskRuntimeID,
      taskId,
      arrangementStatus: "todo",
      source: "default",
    }
    mocks.plannerReplan.mockReturnValue({
      taskRuntime: {
        keep: { ...unchanged },
        flip: { ...changed, arrangementStatus: "inProgress" },
        fresh,
      },
    })

    await createSlice().slice().replan("partial")

    const diff = captured.diff!
    // The unchanged row must NOT churn (no sync noise).
    expect(diff.putRuns.map((r) => r.id)).toEqual(["flip", "fresh"])
    // Preserved rows keep their original dateKey (cross-day carryover)…
    expect(diff.putRuns[0]).toMatchObject({
      arrangementStatus: "inProgress",
      dateKey: yesterdayKey,
    })
    // …while brand-new rows are materialized for today.
    expect(diff.putRuns[1]).toMatchObject({
      id: "fresh",
      dateKey: toLocalDateKey(new Date()),
    })
    expect(diff.deleteRunIds).toEqual(["drop"])
  })

  it("treats a stepsCompleted change as a real change", async () => {
    const row = dayRun("steps", { stepsCompleted: ["s1"] })
    const captured = captureReplanDiff([row])
    mocks.plannerReplan.mockReturnValue({
      taskRuntime: { steps: { ...row, stepsCompleted: ["s1", "s2"] } },
    })

    await createSlice().slice().replan("partial")

    expect(captured.diff!.putRuns.map((r) => r.id)).toEqual(["steps"])
  })

  it("defaults to full scope and stamps the full-replan day marker", async () => {
    captureReplanDiff([])

    await createSlice().slice().replan()

    expect(mocks.plannerReplan).toHaveBeenCalledWith(expect.anything(), "full")
    expect(mocks.putLastFullReplanDateKey).toHaveBeenCalledWith(
      toLocalDateKey(new Date())
    )
  })
})
