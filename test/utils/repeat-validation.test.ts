import { describe, expect, it } from "vitest"

import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import { en } from "@/i18n/en"
import {
  getTaskScheduleWindow,
  translateScheduleValidationError,
  validateRepeatConfiguration,
  validateTreeRepeatIntegrity,
  validateTriggerWindowConfiguration,
} from "@/utils/repeat-validation"

const goalId = "goal-1" as GoalID
const taskAId = "task-a" as TaskID
const taskBId = "task-b" as TaskID

// Goals no longer carry a start date; a due date is a soft signal only and no
// longer constrains repeat/trigger windows.
const goal: GoalEntity = {
  id: goalId,
  title: "Goal",
  createdAt: new Date("2026-05-01T09:00:00"),
  dueAt: new Date("2026-05-31T00:00:00"),
}

const fallbackStart = goal.createdAt

// A → B (A is B's predecessor)
const dependency: DependencyEntity = {
  id: "dep-1",
  belongTo: goalId,
  tree: [
    { data: taskAId, title: "Task A", parent: null, children: [1] },
    { data: taskBId, title: "Task B", parent: [0], children: null },
  ],
}

function createTask(
  id: TaskID,
  patch: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id,
    goalId,
    title: id === taskAId ? "Task A" : "Task B",
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

describe("validateTriggerWindowConfiguration", () => {
  it("accepts a windowless trigger without chain checks", () => {
    const taskA = createTask(taskAId, {
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-01T00:00:00"),
        endsAt: new Date("2026-05-31T00:00:00"),
      },
    })

    const result = validateTriggerWindowConfiguration({
      window: {},
      goal,
      fallbackStart,
      dependency,
      currentNodeData: taskBId,
      tasksById: { [taskAId]: taskA },
    })

    expect(result.error).toBeNull()
  })

  it("rejects a partial window", () => {
    const result = validateTriggerWindowConfiguration({
      window: { startsAt: new Date("2026-05-10T00:00:00") },
      goal,
      fallbackStart,
    })

    expect(result.error?.kind).toBe("partial-range")
  })

  it("accepts a window that extends past the goal's due date", () => {
    // The goal-window constraint was removed: a goal's due date no longer
    // bounds a repeat/trigger window.
    const result = validateTriggerWindowConfiguration({
      window: {
        startsAt: new Date("2026-05-20T00:00:00"),
        endsAt: new Date("2026-06-10T00:00:00"),
      },
      goal,
      fallbackStart,
    })

    expect(result.error).toBeNull()
  })

  it("surfaces an overlapping ancestor as a colour hint without erroring", () => {
    const taskA = createTask(taskAId, {
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-01T00:00:00"),
        endsAt: new Date("2026-05-10T00:00:00"),
      },
    })

    const result = validateTriggerWindowConfiguration({
      window: {
        startsAt: new Date("2026-05-08T00:00:00"),
        endsAt: new Date("2026-05-20T00:00:00"),
      },
      goal,
      fallbackStart,
      dependency,
      currentNodeData: taskBId,
      tasksById: { [taskAId]: taskA },
    })

    // Chain order is enforced structurally by the planner, not here.
    expect(result.error).toBeNull()
    expect(result.ancestorRanges.map((r) => r.taskId)).toContain(taskAId)
  })

  it("surfaces an overlapping descendant as a colour hint without erroring", () => {
    const taskB = createTask(taskBId, {
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-15T00:00:00"),
        endsAt: new Date("2026-05-25T00:00:00"),
      },
    })

    const result = validateTriggerWindowConfiguration({
      window: {
        startsAt: new Date("2026-05-01T00:00:00"),
        endsAt: new Date("2026-05-18T00:00:00"),
      },
      goal,
      fallbackStart,
      dependency,
      currentNodeData: taskAId,
      tasksById: { [taskBId]: taskB },
    })

    expect(result.error).toBeNull()
    expect(result.descendantRanges.map((r) => r.taskId)).toContain(taskBId)
  })
})

describe("validateRepeatConfiguration total cap", () => {
  // 2026-05-01 .. 2026-05-03 daily = 3 planned occurrences.
  const window = {
    rule: { mode: "daily", interval: 1 } as const,
    startsAt: new Date("2026-05-01T00:00:00"),
    endsAt: new Date("2026-05-03T00:00:00"),
  }

  it("rejects a total exceeding the planned occurrences", () => {
    const result = validateRepeatConfiguration({
      repeat: window,
      goal,
      fallbackStart,
      total: 5,
    })

    expect(result.error?.kind).toBe("total-exceeds-occurrences")
    expect(result.error?.maximumAllowedTotal).toBe(3)
  })

  it("accepts a total equal to the planned occurrences", () => {
    const result = validateRepeatConfiguration({
      repeat: window,
      goal,
      fallbackStart,
      total: 3,
    })

    expect(result.error).toBeNull()
  })

  it("rejects a bounded window with zero occurrences, even without a total", () => {
    const result = validateRepeatConfiguration({
      repeat: {
        rule: { mode: "weekly", interval: 1, daysOfWeek: [] },
        startsAt: new Date("2026-05-01T00:00:00"),
        endsAt: new Date("2026-05-14T00:00:00"),
      },
      goal,
      fallbackStart,
    })

    expect(result.error?.kind).toBe("no-occurrences")
  })

  it("ignores total for a non-repeat task", () => {
    const result = validateRepeatConfiguration({
      repeat: undefined,
      goal,
      fallbackStart,
      total: 999,
    })

    expect(result.error).toBeNull()
  })
})

describe("validateRepeatConfiguration against trigger windows", () => {
  it("surfaces an overlapping ancestor trigger window without erroring", () => {
    const taskA = createTask(taskAId, {
      trigger: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-01T00:00:00"),
        endsAt: new Date("2026-05-10T00:00:00"),
      },
    })

    const result = validateRepeatConfiguration({
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-08T00:00:00"),
        endsAt: new Date("2026-05-20T00:00:00"),
      },
      goal,
      fallbackStart,
      dependency,
      currentNodeData: taskBId,
      tasksById: { [taskAId]: taskA },
    })

    expect(result.error).toBeNull()
    expect(result.ancestorRanges.map((r) => r.taskId)).toContain(taskAId)
  })

  it("ignores windowless trigger tasks in the chain", () => {
    const taskA = createTask(taskAId, {
      trigger: {
        rule: { mode: "daily", interval: 1 },
      },
    })

    const result = validateRepeatConfiguration({
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-08T00:00:00"),
        endsAt: new Date("2026-05-20T00:00:00"),
      },
      goal,
      fallbackStart,
      dependency,
      currentNodeData: taskBId,
      tasksById: { [taskAId]: taskA },
    })

    expect(result.error).toBeNull()
    expect(result.ancestorRanges).toHaveLength(0)
  })
})

describe("chain hint ordering", () => {
  const taskCId = "task-c" as TaskID

  // A → B → C; validate at C so both A and B are ancestors.
  const chainDependency: DependencyEntity = {
    id: "dep-chain",
    belongTo: goalId,
    tree: [
      { data: taskAId, title: "Task A", parent: null, children: [1] },
      { data: taskBId, title: "Task B", parent: [0], children: [2] },
      { data: taskCId, title: "Task C", parent: [1], children: null },
    ],
  }

  it("sorts multiple ancestor ranges by their start date", () => {
    // B starts earlier than A so the sort has to reorder them.
    const taskA = createTask(taskAId, {
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-10T00:00:00"),
        endsAt: new Date("2026-05-15T00:00:00"),
      },
    })
    const taskB = createTask(taskBId, {
      trigger: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-02T00:00:00"),
        endsAt: new Date("2026-05-08T00:00:00"),
      },
    })

    const result = validateRepeatConfiguration({
      repeat: undefined,
      goal,
      fallbackStart,
      dependency: chainDependency,
      currentNodeData: taskCId,
      tasksById: { [taskAId]: taskA, [taskBId]: taskB },
    })

    expect(result.ancestorRanges.map((r) => r.taskId)).toEqual([
      taskBId,
      taskAId,
    ])
  })
})

describe("validateRepeatConfiguration ranges", () => {
  it("accepts a task without repeat", () => {
    const result = validateRepeatConfiguration({
      repeat: undefined,
      goal,
      fallbackStart,
    })

    expect(result.error).toBeNull()
    expect(result.effectiveRange).toBeNull()
  })

  it("rejects a partial repeat range", () => {
    const result = validateRepeatConfiguration({
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-10T00:00:00"),
      },
      goal,
      fallbackStart,
    })

    expect(result.error?.kind).toBe("partial-range")
    expect(result.error?.periodKind).toBe("repeat")
  })

  it("treats a dateless repeat as unresolvable but valid", () => {
    const result = validateRepeatConfiguration({
      repeat: { rule: { mode: "daily", interval: 1 } },
      goal,
      fallbackStart,
    })

    expect(result.error).toBeNull()
    expect(result.effectiveRange).toBeNull()
  })

  it("rejects a repeat range ending before it starts", () => {
    const result = validateRepeatConfiguration({
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-20T00:00:00"),
        endsAt: new Date("2026-05-10T00:00:00"),
      },
      goal,
      fallbackStart,
    })

    expect(result.error?.kind).toBe("invalid-range")
    expect(result.error?.periodKind).toBe("repeat")
    expect(result.effectiveRange).not.toBeNull()
  })

  it("returns the resolved day range for a valid config", () => {
    const result = validateRepeatConfiguration({
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-10T13:00:00"),
        endsAt: new Date("2026-05-20T02:00:00"),
      },
      goal,
      fallbackStart,
    })

    expect(result.error).toBeNull()
    expect(result.effectiveRange?.start).toEqual(new Date("2026-05-10T00:00:00"))
    expect(result.effectiveRange?.end).toEqual(new Date("2026-05-20T00:00:00"))
  })
})

describe("validateTriggerWindowConfiguration invalid range", () => {
  it("rejects a trigger window ending before it starts", () => {
    const result = validateTriggerWindowConfiguration({
      window: {
        startsAt: new Date("2026-05-20T00:00:00"),
        endsAt: new Date("2026-05-10T00:00:00"),
      },
      goal,
      fallbackStart,
    })

    expect(result.error?.kind).toBe("invalid-range")
    expect(result.error?.periodKind).toBe("trigger")
  })
})

describe("getTaskScheduleWindow", () => {
  it("resolves a repeat task's window, anchoring on createdAt without a start", () => {
    const task = createTask(taskAId, {
      repeat: {
        rule: { mode: "daily", interval: 1 },
        endsAt: new Date("2026-05-20T00:00:00"),
      },
    })

    const window = getTaskScheduleWindow(task)
    expect(window?.start).toEqual(new Date("2026-05-01T00:00:00"))
    expect(window?.end).toEqual(new Date("2026-05-20T00:00:00"))
  })

  it("returns null for a repeat without an end", () => {
    const task = createTask(taskAId, {
      repeat: { rule: { mode: "daily", interval: 1 } },
    })

    expect(getTaskScheduleWindow(task)).toBeNull()
  })

  it("uses the explicit window of a trigger task", () => {
    const task = createTask(taskAId, {
      trigger: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-10T00:00:00"),
        endsAt: new Date("2026-05-20T00:00:00"),
      },
    })

    const window = getTaskScheduleWindow(task)
    expect(window?.start).toEqual(new Date("2026-05-10T00:00:00"))
    expect(window?.end).toEqual(new Date("2026-05-20T00:00:00"))
  })

  it("returns null for a windowless trigger and for a plain task", () => {
    expect(
      getTaskScheduleWindow(
        createTask(taskAId, { trigger: { rule: { mode: "daily", interval: 1 } } })
      )
    ).toBeNull()
    expect(getTaskScheduleWindow(createTask(taskAId))).toBeNull()
  })
})

describe("validateTreeRepeatIntegrity", () => {
  it("accepts a tree whose scheduled tasks are self-consistent", () => {
    const taskA = createTask(taskAId, {
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-01T00:00:00"),
        endsAt: new Date("2026-05-10T00:00:00"),
      },
    })
    const taskB = createTask(taskBId, {
      trigger: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-11T00:00:00"),
        endsAt: new Date("2026-05-20T00:00:00"),
      },
    })

    expect(
      validateTreeRepeatIntegrity(
        dependency,
        { [taskAId]: taskA, [taskBId]: taskB },
        goal
      )
    ).toEqual({ valid: true })
  })

  it("skips nodes whose task is missing (e.g. the goal root)", () => {
    expect(validateTreeRepeatIntegrity(dependency, {}, goal)).toEqual({
      valid: true,
    })
  })

  it("surfaces a repeat config error with its message", () => {
    const taskA = createTask(taskAId, {
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-10T00:00:00"),
      },
    })

    const result = validateTreeRepeatIntegrity(
      dependency,
      { [taskAId]: taskA },
      goal
    )

    expect(result.valid).toBe(false)
    expect(result.errorMessage).toBe(
      "Pick both start and end dates for the repeat period."
    )
  })

  it("surfaces a trigger window error with its message", () => {
    const taskB = createTask(taskBId, {
      trigger: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-05-20T00:00:00"),
        endsAt: new Date("2026-05-10T00:00:00"),
      },
    })

    const result = validateTreeRepeatIntegrity(
      dependency,
      { [taskBId]: taskB },
      goal
    )

    expect(result.valid).toBe(false)
    expect(result.errorMessage).toBe(
      "Trigger period end must be on or after the start date."
    )
  })
})

describe("translateScheduleValidationError", () => {
  it("localizes partial-range with the trigger period wording", () => {
    expect(
      translateScheduleValidationError(
        { kind: "partial-range", periodKind: "trigger", message: "" },
        en
      )
    ).toBe("Pick both start and end dates for the trigger period.")
  })

  it("localizes invalid-range, defaulting to the repeat period", () => {
    expect(
      translateScheduleValidationError(
        { kind: "invalid-range", message: "" },
        en
      )
    ).toBe("Repeat period end must be on or after the start date.")
  })

  it("localizes no-occurrences", () => {
    expect(
      translateScheduleValidationError(
        { kind: "no-occurrences", periodKind: "repeat", message: "" },
        en
      )
    ).toBe(
      "No occurrences fall inside the repeat window. Adjust the dates or pick at least one weekday."
    )
  })

  it("localizes total-exceeds-occurrences with the cap (0 when absent)", () => {
    expect(
      translateScheduleValidationError(
        {
          kind: "total-exceeds-occurrences",
          periodKind: "repeat",
          message: "",
          maximumAllowedTotal: 4,
        },
        en
      )
    ).toBe(
      "Completion count cannot exceed the 4 planned occurrences in the repeat window."
    )
    expect(
      translateScheduleValidationError(
        { kind: "total-exceeds-occurrences", message: "" },
        en
      )
    ).toContain("the 0 planned occurrences")
  })
})
