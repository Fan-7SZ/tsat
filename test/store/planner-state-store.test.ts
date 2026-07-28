import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { TaskRuntimeID } from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import { toLocalDateKey } from "@/utils/date"
import { usePlannerState } from "@/store/planner-state-store"

const runA = "task-a" as TaskRuntimeID
const runB = "task-b" as TaskRuntimeID

describe("usePlannerState", () => {
  beforeEach(() => {
    usePlannerState.setState({
      blocks: {},
      dateKey: toLocalDateKey(new Date()),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("addBlock appends a block with a generated id", () => {
    usePlannerState.getState().addBlock(runA, 60, 120)
    usePlannerState.getState().addBlock(runA, 180, 240)

    const blocks = usePlannerState.getState().blocks[runA]!
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ from: 60, to: 120 })
    expect(blocks[1]).toMatchObject({ from: 180, to: 240 })
    expect(blocks[0]!.id).not.toBe(blocks[1]!.id)
  })

  it("updateBlock rewrites only the matching block", () => {
    usePlannerState.getState().addBlock(runA, 60, 120)
    usePlannerState.getState().addBlock(runA, 180, 240)
    const [first, second] = usePlannerState.getState().blocks[runA]!

    usePlannerState.getState().updateBlock(runA, first!.id, 0, 30)

    const blocks = usePlannerState.getState().blocks[runA]!
    expect(blocks[0]).toEqual({ id: first!.id, from: 0, to: 30 })
    expect(blocks[1]).toEqual(second)
  })

  it("updateBlock on an unknown runtime is a no-op", () => {
    const before = usePlannerState.getState().blocks
    usePlannerState.getState().updateBlock(runB, "nope", 0, 30)
    expect(usePlannerState.getState().blocks).toBe(before)
  })

  it("removeBlock drops a block and deletes the empty runtime entry", () => {
    usePlannerState.getState().addBlock(runA, 60, 120)
    usePlannerState.getState().addBlock(runA, 180, 240)
    const [first] = usePlannerState.getState().blocks[runA]!

    usePlannerState.getState().removeBlock(runA, first!.id)
    expect(usePlannerState.getState().blocks[runA]).toHaveLength(1)

    const [last] = usePlannerState.getState().blocks[runA]!
    usePlannerState.getState().removeBlock(runA, last!.id)
    expect(usePlannerState.getState().blocks[runA]).toBeUndefined()
  })

  it("removeBlock on an unknown runtime is a no-op", () => {
    const before = usePlannerState.getState().blocks
    usePlannerState.getState().removeBlock(runB, "nope")
    expect(usePlannerState.getState().blocks).toBe(before)
  })

  it("clearAll wipes blocks and re-stamps today", () => {
    usePlannerState.getState().addBlock(runA, 60, 120)
    usePlannerState.getState().clearAll()

    const state = usePlannerState.getState()
    expect(state.blocks).toEqual({})
    expect(state.dateKey).toBe(toLocalDateKey(new Date()))
  })

  it("ensureToday keeps blocks while the stored day is still today", () => {
    usePlannerState.getState().addBlock(runA, 60, 120)
    usePlannerState.getState().ensureToday()
    expect(usePlannerState.getState().blocks[runA]).toHaveLength(1)
  })

  it("ensureToday drops everything once the stored day rolled over", () => {
    usePlannerState.getState().addBlock(runA, 60, 120)
    usePlannerState.setState({
      dateKey: LocalDateKeySchema.parse("2020-01-01"),
    })

    usePlannerState.getState().ensureToday()

    const state = usePlannerState.getState()
    expect(state.blocks).toEqual({})
    expect(state.dateKey).toBe(toLocalDateKey(new Date()))
  })
})
