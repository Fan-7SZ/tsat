import { afterEach, describe, expect, it, vi } from "vitest"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import { zh } from "@/i18n/zh"
import { buildTasksPageVM } from "@/store/pages/build-tasks-page-vm"
import type { PlannerPolicy } from "@/services/planner/types"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"
import { createTaskRuntimeId } from "@/utils/task-runtime"

const taskId = "task-1" as TaskID
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
  createdAt: new Date("2026-05-11T09:00:00"),
  dueAt: new Date("2026-05-20T00:00:00"),
}

function createTask(): TaskGroupEntity {
  return {
    id: taskId,
    goalId,
    title: "Daily repeat task",
    createdAt: new Date("2026-05-11T09:00:00"),
    repeat: {
      rule: { mode: "daily", interval: 1 },
      startsAt: new Date("2026-05-11T00:00:00"),
      endsAt: new Date("2026-05-20T00:00:00"),
    },
    total: 10,
    completedCount: 1,
  }
}

function createPlainTask(
  id: string,
  overrides: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id: id as TaskID,
    goalId,
    title: id,
    createdAt: new Date("2026-05-11T09:00:00"),
    total: 1,
    completedCount: 0,
    ...overrides,
  }
}

function buildVM(
  tasks: TaskGroupEntity[],
  goals: Record<GoalID, GoalEntity> = { [goalId]: goal }
) {
  return buildTasksPageVM({
    goals,
    tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
    taskRuntime: {},
    repeatLedger: {},
    runStartDates: {},
    dismissedTaskIds: new Set(),
    policy,
    t: zh,
  })
}

describe("buildTasksPageVM", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("emits future planned points one per dateKey", () => {
    vi.setSystemTime(new Date("2026-05-12T09:00:00"))
    const task = createTask()
    const ledger: RepeatLedgerEntity = {
      taskId,
      points: {
        [LocalDateKeySchema.parse("2026-05-11")]: "completed",
        [LocalDateKeySchema.parse("2026-05-12")]: "planned",
        [LocalDateKeySchema.parse("2026-05-13")]: "planned",
      },
    }

    const vm = buildTasksPageVM({
      goals: { [goalId]: goal },
      tasks: { [taskId]: task },
      taskRuntime: {},
      repeatLedger: { [taskId]: ledger },
      runStartDates: {},
      dismissedTaskIds: new Set(),
      policy,
      t: zh,
    })

    expect(vm.plans.tomorrow).toHaveLength(1)
    expect(vm.plans.tomorrow[0]).toMatchObject({
      taskId,
      plannedForDate: "2026-05-13",
      runtimeId: "task-1::2026-05-13",
    })
  })

  it("drops a future planned point once it has been added to today", () => {
    vi.setSystemTime(new Date("2026-05-12T09:00:00"))
    const task = createTask()
    const ledger: RepeatLedgerEntity = {
      taskId,
      points: {
        [LocalDateKeySchema.parse("2026-05-13")]: "planned",
      },
    }
    const dateKey = LocalDateKeySchema.parse("2026-05-13")
    const runtimeId = createTaskRuntimeId(taskId, "repeatPolicy", dateKey)

    const vm = buildTasksPageVM({
      goals: { [goalId]: goal },
      tasks: { [taskId]: task },
      taskRuntime: {
        [runtimeId]: {
          id: runtimeId,
          taskId,
          arrangementStatus: "todo",
          source: "repeatPolicy",
          plannedForDate: dateKey,
        },
      },
      repeatLedger: { [taskId]: ledger },
      runStartDates: {},
      dismissedTaskIds: new Set(),
      policy,
      t: zh,
    })

    // The 05-13 point is now a today runtime; it must not also show in plans.
    expect(vm.plans.tomorrow).toHaveLength(0)
    expect(
      vm.today.todo.some((item) => item.plannedForDate === "2026-05-13")
    ).toBe(true)
  })

  it("excludes finished tasks from unselected and the plans buckets", () => {
    vi.setSystemTime(new Date("2026-05-12T09:00:00"))
    const finishedNoDue = createPlainTask("finished-no-due", {
      completedCount: 1,
    })
    const finishedDueTomorrow = createPlainTask("finished-due-tomorrow", {
      completedCount: 1,
      dueAt: new Date("2026-05-13T18:00:00"),
    })
    const openNoDue = createPlainTask("open-no-due")

    const vm = buildVM([finishedNoDue, finishedDueTomorrow, openNoDue])

    expect(vm.unselected.map((i) => i.taskId)).toEqual(["open-no-due"])
    expect(vm.plans.tomorrow).toHaveLength(0)
    expect(vm.plans.in7Days).toHaveLength(0)
  })

  it("excludes trigger-scheduled tasks from unselected (own and goal trigger)", () => {
    vi.setSystemTime(new Date("2026-05-12T09:00:00"))
    const ownTrigger = createPlainTask("own-trigger", {
      goalId: undefined,
      trigger: { rule: { mode: "daily", interval: 1 } },
    })
    const triggerGoalId = "goal-trigger" as GoalID
    const underTriggerGoal = createPlainTask("under-trigger-goal", {
      goalId: triggerGoalId,
    })
    const plain = createPlainTask("plain")

    const vm = buildVM([ownTrigger, underTriggerGoal, plain], {
      [goalId]: goal,
      [triggerGoalId]: {
        id: triggerGoalId,
        title: "Trigger goal",
        createdAt: new Date("2026-05-11T09:00:00"),
        trigger: { rule: { mode: "daily", interval: 1 } },
      },
    })

    expect(vm.unselected.map((i) => i.taskId)).toEqual(["plain"])
  })

  it("keeps unselected free of tasks already shown in plans (due within 7 days)", () => {
    vi.setSystemTime(new Date("2026-05-12T09:00:00"))
    const dueTomorrow = createPlainTask("due-tomorrow", {
      dueAt: new Date("2026-05-13T18:00:00"),
    })
    const dueIn5Days = createPlainTask("due-in-5-days", {
      dueAt: new Date("2026-05-17T18:00:00"),
    })
    const dueFar = createPlainTask("due-far", {
      dueAt: new Date("2026-05-25T18:00:00"),
    })

    const vm = buildVM([dueTomorrow, dueIn5Days, dueFar])

    expect(vm.plans.tomorrow.map((i) => i.taskId)).toEqual(["due-tomorrow"])
    expect(vm.plans.in7Days.map((i) => i.taskId)).toEqual(["due-in-5-days"])
    // Beyond the plans window the task must stay visible somewhere → unselected.
    expect(vm.unselected.map((i) => i.taskId)).toEqual(["due-far"])
  })

  it("drops future planned points of a finished repeat task", () => {
    vi.setSystemTime(new Date("2026-05-12T09:00:00"))
    const task = { ...createTask(), total: 1, completedCount: 1 }
    const ledger: RepeatLedgerEntity = {
      taskId,
      points: {
        [LocalDateKeySchema.parse("2026-05-11")]: "completed",
        [LocalDateKeySchema.parse("2026-05-13")]: "planned",
      },
    }

    const vm = buildTasksPageVM({
      goals: { [goalId]: goal },
      tasks: { [taskId]: task },
      taskRuntime: {},
      repeatLedger: { [taskId]: ledger },
      runStartDates: {},
      dismissedTaskIds: new Set(),
      policy,
      t: zh,
    })

    // The planner would not import this task's points (isTaskFinished guard),
    // so the plans tab must not advertise them either.
    expect(vm.plans.tomorrow).toHaveLength(0)
  })
})
