import { describe, expect, it } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { GoalFocus } from "@/domain/derived/GoalFocus"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import { buildMyGoalsPageVM } from "@/store/pages/build-my-goals-page-vm"

function goal(id: string, overrides: Partial<GoalEntity> = {}): GoalEntity {
  return {
    id: id as GoalID,
    title: `Goal ${id}`,
    createdAt: new Date("2026-05-01T09:00:00"),
    ...overrides,
  }
}

function task(
  id: string,
  goalId: string,
  overrides: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id: id as TaskID,
    goalId: goalId as GoalID,
    title: `Task ${id}`,
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...overrides,
  }
}

function focus(id: string, statuses: GoalFocus["focusStatuses"]): GoalFocus {
  return { id: id as GoalID, isFocused: statuses.length > 0, focusStatuses: statuses }
}

describe("buildMyGoalsPageVM", () => {
  it("splits goals into inProgress and done buckets", () => {
    const vm = buildMyGoalsPageVM({
      goals: { ["open" as GoalID]: goal("open"), ["done" as GoalID]: goal("done") },
      tasks: {
        ["t1" as TaskID]: task("t1", "open"),
        ["t2" as TaskID]: task("t2", "done", { completedCount: 1 }),
      },
      goalFocus: {},
      maxFocusGoals: 3,
    })

    expect(vm.inProgress.map((i) => i.goal.id)).toEqual(["open"])
    expect(vm.done.map((i) => i.goal.id)).toEqual(["done"])
    expect(vm.done[0]).toMatchObject({
      isDone: true,
      completedCount: 1,
      totalCount: 1,
    })
  })

  it("treats an empty goal as not done", () => {
    const vm = buildMyGoalsPageVM({
      goals: { ["empty" as GoalID]: goal("empty") },
      tasks: {},
      goalFocus: {},
      maxFocusGoals: 3,
    })

    expect(vm.inProgress).toHaveLength(1)
    expect(vm.inProgress[0]).toMatchObject({
      isDone: false,
      completedCount: 0,
      totalCount: 0,
    })
  })

  it("derives focus flags from the goal's focus statuses", () => {
    const vm = buildMyGoalsPageVM({
      goals: {
        ["manual" as GoalID]: goal("manual"),
        ["forced" as GoalID]: goal("forced"),
        ["idle" as GoalID]: goal("idle"),
      },
      tasks: {
        ["t1" as TaskID]: task("t1", "manual"),
        ["t2" as TaskID]: task("t2", "forced"),
        ["t3" as TaskID]: task("t3", "idle"),
      },
      goalFocus: {
        ["manual" as GoalID]: focus("manual", [
          { kind: "manualFocus", isBlocking: false },
        ]),
        ["forced" as GoalID]: focus("forced", [
          {
            kind: "goalDuePolicy",
            isBlocking: true,
            dueAt: new Date("2026-05-20T00:00:00"),
          },
        ]),
      },
      maxFocusGoals: 3,
    })

    const byId = Object.fromEntries(vm.inProgress.map((i) => [i.goal.id, i]))
    expect(byId["manual"]).toMatchObject({ isFocused: true, isForced: false })
    expect(byId["forced"]).toMatchObject({ isFocused: true, isForced: true })
    expect(byId["idle"]).toMatchObject({ isFocused: false, isForced: false })
  })

  it("counts the focus quota including forced goals", () => {
    const vm = buildMyGoalsPageVM({
      goals: {
        ["manual" as GoalID]: goal("manual"),
        ["forced" as GoalID]: goal("forced"),
        ["idle" as GoalID]: goal("idle"),
      },
      tasks: {},
      goalFocus: {
        ["manual" as GoalID]: focus("manual", [
          { kind: "manualFocus", isBlocking: false },
        ]),
        ["forced" as GoalID]: focus("forced", [
          {
            kind: "taskDuePolicy",
            isBlocking: true,
            taskId: "t2" as TaskID,
            taskTitle: "Task t2",
            dueAt: new Date("2026-05-20T00:00:00"),
          },
        ]),
      },
      maxFocusGoals: 5,
    })

    expect(vm.focusQuota).toEqual({
      focusedCount: 2,
      forcedFocusedCount: 1,
      maxFocusGoals: 5,
    })
  })

  it("labels goals with a due date", () => {
    const vm = buildMyGoalsPageVM({
      goals: {
        ["due" as GoalID]: goal("due", {
          dueAt: new Date("2026-05-20T00:00:00"),
        }),
      },
      tasks: {},
      goalFocus: {},
      maxFocusGoals: 3,
    })

    expect(vm.inProgress[0]!.dueLabel).toBeTruthy()
  })
})
