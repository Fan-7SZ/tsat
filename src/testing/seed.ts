/**
 * Auto-test seed injector.
 *
 * Drives the REAL command layer (createGoal / createTask / createDependency /
 * saveTaskTrigger / createGoalWithTrigger) so ledgers, dependency trees and
 * trigger states are built by exactly the same code paths the UI uses — no
 * hand-rolled Dexie rows that could drift from production invariants.
 *
 * All `new Date()` here resolves against the mocked clock (Playwright installs
 * page.clock before the page loads), so repeat windows / debt materialize
 * relative to the simulated start day.
 */
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type {
  TaskGroupEntity,
  TaskRepeatConfig,
  TaskTriggerConfig,
} from "@/domain/entities/TaskGroupEntity"
import type { GoalTriggerConfig } from "@/domain/entities/GoalEntity"
import type {
  DependencyEntity,
  DependencyEntityNode,
} from "@/domain/entities/DependencyEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"

import { createGoal } from "@/commands/goal.commands"
import { createTask } from "@/commands/task.commands"
import { createGoalWithTrigger } from "@/commands/trigger.commands"
import { saveTaskTrigger } from "@/commands/task-trigger.commands"
import { createDependency } from "@/commands/dependency.commands"
import * as repo from "@/persistence/repository"

// ── Scenario description (declarative) ─────────────────────

/** A task node plus which sibling (by local key) it depends on, if any. */
export interface SeedTaskSpec {
  /** Local handle used to reference this task within its goal (edges, asserts). */
  key: string
  title: string
  total?: number
  steps?: string[]
  allowCrossDay?: boolean
  /** Days from the start day for the task's own due (optional). */
  dueInDays?: number
  repeat?: TaskRepeatConfig
  trigger?: TaskTriggerConfig
  /** Local keys of tasks this one depends on (must precede it in the list). */
  dependsOn?: string[]
}

export interface SeedGoalSpec {
  key: string
  title: string
  /** Days from the start day for the goal's soft due (optional). */
  dueInDays?: number
  trigger?: GoalTriggerConfig
  tasks: SeedTaskSpec[]
}

export interface SeedScenario {
  goals: SeedGoalSpec[]
}

/** Stable handle → generated id, so the test can address seeded entities. */
export interface SeedHandles {
  goals: Record<string, GoalID>
  tasks: Record<string, TaskID>
}

// ── Helpers ────────────────────────────────────────────────

function daysFromStart(start: Date, days: number): Date {
  const d = new Date(start)
  d.setDate(d.getDate() + days)
  return d
}

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Build a dependency tree from the goal's tasks. Every task becomes a node
 * (floating = parent/children null); `dependsOn` edges wire parent→children by
 * array index, matching what CreateTaskDialog persists.
 */
function buildDependencyTree(
  tasks: SeedTaskSpec[],
  taskIds: Record<string, TaskID>
): DependencyEntityNode[] {
  const indexByKey = new Map<string, number>()
  tasks.forEach((t, i) => indexByKey.set(t.key, i))

  const nodes: DependencyEntityNode[] = tasks.map((t) => ({
    data: taskIds[t.key],
    title: t.title,
    parent: null,
    children: null,
  }))

  tasks.forEach((t, childIndex) => {
    for (const parentKey of t.dependsOn ?? []) {
      const parentIndex = indexByKey.get(parentKey)
      if (parentIndex == null) continue
      const child = nodes[childIndex]
      const parent = nodes[parentIndex]
      child.parent = [...(child.parent ?? []), parentIndex]
      parent.children = [...(parent.children ?? []), childIndex]
    }
  })

  return nodes
}

// ── Injector ───────────────────────────────────────────────

export async function injectSeed(
  scenario: SeedScenario,
  now: Date = new Date()
): Promise<SeedHandles> {
  const handles: SeedHandles = { goals: {}, tasks: {} }

  for (const goalSpec of scenario.goals) {
    const goalId = newId() as GoalID
    handles.goals[goalSpec.key] = goalId

    const goal: GoalEntity = {
      id: goalId,
      title: goalSpec.title,
      createdAt: new Date(now),
      dueAt:
        goalSpec.dueInDays != null
          ? daysFromStart(now, goalSpec.dueInDays)
          : undefined,
    }

    if (goalSpec.trigger) {
      await createGoalWithTrigger(goal, goalSpec.trigger)
    } else {
      await createGoal(goal)
    }

    // Create tasks in listed order so dependency parents precede children.
    for (const taskSpec of goalSpec.tasks) {
      const taskId = newId() as TaskID
      handles.tasks[`${goalSpec.key}.${taskSpec.key}`] = taskId

      const task: TaskGroupEntity = {
        id: taskId,
        goalId,
        title: taskSpec.title,
        createdAt: new Date(now),
        total: taskSpec.total ?? 1,
        completedCount: 0,
        allowCrossDay: taskSpec.allowCrossDay,
        dueAt:
          taskSpec.dueInDays != null
            ? daysFromStart(now, taskSpec.dueInDays)
            : undefined,
        steps: taskSpec.steps?.map((title) => ({ id: newId(), title })),
        repeat: taskSpec.repeat,
      }

      await createTask(task)

      // A repeat task's `total` must equal its occurrence count (what the real
      // Create-Task dialog stores as plannedTotal). createTask materializes the
      // ledger; sync `total` to its point count so the task isn't considered
      // "finished" after a single completion — otherwise the planner skips it
      // entirely and its daily runs stop surfacing.
      if (taskSpec.repeat) {
        const ledger = await repo.queryRepeatLedger(taskId)
        const occurrences = ledger ? Object.keys(ledger.points).length : 0
        if (occurrences > 0) {
          await repo.patchTask(taskId, { total: occurrences })
        }
      }

      if (taskSpec.trigger) {
        await saveTaskTrigger(taskId, taskSpec.trigger)
      }
    }

    // Persist the dependency tree (all tasks as nodes + edges), mirroring the UI.
    const taskIdsForGoal: Record<string, TaskID> = {}
    for (const taskSpec of goalSpec.tasks) {
      taskIdsForGoal[taskSpec.key] =
        handles.tasks[`${goalSpec.key}.${taskSpec.key}`]
    }
    const tree = buildDependencyTree(goalSpec.tasks, taskIdsForGoal)
    if (tree.length > 0) {
      const dep: DependencyEntity = {
        id: newId(),
        belongTo: goalId,
        tree,
      }
      await createDependency(dep)
    }
  }

  return handles
}
