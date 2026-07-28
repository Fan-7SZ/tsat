import { describe, expect, it } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import { en } from "@/i18n/en"
import { buildTriggerPlanItems } from "@/store/pages/build-trigger-plan-items"

const now = new Date("2026-06-13T09:00:00") // Saturday

function task(
  patch: Partial<TaskGroupEntity> & { id: string }
): TaskGroupEntity {
  const { id, ...rest } = patch
  return {
    id: id as TaskID,
    title: "Task",
    createdAt: new Date("2026-06-01T00:00:00"),
    total: 1,
    completedCount: 0,
    ...rest,
  } as TaskGroupEntity
}

function goal(patch: Partial<GoalEntity> & { id: string }): GoalEntity {
  const { id, ...rest } = patch
  return {
    id: id as GoalID,
    title: "Goal",
    createdAt: new Date("2026-06-01T00:00:00"),
    ...rest,
  } as GoalEntity
}

describe("buildTriggerPlanItems", () => {
  it("tags goal-triggered tasks and uses the goal's rule", () => {
    const goals = [
      goal({
        id: "g1",
        title: "Garden",
        trigger: { rule: { mode: "weekly", interval: 1, daysOfWeek: [4] } },
      }),
    ]
    const tasks = [task({ id: "t1", title: "Water", goalId: "g1" as GoalID })]

    const items = buildTriggerPlanItems({ goals, tasks, now, t: en })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      taskId: "t1",
      goalId: "g1",
      goalTitle: "Garden",
      byGoalTrigger: true,
      ruleSummary: "Weekly on Thu",
    })
    expect(items[0].pullUps.map((p) => p.key)).toEqual([
      "2026-06-18",
      "2026-06-25",
    ])
  })

  it("uses the task's own trigger + window when the goal is not triggered", () => {
    const goals = [goal({ id: "g1" })]
    const tasks = [
      task({
        id: "t1",
        goalId: "g1" as GoalID,
        trigger: {
          rule: { mode: "daily", interval: 1 },
          startsAt: new Date("2026-06-20T00:00:00"),
          endsAt: new Date("2026-06-22T23:59:59"),
        },
      }),
    ]

    const items = buildTriggerPlanItems({ goals, tasks, now, t: en })

    expect(items[0].byGoalTrigger).toBe(false)
    expect(items[0].ruleSummary).toBe("Daily")
    expect(items[0].windowLabel).toBe("Jun 20 – Jun 22")
    expect(items[0].pullUps.map((p) => p.key)).toEqual([
      "2026-06-20",
      "2026-06-21",
      "2026-06-22",
    ])
  })

  it("excludes today's pull-up", () => {
    const tasks = [
      task({ id: "t1", trigger: { rule: { mode: "daily", interval: 1 } } }),
    ]

    const items = buildTriggerPlanItems({ goals: [], tasks, now, t: en })

    expect(items[0].pullUps.map((p) => p.key)).not.toContain("2026-06-13")
    expect(items[0].pullUps[0].key).toBe("2026-06-14")
  })

  it("skips completed tasks and tasks with no upcoming pull-up", () => {
    const tasks = [
      task({
        id: "done",
        completedCount: 1,
        total: 1,
        trigger: { rule: { mode: "daily", interval: 1 } },
      }),
      task({
        id: "out-of-window",
        trigger: {
          rule: { mode: "custom", date: [new Date("2026-09-01T00:00:00")] },
        },
      }),
      task({ id: "plain" }),
    ]

    const items = buildTriggerPlanItems({ goals: [], tasks, now, t: en })

    expect(items).toHaveLength(0)
  })

  it("sorts items by nearest pull-up date", () => {
    const tasks = [
      task({
        id: "later",
        trigger: {
          rule: { mode: "custom", date: [new Date("2026-06-25T00:00:00")] },
        },
      }),
      task({
        id: "sooner",
        trigger: {
          rule: { mode: "custom", date: [new Date("2026-06-15T00:00:00")] },
        },
      }),
    ]

    const items = buildTriggerPlanItems({ goals: [], tasks, now, t: en })

    expect(items.map((i) => i.taskId)).toEqual(["sooner", "later"])
  })
})
