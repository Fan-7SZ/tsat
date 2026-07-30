import { describe, expect, it } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import { projectUpcomingTriggerFires } from "@/services/planner/projection"
import {
  getPendingTaskTriggerDateKey,
  getPendingTriggerDateKey,
} from "@/utils/trigger-evaluation"

const goalId = "goal-1" as GoalID
const taskId = "task-1" as TaskID
const now = new Date("2026-05-13T10:00:00")
const HORIZON_DAYS = 21

function makeGoal(rule: triggerRule): GoalEntity {
  return {
    id: goalId,
    title: "Goal",
    createdAt: new Date("2026-05-01T09:00:00"),
    trigger: { rule },
  }
}

function makeTask(patch: Partial<TaskGroupEntity> = {}): TaskGroupEntity {
  return {
    id: taskId,
    goalId,
    title: "Task",
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

function atDay(dateKey: LocalDateKey): Date {
  return new Date(`${dateKey}T10:00:00`)
}

/**
 * Replays the ACTUAL fire mechanism day by day over the horizon: what
 * `runTriggerResetIfNeeded` would record, given each day's pending check.
 */
function simulateGoalFires(goal: GoalEntity, days: LocalDateKey[]): string[] {
  const fires: string[] = []
  let lastTriggeredDateKey: LocalDateKey | undefined
  for (const day of days) {
    const pending = getPendingTriggerDateKey({
      goal,
      lastTriggeredDateKey,
      now: atDay(day),
    })
    if (pending) {
      fires.push(pending)
      lastTriggeredDateKey = pending
    }
  }
  return fires
}

function simulateTaskFires(
  task: TaskGroupEntity,
  days: LocalDateKey[]
): string[] {
  const fires: string[] = []
  let lastTriggeredDateKey: LocalDateKey | undefined
  for (const day of days) {
    const pending = getPendingTaskTriggerDateKey({
      task,
      lastTriggeredDateKey,
      taskRuntime: {},
      now: atDay(day),
    })
    if (pending) {
      fires.push(pending)
      lastTriggeredDateKey = pending
    }
  }
  return fires
}

/** Every calendar day of the projection horizon, for the simulation clock. */
function horizonDays(): LocalDateKey[] {
  const days: LocalDateKey[] = []
  const cursor = new Date(now)
  for (let i = 0; i < HORIZON_DAYS; i++) {
    days.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}` as LocalDateKey
    )
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

// The projection is a UI forecast; getPendingTriggerDateKey is what actually
// fires. These tests pin the two to each other so a drift in either turns red
// instead of silently showing users a schedule the planner won't honour.
describe("projection ↔ actual fire mechanism contract", () => {
  const goalRules: Array<[string, triggerRule]> = [
    ["daily interval 1", { mode: "daily", interval: 1 }],
    ["daily interval 3", { mode: "daily", interval: 3 }],
    ["weekly mon/thu", { mode: "weekly", interval: 1, daysOfWeek: [1, 4] }],
    ["monthly day 20", { mode: "monthly", dayOfMonth: 20 }],
    [
      "custom dates",
      {
        mode: "custom",
        date: [
          new Date("2026-05-15T00:00:00"),
          new Date("2026-05-25T00:00:00"),
        ],
      },
    ],
  ]

  for (const [label, rule] of goalRules) {
    it(`goal trigger (${label}): predicted fires match the day-by-day fire simulation`, () => {
      const goal = makeGoal(rule)
      const projection = projectUpcomingTriggerFires({
        task: makeTask(),
        goal,
        now,
        days: HORIZON_DAYS,
      })

      expect(projection).not.toBeNull()
      expect(projection!.byGoalTrigger).toBe(true)
      expect(projection!.fires).toEqual(simulateGoalFires(goal, horizonDays()))
    })
  }

  it("task trigger with a validity window: prediction matches the simulation", () => {
    const task = makeTask({
      goalId: undefined,
      trigger: {
        rule: { mode: "daily", interval: 2 },
        startsAt: new Date("2026-05-14T00:00:00"),
        endsAt: new Date("2026-05-24T00:00:00"),
      },
    })
    const projection = projectUpcomingTriggerFires({
      task,
      goal: undefined,
      now,
      days: HORIZON_DAYS,
    })

    expect(projection).not.toBeNull()
    expect(projection!.byGoalTrigger).toBe(false)
    expect(projection!.fires).toEqual(simulateTaskFires(task, horizonDays()))
  })

  it("a goal-trigger task finished this round drops today but keeps later fires", () => {
    // The fire starts a new round (it drops the previous rounds' completion
    // records), so "finished" is a today-only state — the forecast must survive.
    const goal = makeGoal({ mode: "daily", interval: 1 })
    const open = projectUpcomingTriggerFires({
      task: makeTask(),
      goal,
      now,
      days: HORIZON_DAYS,
    })!
    const finished = projectUpcomingTriggerFires({
      task: makeTask({ completedCount: 1 }),
      goal,
      now,
      days: HORIZON_DAYS,
    })!

    expect(open.fires).toContain("2026-05-13")
    expect(finished.fires).not.toContain("2026-05-13")
    expect(finished.fires).toEqual(
      open.fires.filter((dateKey) => dateKey !== "2026-05-13")
    )
    expect(finished.fires.length).toBeGreaterThan(0)
  })

  it("a finished task trigger projects nothing — its progress is cumulative", () => {
    // applyTaskTriggerResetAtomic records only lastTriggeredDateKey; the counter
    // is never reset, so a finished task trigger is finished for good.
    expect(
      projectUpcomingTriggerFires({
        task: makeTask({
          goalId: undefined,
          completedCount: 1,
          trigger: { rule: { mode: "daily", interval: 1 } },
        }),
        goal: undefined,
        now,
        days: HORIZON_DAYS,
      })
    ).toBeNull()
  })

  it("projects nothing for a task with no trigger at all", () => {
    expect(
      projectUpcomingTriggerFires({
        task: makeTask({ goalId: undefined }),
        goal: undefined,
        now,
        days: HORIZON_DAYS,
      })
    ).toBeNull()
  })

  it("the goal's trigger wins over the task's own config", () => {
    // Domain invariant: trigger goals normalize their tasks, so a task under a
    // trigger goal projects the GOAL's rule.
    const projection = projectUpcomingTriggerFires({
      task: makeTask(),
      goal: makeGoal({ mode: "daily", interval: 5 }),
      now,
      days: HORIZON_DAYS,
    })

    expect(projection!.byGoalTrigger).toBe(true)
    expect(projection!.rule).toEqual({ mode: "daily", interval: 5 })
  })
})
