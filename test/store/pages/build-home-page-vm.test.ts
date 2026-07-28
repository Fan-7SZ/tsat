import { afterEach, describe, expect, it, vi } from "vitest"
import { format } from "date-fns"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { GoalFocus } from "@/domain/derived/GoalFocus"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import type { PlannerPolicy } from "@/services/planner/types"
import { zh } from "@/i18n/zh"
import {
  buildHomePageVM,
  type HomePageSource,
} from "@/store/pages/build-home-page-vm"

const goalId = "goal-1" as GoalID

const policy: PlannerPolicy = {
  dailyCapacityMinutes: 480,
  taskForcedTodoDays: 3,
  goalForcedFocusDays: 3,
  maxFocusGoals: 3,
}

const goal: GoalEntity = {
  id: goalId,
  title: "Goal",
  createdAt: new Date("2026-05-01T09:00:00"),
}

function task(
  id: string,
  overrides: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id: id as TaskID,
    goalId,
    title: `Task ${id}`,
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...overrides,
  }
}

function runtime(
  id: string,
  taskId: string,
  patch: Partial<TaskRuntimeEntity> = {}
): TaskRuntimeEntity {
  return {
    id: id as TaskRuntimeID,
    taskId: taskId as TaskID,
    arrangementStatus: "todo",
    source: "manual",
    ...patch,
  } as TaskRuntimeEntity
}

function buildSource(patch: Partial<HomePageSource> = {}): HomePageSource {
  return {
    goals: { [goalId]: goal },
    goalFocus: {},
    tasks: {},
    taskRuntime: {},
    repeatLedger: {},
    runStartDates: {},
    dismissedTaskIds: new Set(),
    policy,
    t: zh,
    ...patch,
  }
}

describe("buildHomePageVM", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("buckets today's runtimes by status and drops orphans", () => {
    vi.setSystemTime(new Date("2026-07-20T09:00:00"))
    const source = buildSource({
      tasks: {
        ["a" as TaskID]: task("a", { estimatedDuration: 30 }),
        ["b" as TaskID]: task("b", { estimatedDuration: 45 }),
        ["c" as TaskID]: task("c"),
      },
      taskRuntime: {
        ["a" as TaskRuntimeID]: runtime("a", "a"),
        ["b" as TaskRuntimeID]: runtime("b", "b", {
          arrangementStatus: "inProgress",
        }),
        ["c" as TaskRuntimeID]: runtime("c", "c", {
          arrangementStatus: "done",
        }),
        // No matching task → filtered out.
        ["ghost" as TaskRuntimeID]: runtime("ghost", "ghost"),
      },
    })

    const vm = buildHomePageVM(source)

    expect(vm.todayTasks.todo.map((i) => i.taskId)).toEqual(["a"])
    expect(vm.todayTasks.inProgress.map((i) => i.taskId)).toEqual(["b"])
    expect(vm.todayTasks.done.map((i) => i.taskId)).toEqual(["c"])
    expect(vm.greetingTitle).toBe("Good morning!")
    expect(vm.dateLabel).toBe("2026-07-20")
    // Every runtime on today's list counts toward the quota, done included.
    expect(vm.timeQuota).toEqual({
      usedMinutes: 75,
      dailyCapacityMinutes: 480,
    })
  })

  it("marks overdue repeat points as debt items with a plan label", () => {
    vi.setSystemTime(new Date("2026-07-20T09:00:00"))
    const debtKey = LocalDateKeySchema.parse("2026-07-18")
    const source = buildSource({
      tasks: {
        ["r" as TaskID]: task("r", {
          repeat: { rule: { mode: "daily", interval: 1 } },
        }),
      },
      taskRuntime: {
        ["r::2026-07-18" as TaskRuntimeID]: runtime("r::2026-07-18", "r", {
          source: "repeatPolicy",
          plannedForDate: debtKey,
        } as Partial<TaskRuntimeEntity>),
      },
    })

    const [item] = buildHomePageVM(source).todayTasks.todo

    expect(item).toMatchObject({
      isDebtItem: true,
      isRepeatTask: true,
      isForced: true,
      plannedForDate: debtKey,
      plannedForLabel: zh.tasks.planOn("Jul 18"),
      // Repeat tasks never offer "run again".
      canRunAgain: false,
    })
  })

  it("labels cross-day carried-over in-progress runs", () => {
    vi.setSystemTime(new Date("2026-07-20T09:00:00"))
    const source = buildSource({
      tasks: { ["a" as TaskID]: task("a") },
      taskRuntime: {
        ["a" as TaskRuntimeID]: runtime("a", "a", {
          arrangementStatus: "inProgress",
        }),
      },
      runStartDates: {
        ["a" as TaskRuntimeID]: LocalDateKeySchema.parse("2026-07-19"),
      },
    })

    const [item] = buildHomePageVM(source).todayTasks.inProgress
    expect(item!.carriedOverLabel).toBe(zh.actions.carriedOver("Jul 19"))
  })

  it("surfaces the forcing due date per policy source", () => {
    vi.setSystemTime(new Date("2026-07-20T09:00:00"))
    const taskDue = new Date("2026-07-21T18:00:00")
    const goalDue = new Date("2026-07-25T00:00:00")
    const source = buildSource({
      goals: { [goalId]: { ...goal, dueAt: goalDue } },
      tasks: {
        ["own" as TaskID]: task("own", { dueAt: taskDue }),
        ["byGoal" as TaskID]: task("byGoal"),
      },
      taskRuntime: {
        ["own" as TaskRuntimeID]: runtime("own", "own", {
          source: "duePolicy",
        }),
        ["byGoal" as TaskRuntimeID]: runtime("byGoal", "byGoal", {
          source: "goalDuePolicy",
        }),
      },
    })

    const byTask = Object.fromEntries(
      buildHomePageVM(source).todayTasks.todo.map((i) => [i.taskId, i])
    )
    expect(byTask["own"]!.forcedDueAt).toEqual(taskDue)
    expect(byTask["byGoal"]!.forcedDueAt).toEqual(goalDue)
    expect(byTask["own"]!.dueAt).toBe(format(taskDue, "PP HH:mm"))
  })

  it("joins step progress into today's items", () => {
    vi.setSystemTime(new Date("2026-07-20T09:00:00"))
    const source = buildSource({
      tasks: {
        ["s" as TaskID]: task("s", {
          steps: [
            { id: "s1", title: "one" },
            { id: "s2", title: "two" },
          ],
        }),
      },
      taskRuntime: {
        ["s" as TaskRuntimeID]: runtime("s", "s", {
          stepsCompleted: ["s2"],
        }),
      },
    })

    const [item] = buildHomePageVM(source).todayTasks.todo
    expect(item!.steps).toEqual([
      { id: "s1", title: "one", done: false },
      { id: "s2", title: "two", done: true },
    ])
  })

  it("collapses multiple done runs of one task into a single row", () => {
    vi.setSystemTime(new Date("2026-07-20T09:00:00"))
    const counter = task("c", { total: 3, completedCount: 2 })
    const source = buildSource({
      tasks: { ["c" as TaskID]: counter },
      taskRuntime: {
        ["c::run::2026-07-20::1" as TaskRuntimeID]: runtime(
          "c::run::2026-07-20::1",
          "c",
          { arrangementStatus: "done" }
        ),
        ["c::run::2026-07-20::2" as TaskRuntimeID]: runtime(
          "c::run::2026-07-20::2",
          "c",
          { arrangementStatus: "done" }
        ),
      },
    })

    const done = buildHomePageVM(source).todayTasks.done
    expect(done).toHaveLength(1)
    expect(done[0]!.runsLabel).toBe(zh.actions.runsDoneToday(2))
  })

  it("orders open items by planned date / due date, then title", () => {
    vi.setSystemTime(new Date("2026-07-20T09:00:00"))
    const source = buildSource({
      tasks: {
        ["zebra" as TaskID]: task("zebra", { title: "Zebra" }),
        ["apple" as TaskID]: task("apple", { title: "Apple" }),
        ["due" as TaskID]: task("due", {
          title: "Dated",
          dueAt: new Date("2026-07-22T00:00:00"),
        }),
        ["planned" as TaskID]: task("planned", {
          title: "Planned",
          repeat: { rule: { mode: "daily", interval: 1 } },
        }),
      },
      taskRuntime: {
        ["zebra" as TaskRuntimeID]: runtime("zebra", "zebra"),
        ["apple" as TaskRuntimeID]: runtime("apple", "apple"),
        ["due" as TaskRuntimeID]: runtime("due", "due", {
          source: "duePolicy",
        }),
        ["planned::2026-07-20" as TaskRuntimeID]: runtime(
          "planned::2026-07-20",
          "planned",
          {
            source: "repeatPolicy",
            plannedForDate: LocalDateKeySchema.parse("2026-07-20"),
          } as Partial<TaskRuntimeEntity>
        ),
      },
    })

    const todo = buildHomePageVM(source).todayTasks.todo
    // planned (today) < due (07-22) < undated sorted by title.
    expect(todo.map((i) => i.taskId)).toEqual([
      "planned",
      "due",
      "apple",
      "zebra",
    ])
  })

  it("builds todayFocus with progress, focus flags, and dismissal awareness", () => {
    vi.setSystemTime(new Date("2026-07-20T09:00:00"))
    const doneGoalId = "goal-done" as GoalID
    const dismissedGoalId = "goal-dismissed" as GoalID
    const focus: GoalFocus = {
      id: goalId,
      isFocused: true,
      focusStatuses: [
        {
          kind: "goalDuePolicy",
          isBlocking: true,
          dueAt: new Date("2026-07-25T00:00:00"),
        },
      ],
    }
    const source = buildSource({
      goals: {
        [goalId]: goal,
        [doneGoalId]: { ...goal, id: doneGoalId, title: "Done goal" },
        [dismissedGoalId]: {
          ...goal,
          id: dismissedGoalId,
          title: "Dismissed goal",
        },
      },
      goalFocus: { [goalId]: focus },
      tasks: {
        ["a" as TaskID]: task("a", { total: 2, completedCount: 1 }),
        ["finished" as TaskID]: task("finished", {
          goalId: doneGoalId,
          completedCount: 1,
        }),
        ["gone" as TaskID]: task("gone", { goalId: dismissedGoalId }),
      },
      dismissedTaskIds: new Set(["gone" as TaskID]),
    })

    const vm = buildHomePageVM(source)

    // Finished goals never show up as focus candidates.
    expect(vm.todayFocus.map((f) => f.goal.id)).toEqual([
      goalId,
      dismissedGoalId,
    ])
    expect(vm.todayFocus[0]).toMatchObject({
      progressPercent: 50,
      isAdded: true,
      isForced: true,
      allTasksDismissed: false,
    })
    expect(vm.todayFocus[1]).toMatchObject({
      isAdded: false,
      allTasksDismissed: true,
    })
    expect(vm.focusQuota).toEqual({
      focusedCount: 1,
      forcedFocusedCount: 1,
      maxFocusGoals: 3,
    })
    expect(vm.pressureByDay).toBeDefined()
  })
})
