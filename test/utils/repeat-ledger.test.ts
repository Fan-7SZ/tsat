import { describe, expect, it } from "vitest"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import {
  getActiveTodayPoints,
  getFuturePoints,
  mergeLedgerWithRule,
} from "@/utils/repeat-ledger"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"

const taskId = "task-1" as TaskID
const goalId = "goal-1" as GoalID

function createTask(): TaskGroupEntity {
  return {
    id: taskId,
    goalId,
    title: "Daily check-in",
    createdAt: new Date("2026-05-09T09:00:00"),
    // The repeat now carries its own window end (no goal fallback).
    repeat: {
      rule: { mode: "daily", interval: 1 },
      startsAt: new Date("2026-05-09T00:00:00"),
      endsAt: new Date("2026-05-12T00:00:00"),
    },
    total: 1,
    completedCount: 0,
  }
}

describe("mergeLedgerWithRule", () => {
  it("creates a new ledger with all rule-generated dates marked planned", () => {
    const ledger = mergeLedgerWithRule({ task: createTask() })
    expect(ledger?.taskId).toBe(taskId)
    expect(ledger?.points).toEqual({
      "2026-05-09": "planned",
      "2026-05-10": "planned",
      "2026-05-11": "planned",
      "2026-05-12": "planned",
    })
  })

  it("preserves statuses of existing keys when re-merging", () => {
    const existing: RepeatLedgerEntity = {
      taskId,
      points: {
        [LocalDateKeySchema.parse("2026-05-09")]: "completed",
        [LocalDateKeySchema.parse("2026-05-10")]: "skipped",
      },
    }

    const ledger = mergeLedgerWithRule({ task: createTask(), existing })
    expect(ledger?.points).toEqual({
      "2026-05-09": "completed",
      "2026-05-10": "skipped",
      "2026-05-11": "planned",
      "2026-05-12": "planned",
    })
  })

  it("returns null when task has no repeat config", () => {
    const task = { ...createTask(), repeat: undefined }
    expect(mergeLedgerWithRule({ task })).toBeNull()
  })
})

describe("getActiveTodayPoints", () => {
  it("returns planned points up to and including today (debt + today)", () => {
    const ledger: RepeatLedgerEntity = {
      taskId,
      points: {
        [LocalDateKeySchema.parse("2026-05-09")]: "planned",
        [LocalDateKeySchema.parse("2026-05-10")]: "skipped",
        [LocalDateKeySchema.parse("2026-05-11")]: "planned",
        [LocalDateKeySchema.parse("2026-05-12")]: "planned",
      },
    }

    const todayKey = LocalDateKeySchema.parse("2026-05-11")
    expect(getActiveTodayPoints(ledger, todayKey)).toEqual([
      "2026-05-09",
      "2026-05-11",
    ])
  })

  it("excludes completed and skipped points", () => {
    const ledger: RepeatLedgerEntity = {
      taskId,
      points: {
        [LocalDateKeySchema.parse("2026-05-09")]: "completed",
        [LocalDateKeySchema.parse("2026-05-10")]: "skipped",
        [LocalDateKeySchema.parse("2026-05-11")]: "planned",
      },
    }

    const todayKey = LocalDateKeySchema.parse("2026-05-11")
    expect(getActiveTodayPoints(ledger, todayKey)).toEqual(["2026-05-11"])
  })
})

describe("getFuturePoints", () => {
  it("returns only future planned points within the window", () => {
    const ledger: RepeatLedgerEntity = {
      taskId,
      points: {
        [LocalDateKeySchema.parse("2026-05-09")]: "planned",
        [LocalDateKeySchema.parse("2026-05-11")]: "planned",
        [LocalDateKeySchema.parse("2026-05-13")]: "planned",
        [LocalDateKeySchema.parse("2026-05-15")]: "completed",
      },
    }

    const todayKey = LocalDateKeySchema.parse("2026-05-11")
    expect(getFuturePoints(ledger, todayKey, 7)).toEqual(["2026-05-13"])
  })
})
