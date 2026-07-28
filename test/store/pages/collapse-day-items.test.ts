import { describe, expect, it } from "vitest"

import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import { zh } from "@/i18n/zh"
import {
  collapseDoneItems,
  ordinaliseOpenItems,
  type DayItemLike,
} from "@/store/pages/collapse-day-items"

const taskA = "task-a" as TaskID
const taskB = "task-b" as TaskID
const dateKey = LocalDateKeySchema.parse("2026-07-20")

function item(
  taskId: TaskID,
  runtimeId: string,
  patch: Partial<DayItemLike> = {}
): DayItemLike {
  return { taskId, runtimeId: runtimeId as TaskRuntimeID, ...patch }
}

describe("ordinaliseOpenItems", () => {
  it("leaves single-run tasks untouched", () => {
    const items = [item(taskA, "a1"), item(taskB, "b1")]
    expect(ordinaliseOpenItems(items, zh)).toEqual(items)
  })

  it("numbers multiple open runs of the same task in order", () => {
    const items = [item(taskA, "a1"), item(taskB, "b1"), item(taskA, "a2")]

    const result = ordinaliseOpenItems(items, zh)

    expect(result[0]!.runsLabel).toBe(zh.actions.runOrdinal(1))
    expect(result[1]!.runsLabel).toBeUndefined()
    expect(result[2]!.runsLabel).toBe(zh.actions.runOrdinal(2))
  })

  it("keeps repeat items' plannedForLabel instead of an ordinal", () => {
    const items = [
      item(taskA, "a1", { plannedForLabel: "Planned for Jul 19" }),
      item(taskA, "a2"),
    ]

    const result = ordinaliseOpenItems(items, zh)

    expect(result[0]!.runsLabel).toBeUndefined()
    expect(result[0]!.plannedForLabel).toBe("Planned for Jul 19")
    // The sibling without a date label still gets its ordinal.
    expect(result[1]!.runsLabel).toBe(zh.actions.runOrdinal(2))
  })
})

describe("collapseDoneItems", () => {
  const manualRun = (id: string): TaskRuntimeEntity => ({
    id: id as TaskRuntimeID,
    taskId: taskA,
    arrangementStatus: "done",
    source: "manual",
  })

  it("passes single items through unchanged", () => {
    const single = item(taskA, "a1", { plannedForLabel: "Planned for Jul 19" })
    const result = collapseDoneItems([single], {}, zh)
    expect(result).toEqual([single])
  })

  it("collapses interchangeable runs to one directly-actionable row", () => {
    const items = [
      item(taskA, "a1", { isDebtItem: true }),
      item(taskA, "a2"),
    ]
    const taskRuntime = {
      ["a1" as TaskRuntimeID]: manualRun("a1"),
      ["a2" as TaskRuntimeID]: manualRun("a2"),
    }

    const [row] = collapseDoneItems(items, taskRuntime, zh)

    expect(row).toMatchObject({
      // Acts on the most recent run.
      runtimeId: "a2",
      runsLabel: zh.actions.runsDoneToday(2),
      plannedForLabel: undefined,
      isDebtItem: false,
    })
    // Interchangeable → no runs dialog needed.
    expect(row!.collapsedRunIds).toBeUndefined()
  })

  it("keeps collapsedRunIds when runs are not interchangeable (repeat runs)", () => {
    const items = [item(taskA, "a::2026-07-19"), item(taskA, "a::2026-07-20")]
    const taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity> = {
      ["a::2026-07-19" as TaskRuntimeID]: {
        id: "a::2026-07-19" as TaskRuntimeID,
        taskId: taskA,
        arrangementStatus: "done",
        source: "repeatPolicy",
        plannedForDate: LocalDateKeySchema.parse("2026-07-19"),
      },
      ["a::2026-07-20" as TaskRuntimeID]: {
        id: "a::2026-07-20" as TaskRuntimeID,
        taskId: taskA,
        arrangementStatus: "done",
        source: "repeatPolicy",
        plannedForDate: dateKey,
      },
    }

    const [row] = collapseDoneItems(items, taskRuntime, zh)

    expect(row!.collapsedRunIds).toEqual(["a::2026-07-19", "a::2026-07-20"])
    expect(row!.runsLabel).toBe(zh.actions.runsDoneToday(2))
  })

  it("falls back to the runs dialog when a runtime record is missing", () => {
    const items = [item(taskA, "a1"), item(taskA, "a2")]
    // "a2" is absent from the runtime store — interchangeability is unprovable.
    const taskRuntime = { ["a1" as TaskRuntimeID]: manualRun("a1") }

    const [row] = collapseDoneItems(items, taskRuntime, zh)

    expect(row!.collapsedRunIds).toEqual(["a1", "a2"])
  })

  it("collapses per task, leaving other tasks' rows separate", () => {
    const items = [item(taskA, "a1"), item(taskA, "a2"), item(taskB, "b1")]
    const taskRuntime = {
      ["a1" as TaskRuntimeID]: manualRun("a1"),
      ["a2" as TaskRuntimeID]: manualRun("a2"),
    }

    const result = collapseDoneItems(items, taskRuntime, zh)

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.taskId)).toEqual([taskA, taskB])
  })
})
