import { describe, expect, it } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import {
  getNextTriggerDateKeyAfter,
  getPendingTaskTriggerDateKey,
  getPendingTriggerDateKey,
} from "@/utils/trigger-evaluation"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"

const goalId = "goal-1" as GoalID

function createGoal(patch: Partial<GoalEntity> = {}): GoalEntity {
  return {
    id: goalId,
    title: "Triggered goal",
    createdAt: new Date("2026-05-10T09:00:00"),
    trigger: { rule: { mode: "daily", interval: 1 } },
    ...patch,
  }
}

function dailyRule(interval: number): triggerRule {
  return { mode: "daily", interval }
}

describe("getPendingTriggerDateKey", () => {
  it("does not trigger when the goal has no trigger", () => {
    const dateKey = getPendingTriggerDateKey({
      goal: createGoal({ trigger: undefined }),
      now: new Date("2026-05-11T09:00:00"),
    })

    expect(dateKey).toBeNull()
  })

  it("uses the goal anchor and daily interval to decide pending dates", () => {
    const goal = createGoal({
      createdAt: new Date("2026-05-10T00:00:00"),
      trigger: { rule: dailyRule(2) },
    })

    expect(
      getPendingTriggerDateKey({
        goal,
        now: new Date("2026-05-12T10:00:00"),
      })
    ).toBe("2026-05-12")

    expect(
      getPendingTriggerDateKey({
        goal,
        now: new Date("2026-05-13T10:00:00"),
      })
    ).toBeNull()
  })

  it("does not trigger twice for the same local date", () => {
    const dateKey = getPendingTriggerDateKey({
      goal: createGoal(),
      lastTriggeredDateKey: LocalDateKeySchema.parse("2026-05-11"),
      now: new Date("2026-05-11T23:30:00"),
    })

    expect(dateKey).toBeNull()
  })

  it("respects weekly interval and selected weekdays", () => {
    const goal = createGoal({
      createdAt: new Date("2026-05-03T00:00:00"),
      trigger: {
        rule: { mode: "weekly", interval: 2, daysOfWeek: [0, 3] },
      },
    })

    expect(
      getPendingTriggerDateKey({
        goal,
        now: new Date("2026-05-17T09:00:00"),
      })
    ).toBe("2026-05-17")

    expect(
      getPendingTriggerDateKey({
        goal,
        now: new Date("2026-05-18T09:00:00"),
      })
    ).toBeNull()
  })

  it("fires monthly on the chosen day of month only", () => {
    const goal = createGoal({
      createdAt: new Date("2026-05-10T00:00:00"),
      trigger: { rule: { mode: "monthly", dayOfMonth: 15 } },
    })

    expect(
      getPendingTriggerDateKey({
        goal,
        now: new Date("2026-05-15T09:00:00"),
      })
    ).toBe("2026-05-15")

    expect(
      getPendingTriggerDateKey({
        goal,
        now: new Date("2026-05-16T09:00:00"),
      })
    ).toBeNull()
  })

  it("clamps the monthly day to the last day of shorter months", () => {
    const goal = createGoal({
      createdAt: new Date("2026-01-10T00:00:00"),
      trigger: { rule: { mode: "monthly", dayOfMonth: 31 } },
    })

    // 2026-02 has 28 days, so day 31 clamps to the 28th.
    expect(
      getPendingTriggerDateKey({
        goal,
        now: new Date("2026-02-28T09:00:00"),
      })
    ).toBe("2026-02-28")

    expect(
      getPendingTriggerDateKey({
        goal,
        now: new Date("2026-03-31T09:00:00"),
      })
    ).toBe("2026-03-31")
  })

  it("does not fire a monthly trigger before the goal is created", () => {
    const goal = createGoal({
      createdAt: new Date("2026-05-20T00:00:00"),
      trigger: { rule: { mode: "monthly", dayOfMonth: 15 } },
    })

    expect(
      getPendingTriggerDateKey({
        goal,
        now: new Date("2026-05-15T09:00:00"),
      })
    ).toBeNull()
  })

  it("returns the latest pending custom date after the last triggered date", () => {
    const dateKey = getPendingTriggerDateKey({
      goal: createGoal({
        trigger: {
          rule: {
            mode: "custom",
            date: [
              new Date("2026-05-10T00:00:00"),
              new Date("2026-05-12T00:00:00"),
              new Date("2026-05-15T00:00:00"),
            ],
          },
        },
      }),
      lastTriggeredDateKey: LocalDateKeySchema.parse("2026-05-10"),
      now: new Date("2026-05-13T09:00:00"),
    })

    expect(dateKey).toBe("2026-05-12")
  })
})

describe("getNextTriggerDateKeyAfter", () => {
  const afterDateKey = LocalDateKeySchema.parse("2026-05-12")

  it("returns the next daily fire based on the interval", () => {
    expect(
      getNextTriggerDateKeyAfter({
        rule: { mode: "daily", interval: 3 },
        anchor: new Date("2026-05-12T00:00:00"),
        afterDateKey,
      })
    ).toBe("2026-05-15")
  })

  it("returns the next weekly fire on a selected weekday", () => {
    // 2026-05-12 is a Tuesday; next selected day (Sun=0, Wed=3) is Wed 13th.
    expect(
      getNextTriggerDateKeyAfter({
        rule: { mode: "weekly", interval: 1, daysOfWeek: [0, 3] },
        anchor: new Date("2026-05-03T00:00:00"),
        afterDateKey,
      })
    ).toBe("2026-05-13")
  })

  it("returns the next monthly fire with short-month clamping", () => {
    expect(
      getNextTriggerDateKeyAfter({
        rule: { mode: "monthly", dayOfMonth: 31 },
        anchor: new Date("2026-01-10T00:00:00"),
        afterDateKey: LocalDateKeySchema.parse("2026-01-31"),
      })
    ).toBe("2026-02-28")
  })

  it("returns the next custom date and null once exhausted", () => {
    const rule = {
      mode: "custom" as const,
      date: [
        new Date("2026-05-10T00:00:00"),
        new Date("2026-05-20T00:00:00"),
      ],
    }
    const anchor = new Date("2026-05-01T00:00:00")

    expect(
      getNextTriggerDateKeyAfter({ rule, anchor, afterDateKey })
    ).toBe("2026-05-20")
    expect(
      getNextTriggerDateKeyAfter({
        rule,
        anchor,
        afterDateKey: LocalDateKeySchema.parse("2026-05-20"),
      })
    ).toBeNull()
  })

  it("returns the anchor day itself when `after` precedes the anchor", () => {
    expect(
      getNextTriggerDateKeyAfter({
        rule: { mode: "daily", interval: 7 },
        anchor: new Date("2026-06-01T00:00:00"),
        afterDateKey,
      })
    ).toBe("2026-06-01")
  })

  it("jumps to the next fire week when the interval skips the current one", () => {
    // Anchor week starts Sun 2026-05-03; 2026-05-12 falls in week 1, which a
    // 2-week interval skips, so the next fire is Monday of week 2.
    expect(
      getNextTriggerDateKeyAfter({
        rule: { mode: "weekly", interval: 2, daysOfWeek: [1] },
        anchor: new Date("2026-05-03T00:00:00"),
        afterDateKey,
      })
    ).toBe("2026-05-18")
  })

  it("returns null for a weekly rule with no weekdays selected", () => {
    expect(
      getNextTriggerDateKeyAfter({
        rule: { mode: "weekly", interval: 1, daysOfWeek: [] },
        anchor: new Date("2026-05-03T00:00:00"),
        afterDateKey,
      })
    ).toBeNull()
  })
})

const taskId = "task-1" as TaskID

function createTask(patch: Partial<TaskGroupEntity> = {}): TaskGroupEntity {
  return {
    id: taskId,
    goalId,
    title: "Triggered task",
    createdAt: new Date("2026-05-10T09:00:00"),
    trigger: { rule: dailyRule(1) },
    allowCrossDay: false,
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

describe("getPendingTaskTriggerDateKey", () => {
  it("does not fire before the trigger window starts", () => {
    const dateKey = getPendingTaskTriggerDateKey({
      task: createTask({
        trigger: {
          rule: dailyRule(1),
          startsAt: new Date("2026-05-15T00:00:00"),
          endsAt: new Date("2026-05-20T00:00:00"),
        },
      }),
      taskRuntime: {},
      now: new Date("2026-05-13T09:00:00"),
    })

    expect(dateKey).toBeNull()
  })

  it("does not fire after the trigger window ends", () => {
    const dateKey = getPendingTaskTriggerDateKey({
      task: createTask({
        trigger: {
          rule: dailyRule(1),
          startsAt: new Date("2026-05-10T00:00:00"),
          endsAt: new Date("2026-05-12T00:00:00"),
        },
      }),
      taskRuntime: {},
      now: new Date("2026-05-13T09:00:00"),
    })

    expect(dateKey).toBeNull()
  })

  it("anchors interval math at the window start", () => {
    const task = createTask({
      // createdAt 2026-05-10; window starts 2026-05-11 with a 2-day interval,
      // so fire days are 11th, 13th, 15th — not the createdAt-based 12th/14th.
      trigger: {
        rule: dailyRule(2),
        startsAt: new Date("2026-05-11T00:00:00"),
        endsAt: new Date("2026-05-20T00:00:00"),
      },
    })

    expect(
      getPendingTaskTriggerDateKey({
        task,
        taskRuntime: {},
        now: new Date("2026-05-13T09:00:00"),
      })
    ).toBe("2026-05-13")

    expect(
      getPendingTaskTriggerDateKey({
        task,
        taskRuntime: {},
        now: new Date("2026-05-14T09:00:00"),
      })
    ).toBeNull()
  })

  it("falls back to createdAt as the anchor when no window is set", () => {
    const task = createTask({
      trigger: { rule: dailyRule(2) },
    })

    expect(
      getPendingTaskTriggerDateKey({
        task,
        taskRuntime: {},
        now: new Date("2026-05-12T09:00:00"),
      })
    ).toBe("2026-05-12")

    expect(
      getPendingTaskTriggerDateKey({
        task,
        taskRuntime: {},
        now: new Date("2026-05-13T09:00:00"),
      })
    ).toBeNull()
  })

  it("skips a due trigger while the task is unfinished when allowCrossDay is on", () => {
    const task = createTask({
      allowCrossDay: true,
      trigger: { rule: dailyRule(1) },
    })

    expect(
      getPendingTaskTriggerDateKey({
        task,
        taskRuntime: {
          [taskId]: {
            id: taskId,
            taskId,
            arrangementStatus: "inProgress",
            source: "triggerPolicy",
          },
        },
        now: new Date("2026-05-12T09:00:00"),
      })
    ).toBeNull()

    expect(
      getPendingTaskTriggerDateKey({
        task,
        taskRuntime: {
          [taskId]: {
            id: taskId,
            taskId,
            arrangementStatus: "done",
            source: "triggerPolicy",
          },
        },
        now: new Date("2026-05-12T09:00:00"),
      })
    ).toBe("2026-05-12")
  })
})
