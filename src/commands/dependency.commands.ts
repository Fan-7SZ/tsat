import { toast } from "sonner"

import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DependencyEntityID, TaskID } from "@/domain/value-objects/types"
import * as repo from "@/persistence/repository"
import { useAppStore } from "@/store/app-store"
import { validateTreeRepeatIntegrity } from "@/utils/repeat-validation"

function scheduleReplan(): Promise<void> {
  return Promise.resolve(useAppStore.getState().replan("partial"))
}

function buildTaskRecord(
  tasks: TaskGroupEntity[]
): Record<TaskID, TaskGroupEntity> {
  return Object.fromEntries(tasks.map((task) => [task.id, task])) as Record<
    TaskID,
    TaskGroupEntity
  >
}

export async function createDependency(
  dep: DependencyEntity,
  failureMessage?: string
): Promise<boolean> {
  const [goal, tasks] = await Promise.all([
    repo.queryGoalById(dep.belongTo),
    repo.queryTasksByGoal(dep.belongTo),
  ])
  const result = validateTreeRepeatIntegrity(
    dep,
    buildTaskRecord(tasks),
    goal ?? undefined
  )
  if (!result.valid) {
    toast.error(result.errorMessage)
    return false
  }

  try {
    await repo.putDep(dep)

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[dependency.commands] Failed to create dependency", error)
    toast.error(failureMessage ?? "Failed to update dependency graph.")
    return false
  }
}

export async function updateDependency(
  id: DependencyEntityID,
  patch: Partial<Omit<DependencyEntity, "id">>,
  failureMessage?: string
): Promise<boolean> {
  const current = await repo.queryDependencyById(id)
  if (!current) {
    return false
  }

  if (patch.tree) {
    const nextDep = { ...current, ...patch, id: current.id }
    const [goal, tasks] = await Promise.all([
      repo.queryGoalById(nextDep.belongTo),
      repo.queryTasksByGoal(nextDep.belongTo),
    ])
    const result = validateTreeRepeatIntegrity(
      nextDep,
      buildTaskRecord(tasks),
      goal ?? undefined
    )
    if (!result.valid) {
      toast.error(result.errorMessage)
      return false
    }
  }

  try {
    const updatedCount = await repo.patchDep(id, patch)
    if (updatedCount === 0) {
      return false
    }

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[dependency.commands] Failed to update dependency", error)
    toast.error(failureMessage ?? "Failed to update dependency graph.")
    return false
  }
}

export async function deleteDependency(
  id: DependencyEntityID,
  failureMessage?: string
): Promise<boolean> {
  try {
    await repo.deleteDep(id)

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[dependency.commands] Failed to delete dependency", error)
    toast.error(failureMessage ?? "Failed to update dependency graph.")
    return false
  }
}
