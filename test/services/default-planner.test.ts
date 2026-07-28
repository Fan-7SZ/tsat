import { describe, expect, it } from "vitest"

import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import { DefaultPlannerService } from "@/services/planner/default-planner"
import type { PlannerInput } from "@/services/planner/types"

const goalId = "goal-1" as GoalID
const taskAId = "task-a" as TaskID
const taskBId = "task-b" as TaskID

const now = new Date("2026-05-13T10:00:00")
const todayKey = LocalDateKeySchema.parse("2026-05-13")

const goal: GoalEntity = {
  id: goalId,
  title: "Goal",
  createdAt: new Date("2026-05-01T09:00:00"),
}

// A → B (A is B's predecessor)
const dependency: DependencyEntity = {
  id: "dep-1",
  belongTo: goalId,
  tree: [
    { data: taskAId, title: "Task A", parent: null, children: [1] },
    { data: taskBId, title: "Task B", parent: [0], children: null },
  ],
}

function createTriggerInput(ancestorCompletedCount: number): PlannerInput {
  const taskA: TaskGroupEntity = {
    id: taskAId,
    goalId,
    title: "Task A",
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: ancestorCompletedCount,
  }

  const taskB: TaskGroupEntity = {
    id: taskBId,
    goalId,
    title: "Task B",
    createdAt: new Date("2026-05-01T09:00:00"),
    trigger: { rule: { mode: "daily", interval: 1 } },
    total: 1,
    completedCount: 0,
  }

  return {
    snapshot: {
      goals: { [goalId]: goal },
      tasks: { [taskAId]: taskA, [taskBId]: taskB },
      deps: { [dependency.id]: dependency },
      goalTriggerStates: {},
      taskTriggerStates: {
        [taskBId]: { taskId: taskBId, lastTriggeredDateKey: todayKey },
      },
      repeatLedgers: {},
      manualFocuses: {},
      dismissedTasks: {},
    },
    currentTaskRuntime: {},
    policy: {
      dailyCapacityMinutes: 480,
      taskForcedTodoDays: 0,
      goalForcedFocusDays: 0,
      maxFocusGoals: 3,
    },
    now,
  }
}

describe("DefaultPlannerService trigger guard", () => {
  it("does not pull a fired trigger task while its ancestor is unfinished", () => {
    const planner = new DefaultPlannerService()
    const output = planner.replan(createTriggerInput(0), "partial")

    const triggerRuntimes = Object.values(output.taskRuntime).filter(
      (runtime) => runtime.taskId === taskBId
    )
    expect(triggerRuntimes).toEqual([])
  })

  it("pulls the fired trigger task once its ancestor is finished", () => {
    const planner = new DefaultPlannerService()
    const output = planner.replan(createTriggerInput(1), "partial")

    const triggerRuntimes = Object.values(output.taskRuntime).filter(
      (runtime) => runtime.taskId === taskBId
    )
    expect(triggerRuntimes).toHaveLength(1)
    expect(triggerRuntimes[0]).toMatchObject({
      source: "triggerPolicy",
      arrangementStatus: "todo",
    })
  })

  // "Remove from today" on a trigger runtime records a day-scoped dismissal;
  // without this guard the very next (partial) replan re-derived the runtime
  // from the fired trigger state and the removal bounced straight back.
  it("does not re-derive a fired trigger task the user dismissed today", () => {
    const planner = new DefaultPlannerService()
    const input = createTriggerInput(1)
    input.snapshot.dismissedTasks = {
      [taskBId]: { taskId: taskBId, dateKey: todayKey },
    }
    const output = planner.replan(input, "partial")

    const triggerRuntimes = Object.values(output.taskRuntime).filter(
      (runtime) => runtime.taskId === taskBId
    )
    expect(triggerRuntimes).toEqual([])
  })
})

describe("DefaultPlannerService un-focus with in-progress auto run", () => {
  // Un-focus deletes the goal's default TODO rows; the inProgress one must
  // survive — but it is NOT auto-focus evidence, so the focus replan that
  // follows must not re-fill the goal (which would resurrect the focus).
  it("does not re-fill a goal whose only default run is inProgress", () => {
    const planner = new DefaultPlannerService()
    const t1 = "task-a" as TaskID
    const t2 = "task-b" as TaskID
    const mkTask = (id: TaskID): TaskGroupEntity => ({
      id,
      goalId,
      title: id,
      createdAt: new Date("2026-05-01T09:00:00"),
      total: 1,
      completedCount: 0,
    })
    const input: PlannerInput = {
      snapshot: {
        goals: { [goalId]: goal },
        tasks: { [t1]: mkTask(t1), [t2]: mkTask(t2) },
        deps: {},
        goalTriggerStates: {},
        taskTriggerStates: {},
        repeatLedgers: {},
        manualFocuses: {}, // manual focus already deleted by the un-focus
        dismissedTasks: {},
      },
      currentTaskRuntime: {
        // The surviving in-progress auto run (todo siblings already deleted).
        [t1 as string]: {
          id: t1 as unknown as import("@/domain/value-objects/types").TaskRuntimeID,
          taskId: t1,
          arrangementStatus: "inProgress",
          source: "default",
        },
      },
      policy: {
        dailyCapacityMinutes: 480,
        taskForcedTodoDays: 0,
        goalForcedFocusDays: 0,
        maxFocusGoals: 3,
      },
      now,
    }

    const output = planner.replan(input, "focus")

    const defaultTodoRows = Object.values(output.taskRuntime).filter(
      (runtime) =>
        runtime.source === "default" && runtime.arrangementStatus === "todo"
    )
    expect(defaultTodoRows).toEqual([])
    // The in-progress run itself is preserved untouched.
    expect(output.taskRuntime[t1 as string]).toMatchObject({
      arrangementStatus: "inProgress",
      source: "default",
    })
  })
})

describe("DefaultPlannerService stale repeat debt rows", () => {
  // A rule edit can prune the planned ledger point behind a preserved debt
  // row (mergeLedgerWithRule trims planned points); an unbacked row must not
  // survive the next replan.
  it("drops a preserved debt row whose ledger point is gone", () => {
    const planner = new DefaultPlannerService()
    const input = createRepeatInput(0)
    const debtKey = LocalDateKeySchema.parse("2026-05-10")
    input.currentTaskRuntime = {
      [`${taskAId}::${debtKey}`]: {
        id: `${taskAId}::${debtKey}` as import("@/domain/value-objects/types").TaskRuntimeID,
        taskId: taskAId,
        arrangementStatus: "todo",
        source: "repeatPolicy",
        plannedForDate: debtKey,
      },
    }
    // The ledger only has today's point — the debt point was pruned.
    const output = planner.replan(input, "partial")

    const debtRows = Object.values(output.taskRuntime).filter(
      (runtime) =>
        runtime.taskId === taskAId &&
        runtime.source === "repeatPolicy" &&
        runtime.plannedForDate === debtKey
    )
    expect(debtRows).toEqual([])
  })

  it("keeps a debt row still backed by a planned ledger point", () => {
    const planner = new DefaultPlannerService()
    const input = createRepeatInput(0)
    const debtKey = LocalDateKeySchema.parse("2026-05-10")
    input.snapshot.repeatLedgers[taskAId]!.points[debtKey] = "planned"
    input.currentTaskRuntime = {
      [`${taskAId}::${debtKey}`]: {
        id: `${taskAId}::${debtKey}` as import("@/domain/value-objects/types").TaskRuntimeID,
        taskId: taskAId,
        arrangementStatus: "todo",
        source: "repeatPolicy",
        plannedForDate: debtKey,
      },
    }
    const output = planner.replan(input, "partial")

    const debtRows = Object.values(output.taskRuntime).filter(
      (runtime) =>
        runtime.taskId === taskAId &&
        runtime.source === "repeatPolicy" &&
        runtime.plannedForDate === debtKey
    )
    expect(debtRows).toHaveLength(1)
  })
})

describe("DefaultPlannerService stale due-policy rows", () => {
  // The row's `duePolicy` stamp is only as good as its reason: editing the due
  // out of the forced window must release the row (it was locked in the UI),
  // not preserve it forever on partial replans.
  it("drops a preserved duePolicy todo row once the due leaves the window", () => {
    const planner = new DefaultPlannerService()
    const farDueTask: TaskGroupEntity = {
      id: taskAId,
      goalId,
      title: "Task A",
      createdAt: new Date("2026-05-01T09:00:00"),
      total: 1,
      completedCount: 0,
      dueAt: new Date("2026-05-20T23:59:59"), // 7 days out, window is 0 days
    }
    const input: PlannerInput = {
      snapshot: {
        goals: { [goalId]: goal },
        tasks: { [taskAId]: farDueTask },
        deps: {},
        goalTriggerStates: {},
        taskTriggerStates: {},
        repeatLedgers: {},
        manualFocuses: {},
        dismissedTasks: {},
      },
      currentTaskRuntime: {
        [taskAId as string]: {
          id: taskAId as unknown as import("@/domain/value-objects/types").TaskRuntimeID,
          taskId: taskAId,
          arrangementStatus: "todo",
          source: "duePolicy",
        },
      },
      policy: {
        dailyCapacityMinutes: 480,
        taskForcedTodoDays: 0,
        goalForcedFocusDays: 0,
        maxFocusGoals: 3,
      },
      now,
    }

    const output = planner.replan(input, "partial")
    const rows = Object.values(output.taskRuntime).filter(
      (runtime) => runtime.taskId === taskAId
    )
    expect(rows).toEqual([])
  })
})

function createRepeatInput(completedCount: number): PlannerInput {
  const repeatTask: TaskGroupEntity = {
    id: taskAId,
    goalId,
    title: "Repeat task",
    createdAt: new Date("2026-05-01T09:00:00"),
    repeat: { rule: { mode: "daily", interval: 1 } },
    total: 3,
    completedCount,
  }

  return {
    snapshot: {
      goals: { [goalId]: goal },
      tasks: { [taskAId]: repeatTask },
      deps: {},
      goalTriggerStates: {},
      taskTriggerStates: {},
      repeatLedgers: {
        [taskAId]: {
          taskId: taskAId,
          points: { [todayKey]: "planned" },
        },
      },
      manualFocuses: {},
      dismissedTasks: {},
    },
    currentTaskRuntime: {},
    policy: {
      dailyCapacityMinutes: 480,
      taskForcedTodoDays: 0,
      goalForcedFocusDays: 0,
      maxFocusGoals: 3,
    },
    now,
  }
}

// ── fill-layer scenarios (steps 3 / 3b / 5) ─────────────────

type Snapshot = PlannerInput["snapshot"]

function emptySnapshot(): Snapshot {
  return {
    goals: {},
    tasks: {},
    deps: {},
    goalTriggerStates: {},
    taskTriggerStates: {},
    repeatLedgers: {},
    manualFocuses: {},
    dismissedTasks: {},
  }
}

function makeInput(
  snapshot: Snapshot,
  policyOverrides: Partial<PlannerInput["policy"]> = {}
): PlannerInput {
  return {
    snapshot,
    currentTaskRuntime: {},
    policy: {
      dailyCapacityMinutes: 480,
      taskForcedTodoDays: 0,
      goalForcedFocusDays: 0,
      maxFocusGoals: 3,
      ...policyOverrides,
    },
    now,
  }
}

function makeTask(
  id: string,
  gid: string,
  overrides: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id: id as TaskID,
    goalId: gid as GoalID,
    title: id,
    createdAt: new Date("2026-05-01T09:00:00"),
    total: 1,
    completedCount: 0,
    ...overrides,
  }
}

function makeGoal(id: string, overrides: Partial<GoalEntity> = {}): GoalEntity {
  return {
    id: id as GoalID,
    title: id,
    createdAt: new Date("2026-05-01T09:00:00"),
    ...overrides,
  }
}

describe("DefaultPlannerService due-policy forcing (step 3)", () => {
  it("creates a duePolicy runtime for a plain task due within the window", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    snapshot.goals[goalId] = goal
    snapshot.tasks[taskAId] = makeTask(taskAId, goalId, {
      dueAt: new Date("2026-05-13T22:00:00"),
    })
    const output = planner.replan(makeInput(snapshot), "partial")

    expect(output.taskRuntime[taskAId as string]).toMatchObject({
      taskId: taskAId,
      source: "duePolicy",
      arrangementStatus: "todo",
    })
  })

  it("keys a counter task's forced run by date-scoped run id", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    snapshot.goals[goalId] = goal
    snapshot.tasks[taskAId] = makeTask(taskAId, goalId, {
      total: 3,
      dueAt: new Date("2026-05-13T22:00:00"),
    })
    const output = planner.replan(makeInput(snapshot), "partial")

    const ids = Object.keys(output.taskRuntime)
    expect(ids).toEqual([`${taskAId}::run::${todayKey}::1`])
  })
})

describe("DefaultPlannerService goal due-policy (step 3b)", () => {
  it("pulls only the chain-top task of a due goal", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    snapshot.goals[goalId] = makeGoal(goalId, {
      dueAt: new Date("2026-05-13T22:00:00"),
    })
    snapshot.tasks[taskAId] = makeTask(taskAId, goalId)
    snapshot.tasks[taskBId] = makeTask(taskBId, goalId)
    snapshot.deps[dependency.id] = dependency

    const output = planner.replan(makeInput(snapshot), "partial")

    expect(output.taskRuntime[taskAId as string]).toMatchObject({
      taskId: taskAId,
      source: "goalDuePolicy",
    })
    expect(
      Object.values(output.taskRuntime).filter((r) => r.taskId === taskBId)
    ).toEqual([])
  })

  it("ignores an empty due goal", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    snapshot.goals[goalId] = makeGoal(goalId, {
      dueAt: new Date("2026-05-13T22:00:00"),
    })
    const output = planner.replan(makeInput(snapshot), "partial")
    expect(output.taskRuntime).toEqual({})
  })
})

describe("DefaultPlannerService free fill layer (step 5)", () => {
  it("auto-fills chain-top tasks of new goals on full replan", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    snapshot.goals[goalId] = goal
    snapshot.tasks[taskAId] = makeTask(taskAId, goalId)
    snapshot.tasks[taskBId] = makeTask(taskBId, goalId)
    snapshot.deps[dependency.id] = dependency

    const output = planner.replan(makeInput(snapshot), "full")

    expect(output.taskRuntime[taskAId as string]).toMatchObject({
      taskId: taskAId,
      source: "default",
      arrangementStatus: "todo",
    })
    // B is blocked behind A, so it is not filled.
    expect(
      Object.values(output.taskRuntime).filter((r) => r.taskId === taskBId)
    ).toEqual([])
  })

  it("caps the number of auto-topped-up goals at maxFocusGoals", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    for (const n of [1, 2, 3]) {
      const gid = `goal-${n}`
      snapshot.goals[gid] = makeGoal(gid)
      snapshot.tasks[`task-${n}`] = makeTask(`task-${n}`, gid)
    }
    const output = planner.replan(
      makeInput(snapshot, { maxFocusGoals: 2 }),
      "full"
    )

    expect(Object.keys(output.taskRuntime)).toHaveLength(2)
  })

  it("tops up the most-complete goal first", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    // goal-a is half done (1/2), goal-b untouched (0/2).
    snapshot.goals["goal-a"] = makeGoal("goal-a")
    snapshot.tasks["task-a1"] = makeTask("task-a1", "goal-a", {
      completedCount: 1,
    })
    snapshot.tasks["task-a2"] = makeTask("task-a2", "goal-a")
    snapshot.goals["goal-b"] = makeGoal("goal-b")
    snapshot.tasks["task-b1"] = makeTask("task-b1", "goal-b")
    snapshot.tasks["task-b2"] = makeTask("task-b2", "goal-b")

    const output = planner.replan(
      makeInput(snapshot, { maxFocusGoals: 1 }),
      "full"
    )

    expect(Object.values(output.taskRuntime).map((r) => r.taskId)).toEqual([
      "task-a2",
    ])
  })

  it("respects the daily capacity when filling", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    for (const n of [1, 2]) {
      const gid = `goal-${n}`
      snapshot.goals[gid] = makeGoal(gid)
      snapshot.tasks[`task-${n}`] = makeTask(`task-${n}`, gid, {
        estimatedDuration: 40,
      })
    }
    const output = planner.replan(
      makeInput(snapshot, { dailyCapacityMinutes: 60 }),
      "full"
    )

    // Only one 40-minute task fits in the 60-minute budget.
    expect(Object.keys(output.taskRuntime)).toHaveLength(1)
  })

  it("fills a manually focused goal on a focus replan", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    snapshot.goals[goalId] = goal
    snapshot.tasks[taskAId] = makeTask(taskAId, goalId)
    snapshot.manualFocuses[goalId] = { goalId, dateKey: todayKey }

    const output = planner.replan(makeInput(snapshot), "focus")

    expect(output.taskRuntime[taskAId as string]).toMatchObject({
      taskId: taskAId,
      source: "default",
    })
  })

  it("does not fill on a focus replan without any focus evidence", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    snapshot.goals[goalId] = goal
    snapshot.tasks[taskAId] = makeTask(taskAId, goalId)

    const output = planner.replan(makeInput(snapshot), "focus")
    expect(output.taskRuntime).toEqual({})
  })

  it("skips a task the user dismissed today", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    snapshot.goals[goalId] = goal
    snapshot.tasks[taskAId] = makeTask(taskAId, goalId)
    snapshot.dismissedTasks[taskAId] = { taskId: taskAId, dateKey: todayKey }

    const output = planner.replan(makeInput(snapshot), "full")
    expect(output.taskRuntime).toEqual({})
  })

  it("skips trigger goals and done goals in the auto top-up", () => {
    const planner = new DefaultPlannerService()
    const snapshot = emptySnapshot()
    snapshot.goals["goal-t"] = makeGoal("goal-t", {
      trigger: { rule: { mode: "daily", interval: 1 } },
    })
    snapshot.tasks["task-t"] = makeTask("task-t", "goal-t")
    snapshot.goals["goal-done"] = makeGoal("goal-done")
    snapshot.tasks["task-done"] = makeTask("task-done", "goal-done", {
      completedCount: 1,
    })

    const output = planner.replan(makeInput(snapshot), "full")
    expect(output.taskRuntime).toEqual({})
  })
})

describe("DefaultPlannerService repeat finished guard", () => {
  it("does not pull a finished repeat task even with an active ledger point", () => {
    const planner = new DefaultPlannerService()
    const output = planner.replan(createRepeatInput(3), "partial")

    const repeatRuntimes = Object.values(output.taskRuntime).filter(
      (runtime) => runtime.taskId === taskAId
    )
    expect(repeatRuntimes).toEqual([])
  })

  it("pulls an unfinished repeat task from its ledger", () => {
    const planner = new DefaultPlannerService()
    const output = planner.replan(createRepeatInput(0), "partial")

    const repeatRuntimes = Object.values(output.taskRuntime).filter(
      (runtime) => runtime.taskId === taskAId
    )
    expect(repeatRuntimes).toHaveLength(1)
    expect(repeatRuntimes[0]).toMatchObject({
      source: "repeatPolicy",
      arrangementStatus: "todo",
    })
  })
})

describe("DefaultPlannerService focus-set membership (step 4)", () => {
  function makeMembershipInput(
    runtime: PlannerInput["currentTaskRuntime"]
  ): PlannerInput {
    const task: TaskGroupEntity = {
      id: taskAId,
      goalId,
      title: "Task A",
      createdAt: new Date("2026-05-01T09:00:00"),
      total: 1,
      completedCount: 0,
    }
    return {
      snapshot: {
        goals: { [goalId]: goal },
        tasks: { [taskAId]: task },
        deps: {},
        goalTriggerStates: {},
        taskTriggerStates: {},
        repeatLedgers: {},
        manualFocuses: {},
        dismissedTasks: {},
      },
      currentTaskRuntime: runtime,
      policy: {
        dailyCapacityMinutes: 480,
        taskForcedTodoDays: 0,
        goalForcedFocusDays: 0,
        maxFocusGoals: 3,
      },
      now,
    }
  }

  it("a default todo run is its own focus evidence and survives a focus replan", () => {
    const planner = new DefaultPlannerService()
    const output = planner.replan(
      makeMembershipInput({
        [taskAId]: {
          id: taskAId,
          taskId: taskAId,
          arrangementStatus: "todo",
          source: "default",
        },
      }),
      "focus"
    )

    expect(output.taskRuntime[taskAId]).toMatchObject({ source: "default" })
  })

  it("focus replan drops an orphaned default todo whose task is gone", () => {
    const orphanId = "task-gone" as TaskID
    const planner = new DefaultPlannerService()
    const output = planner.replan(
      makeMembershipInput({
        [orphanId]: {
          id: orphanId,
          taskId: orphanId,
          arrangementStatus: "todo",
          source: "default",
        },
      }),
      "focus"
    )

    expect(output.taskRuntime[orphanId]).toBeUndefined()
  })
})
