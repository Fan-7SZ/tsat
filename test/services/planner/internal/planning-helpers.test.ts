import { describe, expect, it } from "vitest"

import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import {
  areTaskAncestorsResolved,
  buildGoalDependencyMap,
  buildGoalTaskMap,
  compareGoals,
  compareTasks,
  computeGoalRemainingMinutes,
  computeUsedMinutes,
  getTaskPlanMinutes,
  isManualRuntime,
  isTaskFinished,
  selectGoalFrontierTasks,
  shouldPreserveRuntime,
} from "@/services/planner/internal/planning-helpers"

// ── builders ────────────────────────────────────────────────

const todayKey = "2026-05-13" as LocalDateKey

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

// ── isManualRuntime / shouldPreserveRuntime ─────────────────

describe("isManualRuntime", () => {
  it("is true only for source=manual", () => {
    expect(isManualRuntime(runtime("r", "t", { source: "manual" }))).toBe(true)
    expect(isManualRuntime(runtime("r", "t", { source: "default" }))).toBe(
      false
    )
  })
})

describe("shouldPreserveRuntime", () => {
  const plainTask = task("t")

  it("always preserves manual runtimes", () => {
    const rt = runtime("t", "t", { source: "manual" })
    expect(shouldPreserveRuntime(rt, plainTask, todayKey, "full")).toBe(true)
  })

  it("preserves any runtime already acted on (non-todo)", () => {
    const rt = runtime("t", "t", { arrangementStatus: "inProgress" })
    expect(shouldPreserveRuntime(rt, plainTask, todayKey, "full")).toBe(true)
    const done = runtime("t", "t", {
      arrangementStatus: "done",
      source: "triggerPolicy",
    })
    expect(shouldPreserveRuntime(done, plainTask, todayKey, "full")).toBe(true)
  })

  it("keeps past-date repeat debt rows but drops today's repeat rows", () => {
    const repeatTask = task("t", {
      repeat: { rule: { mode: "daily", interval: 1 } },
    })
    const debt = runtime("t::2026-05-10", "t", {
      source: "repeatPolicy",
      plannedForDate: "2026-05-10" as LocalDateKey,
    })
    const today = runtime(`t::${todayKey}`, "t", {
      source: "repeatPolicy",
      plannedForDate: todayKey,
    })
    expect(shouldPreserveRuntime(debt, repeatTask, todayKey)).toBe(true)
    expect(shouldPreserveRuntime(today, repeatTask, todayKey)).toBe(false)
  })

  it("drops repeat rows whose task no longer has a repeat config", () => {
    const debt = runtime("t::2026-05-10", "t", {
      source: "repeatPolicy",
      plannedForDate: "2026-05-10" as LocalDateKey,
    })
    expect(shouldPreserveRuntime(debt, plainTask, todayKey)).toBe(false)
    expect(shouldPreserveRuntime(debt, undefined, todayKey)).toBe(false)
  })

  it("always drops todo trigger runtimes (re-derived every replan)", () => {
    const rt = runtime("t", "t", { source: "triggerPolicy" })
    expect(shouldPreserveRuntime(rt, plainTask, todayKey, "full")).toBe(false)
    expect(shouldPreserveRuntime(rt, plainTask, todayKey, "partial")).toBe(
      false
    )
  })

  it("drops default todos on full replan but keeps them on partial/focus", () => {
    const rt = runtime("t", "t", { source: "default" })
    expect(shouldPreserveRuntime(rt, plainTask, todayKey, "full")).toBe(false)
    expect(shouldPreserveRuntime(rt, plainTask, todayKey, "partial")).toBe(true)
    expect(shouldPreserveRuntime(rt, plainTask, todayKey, "focus")).toBe(true)
    // scope defaults to "full"
    expect(shouldPreserveRuntime(rt, plainTask, todayKey)).toBe(false)
  })
})

// ── small pure helpers ──────────────────────────────────────

describe("getTaskPlanMinutes / isTaskFinished", () => {
  it("returns estimatedDuration or 0", () => {
    expect(getTaskPlanMinutes(task("t", { estimatedDuration: 30 }))).toBe(30)
    expect(getTaskPlanMinutes(task("t"))).toBe(0)
  })

  it("finished means completedCount >= total", () => {
    expect(isTaskFinished(task("t", { total: 2, completedCount: 2 }))).toBe(
      true
    )
    expect(isTaskFinished(task("t", { total: 2, completedCount: 1 }))).toBe(
      false
    )
  })
})

describe("compareTasks", () => {
  it("sorts by earliest due first; missing due sorts last", () => {
    const early = task("early", { dueAt: new Date("2026-05-14") })
    const late = task("late", { dueAt: new Date("2026-05-20") })
    const none = task("none")
    expect(compareTasks(early, late)).toBeLessThan(0)
    expect(compareTasks(late, early)).toBeGreaterThan(0)
    expect(compareTasks(early, none)).toBeLessThan(0)
    expect(compareTasks(none, early)).toBeGreaterThan(0)
  })

  it("breaks due ties by larger plan minutes first, then title", () => {
    const big = task("big", { estimatedDuration: 60 })
    const small = task("small", { estimatedDuration: 10 })
    expect(compareTasks(big, small)).toBeLessThan(0)
    expect(compareTasks(small, big)).toBeGreaterThan(0)

    const a = task("a", { estimatedDuration: 10 })
    const b = task("b", { estimatedDuration: 10 })
    expect(compareTasks(a, b)).toBeLessThan(0)
    expect(compareTasks(a, a)).toBe(0)
  })
})

// ── maps ────────────────────────────────────────────────────

describe("buildGoalTaskMap", () => {
  it("groups tasks by goalId and skips goal-less tasks", () => {
    const t1 = task("t1", { goalId: "g1" as GoalID })
    const t2 = task("t2", { goalId: "g1" as GoalID })
    const t3 = task("t3", { goalId: "g2" as GoalID })
    const orphan = task("orphan")
    const map = buildGoalTaskMap({
      [t1.id]: t1,
      [t2.id]: t2,
      [t3.id]: t3,
      [orphan.id]: orphan,
    })
    expect(map.get("g1" as GoalID)?.map((t) => t.id).sort()).toEqual([
      "t1",
      "t2",
    ])
    expect(map.get("g2" as GoalID)).toHaveLength(1)
    expect(map.size).toBe(2)
  })
})

describe("buildGoalDependencyMap", () => {
  it("keys dependencies by their owning goal", () => {
    const dep: DependencyEntity = {
      id: "dep-1",
      belongTo: "g1" as GoalID,
      tree: [],
    }
    const map = buildGoalDependencyMap({ [dep.id]: dep })
    expect(map.get("g1" as GoalID)).toBe(dep)
  })
})

// ── minute computations ─────────────────────────────────────

describe("computeUsedMinutes", () => {
  it("sums plan minutes over runtimes, skipping unknown tasks", () => {
    const t1 = task("t1", { estimatedDuration: 30 })
    const t2 = task("t2", { estimatedDuration: 45 })
    const tasks = { [t1.id]: t1, [t2.id]: t2 }
    const runtimes = {
      r1: runtime("r1", "t1"),
      r2: runtime("r2", "t2"),
      r3: runtime("r3", "ghost"),
    }
    expect(computeUsedMinutes(runtimes, tasks)).toBe(75)
  })
})

describe("computeGoalRemainingMinutes", () => {
  it("counts unfinished, unscheduled, non-repeat tasks only", () => {
    const gid = "g1" as GoalID
    const plain = task("plain", { goalId: gid, estimatedDuration: 30 })
    const repeat = task("repeat", {
      goalId: gid,
      estimatedDuration: 60,
      repeat: { rule: { mode: "daily", interval: 1 } },
    })
    const finished = task("done", {
      goalId: gid,
      estimatedDuration: 60,
      completedCount: 1,
    })
    const scheduled = task("scheduled", { goalId: gid, estimatedDuration: 20 })
    const goalTasks = new Map([[gid, [plain, repeat, finished, scheduled]]])
    const runtimes = { scheduled: runtime("scheduled", "scheduled") }
    expect(computeGoalRemainingMinutes(gid, goalTasks, runtimes)).toBe(30)
  })

  it("returns 0 for a goal with no tasks", () => {
    expect(computeGoalRemainingMinutes("gx" as GoalID, new Map(), {})).toBe(0)
  })
})

describe("compareGoals", () => {
  it("sorts by earliest due first; missing due sorts last", () => {
    const early = goal("early", { dueAt: new Date("2026-05-14") })
    const none = goal("none")
    expect(compareGoals(early, none, new Map(), {})).toBeLessThan(0)
    expect(compareGoals(none, early, new Map(), {})).toBeGreaterThan(0)
  })

  it("breaks due ties by more remaining work first, then title", () => {
    const g1 = goal("g1")
    const g2 = goal("g2")
    const goalTasks = new Map([
      [g1.id, [task("t1", { goalId: g1.id, estimatedDuration: 60 })]],
      [g2.id, [task("t2", { goalId: g2.id, estimatedDuration: 10 })]],
    ])
    expect(compareGoals(g1, g2, goalTasks, {})).toBeLessThan(0)
    expect(compareGoals(g2, g1, goalTasks, {})).toBeGreaterThan(0)
    // identical remaining → title order
    expect(compareGoals(g1, g2, new Map(), {})).toBeLessThan(0)
  })
})

// ── dependency frontier ─────────────────────────────────────

// A → B (A is B's ancestor)
const chainDep: DependencyEntity = {
  id: "dep-1",
  belongTo: "g1" as GoalID,
  tree: [
    { data: "a" as TaskID, title: "A", parent: null, children: [1] },
    { data: "b" as TaskID, title: "B", parent: [0], children: null },
  ],
}

describe("areTaskAncestorsResolved", () => {
  const taskA = task("a", { goalId: "g1" as GoalID })
  const taskB = task("b", { goalId: "g1" as GoalID })

  it("is resolved when there is no dependency tree", () => {
    expect(
      areTaskAncestorsResolved(taskB, { a: taskA, b: taskB }, undefined, new Set())
    ).toBe(true)
  })

  it("blocks on an unfinished, unscheduled ancestor", () => {
    expect(
      areTaskAncestorsResolved(taskB, { a: taskA, b: taskB }, chainDep, new Set())
    ).toBe(false)
  })

  it("resolves when the ancestor is finished", () => {
    const doneA = task("a", { goalId: "g1" as GoalID, completedCount: 1 })
    expect(
      areTaskAncestorsResolved(taskB, { a: doneA, b: taskB }, chainDep, new Set())
    ).toBe(true)
  })

  it("resolves when the ancestor is in the scheduled set", () => {
    expect(
      areTaskAncestorsResolved(
        taskB,
        { a: taskA, b: taskB },
        chainDep,
        new Set(["a" as TaskID])
      )
    ).toBe(true)
  })

  it("ignores ancestor nodes with no matching task entity", () => {
    // Ancestor "a" missing from tasks record — skipped, so B is resolved.
    expect(
      areTaskAncestorsResolved(taskB, { b: taskB }, chainDep, new Set())
    ).toBe(true)
  })
})

describe("selectGoalFrontierTasks", () => {
  const gid = "g1" as GoalID

  it("returns one top task per chain (no descend)", () => {
    const a = task("a", { goalId: gid })
    const b = task("b", { goalId: gid })
    const frontier = selectGoalFrontierTasks({
      goalTasks: [a, b],
      tasks: { a, b },
      dependency: chainDep,
      nextTaskRuntime: {},
      includeRuleTasks: true,
    })
    expect(frontier.map((t) => t.id)).toEqual(["a"])
  })

  it("descends to the child once the ancestor is finished", () => {
    const a = task("a", { goalId: gid, completedCount: 1 })
    const b = task("b", { goalId: gid })
    const frontier = selectGoalFrontierTasks({
      goalTasks: [a, b],
      tasks: { a, b },
      dependency: chainDep,
      nextTaskRuntime: {},
      includeRuleTasks: true,
    })
    expect(frontier.map((t) => t.id)).toEqual(["b"])
  })

  it("does not descend past a scheduled-but-unfinished ancestor", () => {
    const a = task("a", { goalId: gid })
    const b = task("b", { goalId: gid })
    // a already has a runtime, so it is excluded — but b stays blocked.
    const frontier = selectGoalFrontierTasks({
      goalTasks: [a, b],
      tasks: { a, b },
      dependency: chainDep,
      nextTaskRuntime: { a: runtime("a", "a") },
      includeRuleTasks: true,
    })
    expect(frontier).toEqual([])
  })

  it("drops repeat/trigger tasks when includeRuleTasks=false", () => {
    const repeatTask = task("r", {
      goalId: gid,
      repeat: { rule: { mode: "daily", interval: 1 } },
    })
    const triggerTask = task("tr", {
      goalId: gid,
      trigger: { rule: { mode: "daily", interval: 1 } },
    })
    const plain = task("p", { goalId: gid })
    const all = { r: repeatTask, tr: triggerTask, p: plain }
    const without = selectGoalFrontierTasks({
      goalTasks: [repeatTask, triggerTask, plain],
      tasks: all,
      dependency: undefined,
      nextTaskRuntime: {},
      includeRuleTasks: false,
    })
    expect(without.map((t) => t.id)).toEqual(["p"])

    const withRules = selectGoalFrontierTasks({
      goalTasks: [repeatTask, triggerTask, plain],
      tasks: all,
      dependency: undefined,
      nextTaskRuntime: {},
      includeRuleTasks: true,
    })
    expect(withRules.map((t) => t.id).sort()).toEqual(["p", "r", "tr"])
  })

  it("excludes finished tasks", () => {
    const done = task("d", { goalId: gid, completedCount: 1 })
    const frontier = selectGoalFrontierTasks({
      goalTasks: [done],
      tasks: { d: done },
      dependency: undefined,
      nextTaskRuntime: {},
      includeRuleTasks: true,
    })
    expect(frontier).toEqual([])
  })
})
