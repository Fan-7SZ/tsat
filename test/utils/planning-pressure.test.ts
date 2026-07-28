import { describe, expect, it } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { computePressureByDay } from "@/utils/planning-pressure"

const NOW = new Date("2026-06-14T09:00:00") // forecast window: 06-14 .. 06-27

// Repeat task: ledger has a past point (excluded), a today point, a completed
// point (not "planned" → excluded) and a beyond-horizon point (excluded).
const repeatTaskId = "task-repeat" as TaskID
const repeatTask: TaskGroupEntity = {
  id: repeatTaskId,
  title: "Daily check-in",
  createdAt: new Date("2026-06-01T09:00:00"),
  repeat: { rule: { mode: "daily", interval: 1 } },
  estimatedDuration: 30,
  total: 1,
  completedCount: 0,
}
const repeatLedger: Record<TaskID, RepeatLedgerEntity> = {
  [repeatTaskId]: {
    taskId: repeatTaskId,
    points: {
      "2026-06-13": "planned", // past → excluded
      "2026-06-14": "planned", // today → counted
      "2026-06-15": "completed", // not planned → excluded
      "2026-06-28": "planned", // beyond horizon → excluded
    } as RepeatLedgerEntity["points"],
  },
}

// Task trigger: daily/interval 7 anchored at 06-14 → fires 06-14, 06-21.
const triggerTaskId = "task-trigger" as TaskID
const triggerTask: TaskGroupEntity = {
  id: triggerTaskId,
  title: "Weekly report",
  createdAt: new Date("2026-06-01T09:00:00"),
  trigger: {
    rule: { mode: "daily", interval: 7 },
    startsAt: new Date("2026-06-14T00:00:00"),
  },
  estimatedDuration: 45,
  total: 1,
  completedCount: 0,
}

// Goal trigger: daily/interval 7 anchored at 06-14 → fires 06-14, 06-21.
// A goal with a trigger pulls up *each* of its tasks on every fire date.
const triggerGoalId = "goal-trigger" as GoalID
const triggerGoal: GoalEntity = {
  id: triggerGoalId,
  title: "Recurring goal",
  createdAt: new Date("2026-06-14T00:00:00"),
  trigger: { rule: { mode: "daily", interval: 7 } },
}

// Task under the trigger goal: no trigger of its own (goal-triggered tasks are
// forced single-run). Pulled up on each goal-trigger fire date (06-14, 06-21).
const goalTaskId = "task-of-goal" as TaskID
const goalTask: TaskGroupEntity = {
  id: goalTaskId,
  title: "Read a chapter",
  goalId: triggerGoalId,
  createdAt: new Date("2026-06-01T09:00:00"),
  estimatedDuration: 20,
  total: 1,
  completedCount: 0,
}

// A finished task under the same goal — excluded (completedCount >= total).
const doneGoalTaskId = "task-of-goal-done" as TaskID
const doneGoalTask: TaskGroupEntity = {
  id: doneGoalTaskId,
  title: "Already done",
  goalId: triggerGoalId,
  createdAt: new Date("2026-06-01T09:00:00"),
  estimatedDuration: 99,
  total: 1,
  completedCount: 1,
}

describe("computePressureByDay", () => {
  const result = computePressureByDay({
    tasks: {
      [repeatTaskId]: repeatTask,
      [triggerTaskId]: triggerTask,
      [goalTaskId]: goalTask,
      [doneGoalTaskId]: doneGoalTask,
    },
    goals: { [triggerGoalId]: triggerGoal },
    repeatLedger,
    now: NOW,
    days: 14,
  })
  const at = (key: string) => result[key as LocalDateKey]

  it("sums repeat + task-trigger + goal-trigger on the same day", () => {
    // 06-14: repeat(30m) + task trigger(45m) + goal trigger task(20m) = count 3
    const day = at("2026-06-14")
    expect(day.count).toBe(3)
    expect(day.minutes).toBe(95)
    expect(day.items).toHaveLength(3)
    expect(day.items.map((i) => i.reason).sort()).toEqual([
      "goalTrigger",
      "repeat",
      "taskTrigger",
    ])
    expect(day.items.map((i) => i.title).sort()).toEqual([
      "Daily check-in",
      "Read a chapter",
      "Weekly report",
    ])
  })

  it("counts trigger fires later in the window", () => {
    // 06-21: task trigger(45m) + goal trigger task(20m) = count 2
    const day = at("2026-06-21")
    expect(day.count).toBe(2)
    expect(day.minutes).toBe(65)
    expect(day.items).toHaveLength(2)
  })

  it("records goal-trigger contributions per task with goal metadata", () => {
    const goalItem = at("2026-06-21").items.find(
      (i) => i.reason === "goalTrigger"
    )
    expect(goalItem).toMatchObject({
      taskId: goalTaskId,
      title: "Read a chapter",
      goalId: triggerGoalId,
      goalTitle: "Recurring goal",
      minutes: 20,
    })
  })

  it("excludes finished tasks from goal triggers", () => {
    const titles = at("2026-06-14").items.map((i) => i.title)
    expect(titles).not.toContain("Already done")
  })

  it("excludes past planned points", () => {
    expect(at("2026-06-13")).toBeUndefined()
  })

  it("excludes non-planned (completed) points", () => {
    expect(at("2026-06-15")).toBeUndefined()
  })

  it("excludes points beyond the forecast horizon", () => {
    expect(at("2026-06-28")).toBeUndefined()
  })

  it("ignores ledger entries whose task no longer exists", () => {
    const orphanId = "task-orphan" as TaskID
    const orphaned = computePressureByDay({
      tasks: {},
      goals: {},
      repeatLedger: {
        [orphanId]: {
          taskId: orphanId,
          points: {
            "2026-06-14": "planned",
          } as RepeatLedgerEntity["points"],
        },
      },
      now: NOW,
      days: 14,
    })

    expect(Object.keys(orphaned)).toHaveLength(0)
  })

  it("excludes finished tasks from their own trigger", () => {
    const doneTriggerId = "task-trigger-done" as TaskID
    const doneTrigger = computePressureByDay({
      tasks: {
        [doneTriggerId]: { ...triggerTask, id: doneTriggerId, completedCount: 1 },
      },
      goals: {},
      repeatLedger: {},
      now: NOW,
      days: 14,
    })

    expect(Object.keys(doneTrigger)).toHaveLength(0)
  })

  it("leaves minutes at 0 when the task has no estimate", () => {
    const noEstimateId = "task-no-estimate" as TaskID
    const noEstimate = computePressureByDay({
      tasks: {
        [noEstimateId]: {
          ...triggerTask,
          id: noEstimateId,
          estimatedDuration: undefined,
        },
      },
      goals: {},
      repeatLedger: {},
      now: NOW,
      days: 14,
    })

    const day = noEstimate["2026-06-14" as LocalDateKey]
    expect(day.count).toBe(1)
    expect(day.minutes).toBe(0)
  })
})

describe("computePressureByDay due contributions", () => {
  const dueGoalId = "goal-due" as GoalID
  const dueGoal: GoalEntity = {
    id: dueGoalId,
    title: "Due goal",
    createdAt: new Date("2026-06-01T09:00:00"),
    dueAt: new Date("2026-06-22T18:00:00"),
  }

  // Keeps dueGoal unfinished; its own dueAt lands on 06-20 at 14:30.
  const dueTaskId = "task-due" as TaskID
  const dueTask: TaskGroupEntity = {
    id: dueTaskId,
    title: "Ship the report",
    goalId: dueGoalId,
    createdAt: new Date("2026-06-01T09:00:00"),
    dueAt: new Date("2026-06-20T14:30:00"),
    total: 1,
    completedCount: 0,
  }

  // Finished → its due is not shown.
  const doneDueTaskId = "task-due-done" as TaskID
  const doneDueTask: TaskGroupEntity = {
    id: doneDueTaskId,
    title: "Done already",
    createdAt: new Date("2026-06-01T09:00:00"),
    dueAt: new Date("2026-06-20T10:00:00"),
    total: 1,
    completedCount: 1,
  }

  // Beyond the horizon → not shown.
  const farDueTaskId = "task-due-far" as TaskID
  const farDueTask: TaskGroupEntity = {
    id: farDueTaskId,
    title: "Far away",
    createdAt: new Date("2026-06-01T09:00:00"),
    dueAt: new Date("2026-06-30T10:00:00"),
    total: 1,
    completedCount: 0,
  }

  // A goal that is already done (its only task is finished) → its due hidden.
  const doneGoalId = "goal-done" as GoalID
  const doneGoal: GoalEntity = {
    id: doneGoalId,
    title: "Finished goal",
    createdAt: new Date("2026-06-01T09:00:00"),
    dueAt: new Date("2026-06-21T18:00:00"),
  }
  const doneGoalTaskId = "task-of-done-goal" as TaskID
  const doneGoalTask: TaskGroupEntity = {
    id: doneGoalTaskId,
    title: "Wrapped up",
    goalId: doneGoalId,
    createdAt: new Date("2026-06-01T09:00:00"),
    total: 1,
    completedCount: 1,
  }

  // Unfinished (empty goals never read as done) but due beyond the horizon.
  const farGoalId = "goal-due-far" as GoalID
  const farGoal: GoalEntity = {
    id: farGoalId,
    title: "Far goal",
    createdAt: new Date("2026-06-01T09:00:00"),
    dueAt: new Date("2026-07-05T18:00:00"),
  }

  const result = computePressureByDay({
    tasks: {
      [dueTaskId]: dueTask,
      [doneDueTaskId]: doneDueTask,
      [farDueTaskId]: farDueTask,
      [doneGoalTaskId]: doneGoalTask,
    },
    goals: {
      [dueGoalId]: dueGoal,
      [doneGoalId]: doneGoal,
      [farGoalId]: farGoal,
    },
    repeatLedger: {},
    now: NOW,
    days: 14,
  })
  const at = (key: string) => result[key as LocalDateKey]

  it("records a task due with its time label and goal title", () => {
    const day = at("2026-06-20")
    expect(day.due).toEqual([
      {
        kind: "task",
        id: dueTaskId,
        title: "Ship the report",
        goalTitle: "Due goal",
        timeLabel: "14:30",
      },
    ])
  })

  it("a due-only day contributes no pressure count", () => {
    const day = at("2026-06-20")
    expect(day.count).toBe(0)
    expect(day.items).toHaveLength(0)
  })

  it("records an unfinished goal's due", () => {
    expect(at("2026-06-22").due).toEqual([
      {
        kind: "goal",
        id: dueGoalId,
        title: "Due goal",
        timeLabel: "18:00",
      },
    ])
  })

  it("hides the due of a finished task", () => {
    const dues = at("2026-06-20").due ?? []
    expect(dues.map((d) => d.id)).not.toContain(doneDueTaskId)
  })

  it("hides the due of a finished goal", () => {
    expect(at("2026-06-21")).toBeUndefined()
  })

  it("hides dues beyond the forecast horizon", () => {
    expect(at("2026-06-30")).toBeUndefined()
    expect(at("2026-07-05")).toBeUndefined()
  })
})
