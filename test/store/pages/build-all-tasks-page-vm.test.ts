import { describe, expect, it } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import { buildAllTasksPageVM } from "@/store/pages/build-all-tasks-page-vm"

const goalId = "goal-1" as GoalID

const goal: GoalEntity = {
  id: goalId,
  title: "Goal One",
  createdAt: new Date("2026-05-01T09:00:00"),
}

function task(
  id: string,
  overrides: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id: id as TaskID,
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
  status: TaskRuntimeEntity["arrangementStatus"]
): TaskRuntimeEntity {
  return {
    id: id as TaskRuntimeID,
    taskId: taskId as TaskID,
    arrangementStatus: status,
    source: "manual",
  }
}

describe("buildAllTasksPageVM", () => {
  it("maps task fields onto rows", () => {
    const dueAt = new Date("2026-05-20T18:00:00")
    const vm = buildAllTasksPageVM({
      goals: { [goalId]: goal },
      tasks: {
        ["t1" as TaskID]: task("t1", {
          goalId,
          dueAt,
          estimatedDuration: 30,
          steps: [
            { id: "s1", title: "one" },
            { id: "s2", title: "two" },
          ] as TaskGroupEntity["steps"],
          total: 3,
          completedCount: 1,
        }),
      },
      taskRuntime: {},
    })

    expect(vm.rows).toHaveLength(1)
    expect(vm.rows[0]).toMatchObject({
      taskId: "t1",
      title: "Task t1",
      goalId,
      goalTitle: "Goal One",
      inRuntime: false,
      runtimeStatus: null,
      dueAt,
      estimatedDuration: 30,
      stepsCount: 2,
      completedCount: 1,
      totalCount: 3,
    })
    expect(vm.rows[0]!.dueAtLabel).toBeTruthy()
  })

  it("handles goal-less tasks and unknown goal ids", () => {
    const vm = buildAllTasksPageVM({
      goals: {},
      tasks: {
        ["free" as TaskID]: task("free"),
        ["orphan" as TaskID]: task("orphan", {
          goalId: "missing" as GoalID,
        }),
      },
      taskRuntime: {},
    })

    const free = vm.rows.find((r) => r.taskId === "free")!
    const orphan = vm.rows.find((r) => r.taskId === "orphan")!
    expect(free.goalId).toBeUndefined()
    expect(free.goalTitle).toBeUndefined()
    expect(free.dueAtLabel).toBeUndefined()
    expect(orphan.goalId).toBe("missing")
    expect(orphan.goalTitle).toBeUndefined()
  })

  it("aggregates runtime status across a task's runs", () => {
    const vm = buildAllTasksPageVM({
      goals: {},
      tasks: {
        ["mixed" as TaskID]: task("mixed"),
        ["working" as TaskID]: task("working"),
        ["finished" as TaskID]: task("finished"),
      },
      taskRuntime: {
        ["r1" as TaskRuntimeID]: runtime("r1", "mixed", "done"),
        ["r2" as TaskRuntimeID]: runtime("r2", "mixed", "todo"),
        ["r3" as TaskRuntimeID]: runtime("r3", "working", "inProgress"),
        ["r4" as TaskRuntimeID]: runtime("r4", "finished", "done"),
      },
    })

    const byId = Object.fromEntries(vm.rows.map((r) => [r.taskId, r]))
    expect(byId["mixed"]).toMatchObject({
      inRuntime: true,
      runtimeStatus: "todo",
    })
    expect(byId["working"]!.runtimeStatus).toBe("inProgress")
    expect(byId["finished"]!.runtimeStatus).toBe("done")
  })

  it("sorts rows by dueAt ascending with undated tasks last", () => {
    const vm = buildAllTasksPageVM({
      goals: {},
      tasks: {
        ["none" as TaskID]: task("none"),
        ["late" as TaskID]: task("late", {
          dueAt: new Date("2026-06-01T00:00:00"),
        }),
        ["soon" as TaskID]: task("soon", {
          dueAt: new Date("2026-05-10T00:00:00"),
        }),
      },
      taskRuntime: {},
    })

    expect(vm.rows.map((r) => r.taskId)).toEqual(["soon", "late", "none"])
  })

  it("collects unique goal options from the rows", () => {
    const goal2Id = "goal-2" as GoalID
    const vm = buildAllTasksPageVM({
      goals: {
        [goalId]: goal,
        [goal2Id]: { ...goal, id: goal2Id, title: "Goal Two" },
      },
      tasks: {
        ["a" as TaskID]: task("a", { goalId }),
        ["b" as TaskID]: task("b", { goalId }),
        ["c" as TaskID]: task("c", { goalId: goal2Id }),
        ["d" as TaskID]: task("d"),
      },
      taskRuntime: {},
    })

    expect(vm.goalOptions).toEqual(
      expect.arrayContaining([
        { value: goalId, label: "Goal One" },
        { value: goal2Id, label: "Goal Two" },
      ])
    )
    expect(vm.goalOptions).toHaveLength(2)
  })
})
