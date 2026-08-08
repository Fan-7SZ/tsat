import { describe, expect, it } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import type { PlannerPolicy } from "@/services/planner/types"
import {
  isGoalDueForcedToday,
  isGoalForcedFocused,
  isTaskForcedToday,
} from "@/services/planner/internal/forced-policy"

const now = new Date("2026-05-13T10:00:00")

const policy: PlannerPolicy = {
  dailyCapacityMinutes: 480,
  taskForcedTodoDays: 3,
  goalForcedFocusDays: 3,
  maxFocusGoals: 3,
}

function task(
  id: string,
  overrides: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id: id as TaskID,
    title: id,
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...overrides,
  }
}

function goal(id: string, overrides: Partial<GoalEntity> = {}): GoalEntity {
  return {
    id: id as GoalID,
    title: id,
    createdAt: new Date("2026-05-01T09:00:00"),
    ...overrides,
  }
}

function runtime(
  id: string,
  taskId: string,
  overrides: Partial<TaskRuntimeEntity> = {}
): TaskRuntimeEntity {
  return {
    id: id as TaskRuntimeID,
    taskId: taskId as TaskID,
    arrangementStatus: "todo",
    source: "default",
    ...overrides,
  } as TaskRuntimeEntity
}

describe("isTaskForcedToday", () => {
  it("forces a plain task due within the window (calendar days)", () => {
    const dueAt = new Date("2026-05-16T23:00:00") // 3 days out, window 3
    expect(isTaskForcedToday(task("t", { dueAt }), policy, now)).toEqual({
      isForced: true,
      dueAt,
    })
  })

  it("forces an overdue task", () => {
    const dueAt = new Date("2026-05-10T08:00:00")
    expect(
      isTaskForcedToday(task("t", { dueAt }), policy, now).isForced
    ).toBe(true)
  })

  it("does not force a task due beyond the window", () => {
    const dueAt = new Date("2026-05-17T00:00:00") // 4 days out
    expect(isTaskForcedToday(task("t", { dueAt }), policy, now)).toEqual({
      isForced: false,
    })
  })

  it("never forces a task without a due date", () => {
    expect(isTaskForcedToday(task("t"), policy, now)).toEqual({
      isForced: false,
    })
  })

  it("never forces repeat or trigger tasks even when due today", () => {
    const dueAt = new Date("2026-05-13T23:00:00")
    const repeatTask = task("t", {
      dueAt,
      repeat: { rule: { mode: "daily", interval: 1 } },
    })
    const triggerTask = task("t", {
      dueAt,
      trigger: { rule: { mode: "daily", interval: 1 } },
    })
    expect(isTaskForcedToday(repeatTask, policy, now).isForced).toBe(false)
    expect(isTaskForcedToday(triggerTask, policy, now).isForced).toBe(false)
  })

  it("never forces a finished task, even when overdue", () => {
    const overdue = task("t", {
      dueAt: new Date("2026-05-10T08:00:00"),
      total: 1,
      completedCount: 1,
    })
    const dueToday = task("t", {
      dueAt: new Date("2026-05-13T23:00:00"),
      total: 3,
      completedCount: 3,
    })
    expect(isTaskForcedToday(overdue, policy, now).isForced).toBe(false)
    expect(isTaskForcedToday(dueToday, policy, now).isForced).toBe(false)
  })
})

describe("isGoalDueForcedToday", () => {
  it("is false without a due date", () => {
    expect(isGoalDueForcedToday(goal("g"), policy, now)).toBe(false)
  })

  it("is true within the window (including overdue), false beyond", () => {
    expect(
      isGoalDueForcedToday(
        goal("g", { dueAt: new Date("2026-05-16T12:00:00") }),
        policy,
        now
      )
    ).toBe(true)
    expect(
      isGoalDueForcedToday(
        goal("g", { dueAt: new Date("2026-05-01T12:00:00") }),
        policy,
        now
      )
    ).toBe(true)
    expect(
      isGoalDueForcedToday(
        goal("g", { dueAt: new Date("2026-05-20T12:00:00") }),
        policy,
        now
      )
    ).toBe(false)
  })
})

describe("isGoalForcedFocused", () => {
  it("returns no statuses for a goal with no tasks, even with a due date", () => {
    const dueGoal = goal("g", { dueAt: new Date("2026-05-13T23:00:00") })
    expect(isGoalForcedFocused(dueGoal, [], {}, policy, now)).toEqual({
      statuses: [],
    })
  })

  it("reports manualTodayTask for a task with a manual runtime", () => {
    const t = task("t")
    const rt = { t: runtime("t", "t", { source: "manual" }) }
    const { statuses } = isGoalForcedFocused(goal("g"), [t], rt, policy, now)
    expect(statuses).toEqual([
      {
        kind: "manualTodayTask",
        isBlocking: true,
        taskId: "t",
        taskTitle: "t",
      },
    ])
  })

  it("prefers manualTodayTask over other reasons for the same task", () => {
    // Manual + repeat runtimes on the same task: manual wins, one status only.
    const t = task("t", { repeat: { rule: { mode: "daily", interval: 1 } } })
    const rt = {
      t: runtime("t", "t", { source: "manual" }),
      "t::2026-05-13": runtime("t::2026-05-13", "t", {
        source: "repeatPolicy",
        plannedForDate: "2026-05-13" as LocalDateKey,
      }),
    }
    const { statuses } = isGoalForcedFocused(goal("g"), [t], rt, policy, now)
    expect(statuses).toHaveLength(1)
    expect(statuses[0].kind).toBe("manualTodayTask")
  })

  it("reports repeatPolicyPoint with the runtime's plannedForDate", () => {
    const t = task("t", { repeat: { rule: { mode: "daily", interval: 1 } } })
    const rt = {
      "t::2026-05-10": runtime("t::2026-05-10", "t", {
        source: "repeatPolicy",
        plannedForDate: "2026-05-10" as LocalDateKey,
      }),
    }
    const { statuses } = isGoalForcedFocused(goal("g"), [t], rt, policy, now)
    expect(statuses).toEqual([
      {
        kind: "repeatPolicyPoint",
        isBlocking: true,
        taskId: "t",
        taskTitle: "t",
        plannedForDate: "2026-05-10",
      },
    ])
  })

  it("reports taskTriggerPolicy with today's date key", () => {
    const t = task("t", { trigger: { rule: { mode: "daily", interval: 1 } } })
    const rt = { t: runtime("t", "t", { source: "triggerPolicy" }) }
    const { statuses } = isGoalForcedFocused(goal("g"), [t], rt, policy, now)
    expect(statuses).toEqual([
      {
        kind: "taskTriggerPolicy",
        isBlocking: true,
        taskId: "t",
        taskTitle: "t",
        firedDate: "2026-05-13",
      },
    ])
  })

  it("reports taskDuePolicy for a due-forced task without runtimes", () => {
    const dueAt = new Date("2026-05-14T09:00:00")
    const t = task("t", { dueAt })
    const { statuses } = isGoalForcedFocused(goal("g"), [t], {}, policy, now)
    expect(statuses).toEqual([
      {
        kind: "taskDuePolicy",
        isBlocking: true,
        taskId: "t",
        taskTitle: "t",
        dueAt,
      },
    ])
  })

  it("adds an independent goalDuePolicy status when the goal itself is due", () => {
    const goalDue = new Date("2026-05-13T23:00:00")
    const t = task("t", { dueAt: new Date("2026-05-14T09:00:00") })
    const { statuses } = isGoalForcedFocused(
      goal("g", { dueAt: goalDue }),
      [t],
      {},
      policy,
      now
    )
    expect(statuses).toHaveLength(2)
    expect(statuses.map((s) => s.kind).sort()).toEqual([
      "goalDuePolicy",
      "taskDuePolicy",
    ])
  })

  it("produces at most one task-level status per task, across many tasks", () => {
    const t1 = task("t1")
    const t2 = task("t2", { dueAt: new Date("2026-05-13T23:00:00") })
    const t3 = task("t3") // nothing forcing it
    const rt = { t1: runtime("t1", "t1", { source: "manual" }) }
    const { statuses } = isGoalForcedFocused(
      goal("g"),
      [t1, t2, t3],
      rt,
      policy,
      now
    )
    expect(statuses.map((s) => s.kind).sort()).toEqual([
      "manualTodayTask",
      "taskDuePolicy",
    ])
  })
})
