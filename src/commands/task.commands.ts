import { toast } from "sonner"

import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  DependencyEntityID,
  GoalID,
  TaskID,
} from "@/domain/value-objects/types"
import * as repo from "@/persistence/repository"
import { useAppStore } from "@/store/app-store"
import { mergeLedgerWithRule } from "@/utils/repeat-ledger"
import {
  validateRepeatConfiguration,
  validateTreeRepeatIntegrity,
  validateTriggerWindowConfiguration,
} from "@/utils/repeat-validation"

function scheduleReplan(): Promise<void> {
  return Promise.resolve(useAppStore.getState().replan("partial"))
}

/** The ledger a task should persist alongside itself (null = ensure absent). */
async function computeLedgerSync(
  task: TaskGroupEntity
): Promise<{ taskId: TaskID; ledger: RepeatLedgerEntity | null }> {
  if (task.repeat == null) {
    return { taskId: task.id, ledger: null }
  }
  const existing = (await repo.queryRepeatLedger(task.id)) ?? undefined
  const merged = mergeLedgerWithRule({ task, existing })
  return { taskId: task.id, ledger: merged ?? null }
}

async function syncLedgerWithTask(task: TaskGroupEntity): Promise<void> {
  const { ledger } = await computeLedgerSync(task)
  if (ledger) {
    await repo.putRepeatLedger(ledger)
  } else {
    await repo.deleteRepeatLedger(task.id)
  }
}

function shouldTriggerTaskSchedulerReplan(
  patch: Partial<Omit<TaskGroupEntity, "id">>
): boolean {
  return (
    "goalId" in patch ||
    "dueAt" in patch ||
    "repeat" in patch ||
    "estimatedDuration" in patch ||
    "total" in patch ||
    "completedCount" in patch ||
    "trigger" in patch
  )
}

function shouldValidateRepeatPatch(
  patch: Partial<Omit<TaskGroupEntity, "id">>
): boolean {
  return (
    "goalId" in patch ||
    "repeat" in patch ||
    "createdAt" in patch ||
    "trigger" in patch ||
    "dueAt" in patch ||
    "total" in patch
  )
}

function buildTaskRecord(
  tasks: TaskGroupEntity[]
): Record<TaskID, TaskGroupEntity> {
  return Object.fromEntries(tasks.map((task) => [task.id, task])) as Record<
    TaskID,
    TaskGroupEntity
  >
}

function validateTriggerGoalTask(
  task: TaskGroupEntity,
  context: TaskGoalContext
): { valid: boolean; errorMessage?: string } {
  if (context.goal?.trigger != null && task.repeat != null) {
    return {
      valid: false,
      errorMessage: "Triggered goals cannot contain repeating tasks.",
    }
  }

  if (task.trigger != null && task.repeat != null) {
    return {
      valid: false,
      errorMessage: "Triggered tasks cannot use a repeat rule.",
    }
  }

  if (task.trigger != null && task.dueAt != null) {
    return {
      valid: false,
      errorMessage: "Triggered tasks cannot use a due date.",
    }
  }

  return { valid: true }
}

type TaskGoalContext = {
  goal: GoalEntity | null
  dependency: DependencyEntity | null
  tasks: TaskGroupEntity[]
}

async function queryTaskGoalContext(
  goalId: GoalID | undefined
): Promise<TaskGoalContext> {
  if (!goalId) {
    return {
      goal: null,
      dependency: null,
      tasks: [],
    }
  }

  const [goal, dependency, tasks] = await Promise.all([
    repo.queryGoalById(goalId),
    repo.queryDependencyByGoal(goalId),
    repo.queryTasksByGoal(goalId),
  ])

  return {
    goal,
    dependency,
    tasks,
  }
}

function validateRepeatForTask(
  task: TaskGroupEntity,
  context: TaskGoalContext
): { valid: boolean; errorMessage?: string } {
  const triggerGoalValidation = validateTriggerGoalTask(task, context)
  if (!triggerGoalValidation.valid) {
    return triggerGoalValidation
  }

  const goal = context.goal ?? undefined

  const tasksById = {
    ...buildTaskRecord(context.tasks),
    [task.id]: task,
  }

  const validation = validateRepeatConfiguration({
    repeat: task.repeat,
    goal,
    fallbackStart: task.createdAt,
    dependency: context.dependency,
    currentNodeData: task.id,
    tasksById,
    total: task.total,
  })

  if (validation.error) {
    return { valid: false, errorMessage: validation.error.message }
  }

  // Covers the reverse direction: a patch (goalId, dueAt, …) that brings an
  // existing trigger window into conflict with the chain.
  if (task.trigger != null) {
    const triggerValidation = validateTriggerWindowConfiguration({
      window: task.trigger,
      goal,
      fallbackStart: task.createdAt,
      dependency: context.dependency,
      currentNodeData: task.id,
      tasksById,
    })

    if (triggerValidation.error) {
      return { valid: false, errorMessage: triggerValidation.error.message }
    }
  }

  return { valid: true }
}

function cloneTreeNodes(
  tree: DependencyEntity["tree"]
): DependencyEntity["tree"] {
  return tree.map((node) => ({
    ...node,
    parent: node.parent ? [...node.parent] : null,
    children: node.children ? [...node.children] : null,
  }))
}

export async function createTask(
  task: TaskGroupEntity,
  failureMessage?: string
): Promise<boolean> {
  const context = await queryTaskGoalContext(task.goalId)
  const validation = validateRepeatForTask(task, context)
  if (!validation.valid) {
    toast.error(validation.errorMessage)
    return false
  }

  // Repeat-rule tasks have fixed pull-up dates; cross-day carry-over would add
  // uncertainty, so it is never persisted for them.
  const normalizedTask =
    task.repeat != null && task.allowCrossDay
      ? { ...task, allowCrossDay: false }
      : task

  try {
    await repo.putTask(normalizedTask)
    await syncLedgerWithTask(task)

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[task.commands] Failed to create task", error)
    toast.error(failureMessage ?? "Failed to create task.")
    return false
  }
}

/**
 * Create several tasks at once: validate all, persist in a single bulk write,
 * then replan once. The tasks show up together in reactive views instead of
 * appearing one at a time (as a createTask loop would).
 */
export async function createTasks(
  tasks: TaskGroupEntity[],
  failureMessage?: string
): Promise<boolean> {
  if (tasks.length === 0) return true
  try {
    const normalized: TaskGroupEntity[] = []
    for (const task of tasks) {
      const context = await queryTaskGoalContext(task.goalId)
      const validation = validateRepeatForTask(task, context)
      if (!validation.valid) {
        toast.error(validation.errorMessage)
        return false
      }
      normalized.push(
        task.repeat != null && task.allowCrossDay
          ? { ...task, allowCrossDay: false }
          : task
      )
    }

    // Ledgers are computed up front and land in the same transaction as the
    // tasks, so the batch really does appear (tasks + ledgers) all at once.
    const ledgerSync = []
    for (const task of tasks) {
      ledgerSync.push(await computeLedgerSync(task))
    }
    await repo.putTasks(normalized, ledgerSync)

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[task.commands] Failed to create tasks", error)
    toast.error(failureMessage ?? "Failed to create tasks.")
    return false
  }
}

export async function updateTask(
  id: TaskID,
  patch: Partial<Omit<TaskGroupEntity, "id">>,
  failureMessage?: string
): Promise<boolean> {
  const current = await repo.queryTaskById(id)
  if (!current) {
    return false
  }

  const nextTask: TaskGroupEntity = {
    ...current,
    ...patch,
    id: current.id,
  }

  if (shouldValidateRepeatPatch(patch)) {
    const context = await queryTaskGoalContext(nextTask.goalId)
    const validation = validateRepeatForTask(nextTask, context)
    if (!validation.valid) {
      toast.error(validation.errorMessage)
      return false
    }
  }

  const dependencyTitleUpdates: Array<{
    depId: DependencyEntityID
    tree: DependencyEntity["tree"]
  }> = []

  if (patch.title != null) {
    const goalIds = [
      ...new Set(
        [current.goalId, nextTask.goalId].filter(
          (goalId): goalId is GoalID => goalId != null
        )
      ),
    ]
    const dependencies = await Promise.all(
      goalIds.map((goalId) => repo.queryDependencyByGoal(goalId))
    )

    for (const dep of dependencies) {
      if (!dep) {
        continue
      }

      const nodeIndex = dep.tree.findIndex((node) => node.data === id)
      if (nodeIndex === -1) {
        continue
      }

      dependencyTitleUpdates.push({
        depId: dep.id,
        tree: dep.tree.map((node, index) =>
          index === nodeIndex ? { ...node, title: patch.title! } : node
        ),
      })
    }
  }

  try {
    const updatedCount = await repo.patchTask(id, patch)
    if (updatedCount === 0) {
      return false
    }

    if (dependencyTitleUpdates.length > 0) {
      await Promise.all(
        dependencyTitleUpdates.map(({ depId, tree }) =>
          repo.patchDep(depId, { tree })
        )
      )
    }

    const ledgerRuleChanged =
      "repeat" in patch ||
      "repeatStartsAt" in patch ||
      "repeatEndsAt" in patch ||
      "goalId" in patch
    if (ledgerRuleChanged) {
      await syncLedgerWithTask(nextTask)
    }

    // A task that just TURNED repeat: its pre-existing runs (manual / default /
    // duePolicy) carry no ledger point, so completing one would bump
    // completedCount outside the ledger and the next recount would erase it.
    // The ledger owns occurrences now — clear the old rows and let the replan
    // below pull today's point properly.
    if (current.repeat == null && patch.repeat != null) {
      await repo.deleteDayRunsByTasks([id])
    }

    if (shouldTriggerTaskSchedulerReplan(patch)) {
      await scheduleReplan()
    }

    return true
  } catch (error) {
    console.error("[task.commands] Failed to update task", error)
    toast.error(failureMessage ?? "Failed to update task.")
    return false
  }
}

export async function deleteTask(
  id: TaskID,
  failureMessage?: string
): Promise<boolean> {
  const current = await repo.queryTaskById(id)
  if (!current) {
    return false
  }

  const depUpdates = new Map<DependencyEntityID, DependencyEntity>()

  let goal: GoalEntity | null = null
  let tasksWithoutDeleted: Record<TaskID, TaskGroupEntity> = {}

  if (current.goalId) {
    const context = await queryTaskGoalContext(current.goalId)
    goal = context.goal
    tasksWithoutDeleted = buildTaskRecord(
      context.tasks.filter((task) => task.id !== id)
    )

    const dep = context.dependency
    if (dep) {
      const nodeIndex = dep.tree.findIndex((node) => node.data === id)
      if (nodeIndex !== -1) {
        const node = dep.tree[nodeIndex]
        if (node) {
          const parentIndices = node.parent ?? []
          const childIndices = node.children ?? []
          const newTree = cloneTreeNodes(dep.tree).filter(
            (_, index) => index !== nodeIndex
          )

          const remap = (index: number) =>
            index > nodeIndex ? index - 1 : index

          for (const treeNode of newTree) {
            if (treeNode.parent) {
              const filtered = treeNode.parent.filter(
                (index) => index !== nodeIndex
              )
              const wasChild = treeNode.parent.includes(nodeIndex)
              const merged = wasChild
                ? [...new Set([...filtered, ...parentIndices].map(remap))]
                : filtered.map(remap)
              treeNode.parent = merged.length > 0 ? merged : null
            }

            if (treeNode.children) {
              const filtered = treeNode.children.filter(
                (index) => index !== nodeIndex
              )
              const wasParent = treeNode.children.includes(nodeIndex)
              const merged = wasParent
                ? [...new Set([...filtered, ...childIndices].map(remap))]
                : filtered.map(remap)
              treeNode.children = merged.length > 0 ? merged : null
            }
          }

          const nextDep = { ...dep, tree: newTree }
          depUpdates.set(dep.id, nextDep)
        }
      }
    }
  }

  for (const dep of depUpdates.values()) {
    const result = validateTreeRepeatIntegrity(
      dep,
      tasksWithoutDeleted,
      goal ?? undefined
    )
    if (!result.valid) {
      toast.error(result.errorMessage)
      return false
    }
  }

  try {
    await repo.deleteTaskCascadeAtomic(id, [...depUpdates.values()])

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[task.commands] Failed to delete task", error)
    toast.error(failureMessage ?? "Failed to delete task.")
    return false
  }
}

// ── Rebind a task to a different goal (or detach to standalone) ─────────────

export type TaskGoalRebindPlan = {
  taskId: TaskID
  fromGoalId?: GoalID
  toGoalId?: GoalID
  /**
   * The destination cannot hold a repeat / trigger / multi-run task, so rebinding
   * requires normalizing the task to single-run (clearing repeat & trigger).
   */
  requiresNormalization: boolean
}

/**
 * Read-only pre-flight for a rebind: reports whether the move needs to normalize
 * the task (clear repeat/trigger). Returns null when the task is missing or the
 * goal is unchanged (no-op).
 */
export async function planTaskGoalRebind(
  taskId: TaskID,
  toGoalId: GoalID | undefined
): Promise<TaskGoalRebindPlan | null> {
  const task = await repo.queryTaskById(taskId)
  if (!task) {
    return null
  }

  const fromGoalId = task.goalId
  if (fromGoalId === toGoalId) {
    return null
  }

  // The destination forbids multi-run tasks when it is standalone or a
  // trigger-driven goal (mirrors the goal-trigger normalization predicate).
  const targetGoal = toGoalId ? await repo.queryGoalById(toGoalId) : null
  const destinationForbidsMultiRun = !toGoalId || targetGoal?.trigger != null
  const taskIsMultiRun =
    task.repeat != null || task.trigger != null || task.total !== 1
  const requiresNormalization = destinationForbidsMultiRun && taskIsMultiRun

  return {
    taskId,
    fromGoalId,
    toGoalId,
    requiresNormalization,
  }
}

/**
 * Move a task to a different goal (or detach it to standalone). Atomically
 * migrates the goal's dependency trees (see `rebindTaskGoalAtomic`) and, when
 * `normalize` is set, resets the task to single-run. Detaching bridges the
 * task's dependents up to all of its parents. No-op (returns true) when the
 * goal is unchanged.
 */
export async function rebindTaskGoal(
  taskId: TaskID,
  toGoalId: GoalID | undefined,
  options?: { normalize?: boolean },
  failureMessage?: string
): Promise<boolean> {
  const current = await repo.queryTaskById(taskId)
  if (!current) {
    return false
  }
  if (current.goalId === toGoalId) {
    return true
  }

  const normalize = options?.normalize ?? false

  try {
    const outcome = await repo.rebindTaskGoalAtomic({
      taskId,
      toGoalId,
      normalize,
      newDependencyId: crypto.randomUUID() as DependencyEntityID,
    })

    if (outcome.result === "task-not-found") {
      return false
    }

    // Normalization changes total / repeat, so stale runtime occurrences for
    // this task must be dropped; the replan rebuilds them.
    if (outcome.normalized) {
      await repo.deleteDayRunsByTasks([taskId])
    }

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[task.commands] Failed to rebind task goal", error)
    toast.error(failureMessage ?? "Failed to move task.")
    return false
  }
}
