import { describe, expect, it } from "vitest"

import type {
  TaskRuntimeEntity,
  TaskRuntimeStatus,
} from "@/domain/entities/TaskRuntimeEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import { toLocalDateKey } from "@/utils/date"
import {
  aggregateRuntimeStatus,
  areRunsInterchangeable,
  canAddRunToday,
  counterRunId,
  createNextRunId,
  createTaskRuntimeId,
  findLatestDoneRun,
  getPrimaryTaskRuntime,
  getRuntimeDateKey,
  getRuntimePlannedForDate,
  getTaskRuntimeEntries,
  getTaskRuntimeIdsForTask,
  hasTaskRuntimeForTask,
  isForcedRuntime,
  isRepeatRuntime,
  parseRepeatRuntimeId,
  primaryTodayRunId,
  selectCompletionRuntime,
} from "@/utils/task-runtime"

const taskId = "task-1" as TaskID
const otherTaskId = "task-2" as TaskID
const dateKey = LocalDateKeySchema.parse("2026-05-13")

function createTask(patch: Partial<TaskGroupEntity> = {}): TaskGroupEntity {
  return {
    id: taskId,
    title: "Task",
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

function manualRun(
  id: string,
  status: TaskRuntimeStatus = "todo",
  patch: Partial<TaskRuntimeEntity> = {}
): TaskRuntimeEntity {
  return {
    id: id as TaskRuntimeID,
    taskId,
    arrangementStatus: status,
    source: "manual",
    ...patch,
  } as TaskRuntimeEntity
}

function repeatRun(
  plannedForDate: string,
  status: TaskRuntimeStatus = "todo"
): TaskRuntimeEntity {
  return {
    id: `${taskId}::${plannedForDate}` as TaskRuntimeID,
    taskId,
    arrangementStatus: status,
    source: "repeatPolicy",
    plannedForDate: LocalDateKeySchema.parse(plannedForDate),
  }
}

function toRecord(
  runs: TaskRuntimeEntity[]
): Record<TaskRuntimeID, TaskRuntimeEntity> {
  return Object.fromEntries(runs.map((run) => [run.id, run]))
}

describe("createTaskRuntimeId", () => {
  it("keys a repeat occurrence by task and date", () => {
    expect(createTaskRuntimeId(taskId, "repeatPolicy", dateKey)).toBe(
      "task-1::2026-05-13"
    )
  })

  it("falls back to the bare taskId for everything else", () => {
    expect(createTaskRuntimeId(taskId)).toBe("task-1")
    expect(createTaskRuntimeId(taskId, "manual", dateKey)).toBe("task-1")
    expect(createTaskRuntimeId(taskId, "repeatPolicy")).toBe("task-1")
  })
})

describe("counterRunId / primaryTodayRunId", () => {
  it("keys the N-th counter run by task, day and sequence", () => {
    expect(counterRunId(taskId, dateKey, 2)).toBe(
      "task-1::run::2026-05-13::2"
    )
  })

  it("gives a counter task its first run of the day", () => {
    expect(primaryTodayRunId(createTask({ total: 3 }), dateKey)).toBe(
      "task-1::run::2026-05-13::1"
    )
  })

  it("keeps the bare taskId for a single-run task", () => {
    expect(primaryTodayRunId(createTask({ total: 1 }), dateKey)).toBe("task-1")
  })
})

describe("createNextRunId", () => {
  it("starts at sequence 1 when the day is empty", () => {
    expect(createNextRunId({}, taskId, dateKey)).toBe(
      "task-1::run::2026-05-13::1"
    )
  })

  it("fills the lowest unused sequence, reusing freed slots", () => {
    const runs = toRecord([
      manualRun(counterRunId(taskId, dateKey, 1)),
      manualRun(counterRunId(taskId, dateKey, 3)),
    ])

    expect(createNextRunId(runs, taskId, dateKey)).toBe(
      "task-1::run::2026-05-13::2"
    )
  })
})

describe("parseRepeatRuntimeId", () => {
  it("parses a repeat runtime id", () => {
    expect(parseRepeatRuntimeId("task-1::2026-05-13" as TaskRuntimeID)).toEqual(
      { taskId, plannedForDate: dateKey }
    )
  })

  it("rejects a bare task id", () => {
    expect(parseRepeatRuntimeId("task-1" as TaskRuntimeID)).toBeNull()
  })

  it("rejects a counter run id (four parts)", () => {
    expect(
      parseRepeatRuntimeId("task-1::run::2026-05-13::1" as TaskRuntimeID)
    ).toBeNull()
  })

  it("rejects empty segments", () => {
    expect(parseRepeatRuntimeId("::2026-05-13" as TaskRuntimeID)).toBeNull()
    expect(parseRepeatRuntimeId("task-1::" as TaskRuntimeID)).toBeNull()
  })

  it("rejects a second segment that is not a date key", () => {
    expect(
      parseRepeatRuntimeId("task-1::not-a-date" as TaskRuntimeID)
    ).toBeNull()
  })
})

describe("runtime predicates", () => {
  it("isRepeatRuntime only matches repeatPolicy runtimes", () => {
    expect(isRepeatRuntime(repeatRun("2026-05-13"))).toBe(true)
    expect(isRepeatRuntime(manualRun("task-1"))).toBe(false)
  })

  it("isForcedRuntime matches due/goal-due/repeat sources only", () => {
    expect(isForcedRuntime(manualRun("a", "todo", { source: "duePolicy" }))).toBe(true)
    expect(
      isForcedRuntime(manualRun("b", "todo", { source: "goalDuePolicy" }))
    ).toBe(true)
    expect(isForcedRuntime(repeatRun("2026-05-13"))).toBe(true)
    expect(isForcedRuntime(manualRun("c"))).toBe(false)
    expect(isForcedRuntime(manualRun("d", "todo", { source: "default" }))).toBe(
      false
    )
    expect(
      isForcedRuntime(manualRun("e", "todo", { source: "triggerPolicy" }))
    ).toBe(false)
  })

  it("getRuntimePlannedForDate / getRuntimeDateKey read the repeat date only", () => {
    const repeat = repeatRun("2026-05-13")
    expect(getRuntimePlannedForDate(repeat)).toBe(dateKey)
    expect(getRuntimeDateKey(repeat)).toBe(dateKey)
    expect(getRuntimePlannedForDate(manualRun("task-1"))).toBeUndefined()
    expect(getRuntimeDateKey(manualRun("task-1"))).toBeUndefined()
  })
})

describe("getTaskRuntimeEntries and friends", () => {
  const later = repeatRun("2026-05-14")
  const earlier = repeatRun("2026-05-13")
  const dateless = manualRun("task-1")
  const foreign = { ...manualRun("task-2"), taskId: otherTaskId }
  const runs = toRecord([later, foreign, earlier, dateless])

  it("filters by task and sorts dateless first, then dates ascending", () => {
    expect(getTaskRuntimeEntries(runs, taskId).map((r) => r.id)).toEqual([
      "task-1",
      "task-1::2026-05-13",
      "task-1::2026-05-14",
    ])
  })

  it("hasTaskRuntimeForTask reflects presence", () => {
    expect(hasTaskRuntimeForTask(runs, taskId)).toBe(true)
    expect(hasTaskRuntimeForTask(runs, "task-9" as TaskID)).toBe(false)
  })

  it("getPrimaryTaskRuntime picks the first sorted entry", () => {
    expect(getPrimaryTaskRuntime(runs, taskId)?.id).toBe("task-1")
    expect(getPrimaryTaskRuntime(runs, "task-9" as TaskID)).toBeUndefined()
  })

  it("getTaskRuntimeIdsForTask maps to ids", () => {
    expect(getTaskRuntimeIdsForTask(runs, taskId)).toEqual([
      "task-1",
      "task-1::2026-05-13",
      "task-1::2026-05-14",
    ])
  })
})

describe("selectCompletionRuntime", () => {
  const repeatTask = createTask({
    repeat: { rule: { mode: "daily", interval: 1 } },
  })
  const todayKey = toLocalDateKey(new Date())

  it("picks today's planned point for a repeat task", () => {
    const today = repeatRun(todayKey)
    const runs = toRecord([repeatRun("2026-05-13"), today, manualRun("m1")])

    expect(selectCompletionRuntime(runs, repeatTask)?.id).toBe(today.id)
  })

  it("falls back to a manual-pull runtime for a repeat task", () => {
    const manual = manualRun("m1")
    const runs = toRecord([repeatRun("2026-05-13"), manual])

    expect(selectCompletionRuntime(runs, repeatTask)?.id).toBe(manual.id)
  })

  it("returns undefined for a repeat task with neither", () => {
    const runs = toRecord([
      repeatRun("2026-05-13"),
      manualRun("d1", "todo", { source: "default" }),
    ])

    expect(selectCompletionRuntime(runs, repeatTask)).toBeUndefined()
  })

  it("returns the single runtime for a non-repeat task", () => {
    const run = manualRun("task-1", "inProgress")
    expect(selectCompletionRuntime(toRecord([run]), createTask())?.id).toBe(
      run.id
    )
    expect(selectCompletionRuntime({}, createTask())).toBeUndefined()
  })
})

describe("aggregateRuntimeStatus", () => {
  it("is undefined without runs", () => {
    expect(aggregateRuntimeStatus({}, taskId)).toBeUndefined()
  })

  it("anything in progress wins", () => {
    const runs = toRecord([manualRun("a", "done"), manualRun("b", "inProgress")])
    expect(aggregateRuntimeStatus(runs, taskId)).toBe("inProgress")
  })

  it("reads done only when every run is done", () => {
    expect(
      aggregateRuntimeStatus(
        toRecord([manualRun("a", "done"), manualRun("b", "done")]),
        taskId
      )
    ).toBe("done")
    expect(
      aggregateRuntimeStatus(
        toRecord([manualRun("a", "done"), manualRun("b", "todo")]),
        taskId
      )
    ).toBe("todo")
  })
})

describe("canAddRunToday", () => {
  it("never allows extra items for a repeat task", () => {
    const task = createTask({
      repeat: { rule: { mode: "daily", interval: 1 } },
      total: 5,
    })
    expect(canAddRunToday(task, {})).toBe(false)
  })

  it("counts open runs as claims on the remaining budget", () => {
    const task = createTask({ total: 3, completedCount: 1 })

    // 1 completed + 1 open < 3 → room for one more.
    expect(canAddRunToday(task, toRecord([manualRun("a", "todo")]))).toBe(true)
    // 1 completed + 2 open = 3 → no room.
    expect(
      canAddRunToday(
        task,
        toRecord([manualRun("a", "todo"), manualRun("b", "inProgress")])
      )
    ).toBe(false)
  })

  it("ignores done runs (already counted by completedCount)", () => {
    const task = createTask({ total: 2, completedCount: 1 })
    expect(canAddRunToday(task, toRecord([manualRun("a", "done")]))).toBe(true)
  })
})

describe("findLatestDoneRun", () => {
  it("returns the last done run in sorted order", () => {
    const runs = toRecord([
      repeatRun("2026-05-14", "done"),
      repeatRun("2026-05-13", "done"),
      repeatRun("2026-05-15", "todo"),
    ])

    expect(findLatestDoneRun(runs, taskId)?.id).toBe("task-1::2026-05-14")
  })

  it("returns undefined when nothing is done", () => {
    expect(findLatestDoneRun(toRecord([manualRun("a")]), taskId)).toBeUndefined()
  })
})

describe("areRunsInterchangeable", () => {
  it("repeat runs are never interchangeable", () => {
    expect(areRunsInterchangeable([repeatRun("2026-05-13")])).toBe(false)
  })

  it("mixed sources are not interchangeable", () => {
    expect(
      areRunsInterchangeable([
        manualRun("a"),
        manualRun("b", "todo", { source: "default" }),
      ])
    ).toBe(false)
  })

  it("same-source non-repeat runs are interchangeable", () => {
    expect(areRunsInterchangeable([manualRun("a"), manualRun("b")])).toBe(true)
    expect(areRunsInterchangeable([])).toBe(true)
  })
})
