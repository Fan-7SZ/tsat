import type { GoalID } from "@/domain/value-objects/types"
import type {
  GoalBlockingFocusStatus,
  GoalFocusStatus,
  GoalFocus,
} from "@/domain/derived/GoalFocus"

const focusStatusPriority: Record<GoalFocusStatus["kind"], number> = {
  manualTodayTask: 0,
  repeatPolicyPoint: 1,
  taskTriggerPolicy: 2,
  taskDuePolicy: 3,
  goalDuePolicy: 4,
  manualFocus: 5,
  autoPlannedTask: 6,
}

function normalizeGoalFocusStatus(status: GoalFocusStatus): GoalFocusStatus {
  switch (status.kind) {
    case "manualFocus":
      return {
        kind: "manualFocus",
        isBlocking: false,
        source: status.source ?? "manual",
      }
    case "autoPlannedTask":
      return {
        kind: "autoPlannedTask",
        isBlocking: false,
        runtimeKeys: [...new Set(status.runtimeKeys ?? [])],
      }
    case "goalDuePolicy":
      return {
        kind: "goalDuePolicy",
        isBlocking: true,
        dueAt: new Date(status.dueAt),
      }
    case "taskDuePolicy":
      return {
        kind: "taskDuePolicy",
        isBlocking: true,
        taskId: status.taskId,
        taskTitle: status.taskTitle,
        dueAt: new Date(status.dueAt),
      }
    case "manualTodayTask":
      return {
        kind: "manualTodayTask",
        isBlocking: true,
        taskId: status.taskId,
        taskTitle: status.taskTitle,
      }
    case "repeatPolicyPoint":
      return {
        kind: "repeatPolicyPoint",
        isBlocking: true,
        taskId: status.taskId,
        taskTitle: status.taskTitle,
        plannedForDate: status.plannedForDate,
      }
    case "taskTriggerPolicy":
      return {
        kind: "taskTriggerPolicy",
        isBlocking: true,
        taskId: status.taskId,
        taskTitle: status.taskTitle,
        firedDate: status.firedDate,
      }
  }
}

function getFocusStatusKey(status: GoalFocusStatus): string {
  switch (status.kind) {
    case "manualFocus":
      // Keyed by source: a trigger-placed focus and a hand-placed one are the
      // same row, but must not silently overwrite each other's wording.
      return `manualFocus:${status.source ?? "manual"}`
    case "autoPlannedTask":
      return "autoPlannedTask"
    case "goalDuePolicy":
      return `goalDuePolicy:${status.dueAt.toISOString()}`
    case "taskDuePolicy":
      return `taskDuePolicy:${status.taskId}:${status.dueAt.toISOString()}`
    case "manualTodayTask":
      return `manualTodayTask:${status.taskId}`
    case "repeatPolicyPoint":
      return `repeatPolicyPoint:${status.taskId}:${status.plannedForDate}`
    case "taskTriggerPolicy":
      return `taskTriggerPolicy:${status.taskId}:${status.firedDate}`
  }
}

function sortGoalFocusStatuses(statuses: GoalFocusStatus[]): GoalFocusStatus[] {
  return [...statuses].sort(
    (left, right) =>
      focusStatusPriority[left.kind] - focusStatusPriority[right.kind]
  )
}

export function upsertGoalFocusStatus(
  statuses: GoalFocusStatus[] | null | undefined,
  nextStatus: GoalFocusStatus
): GoalFocusStatus[] {
  const nextKey = getFocusStatusKey(nextStatus)
  let didReplace = false

  const merged = (statuses ?? []).map((status) => {
    if (getFocusStatusKey(status) !== nextKey) {
      return status
    }

    didReplace = true
    if (
      status.kind === "autoPlannedTask" &&
      nextStatus.kind === "autoPlannedTask"
    ) {
      return {
        ...nextStatus,
        runtimeKeys: [
          ...new Set([...status.runtimeKeys, ...nextStatus.runtimeKeys]),
        ],
      }
    }

    return nextStatus
  })

  if (!didReplace) {
    merged.push(nextStatus)
  }

  return sortGoalFocusStatuses(merged)
}
/**
 * Merges multiple lists of goal focus statuses into a single list, ensuring uniqueness and sorted order based on predefined priority. If there are duplicate statuses (determined by their kind and relevant properties), the last one encountered in the input lists will take precedence, with special merging logic for "autoPlannedTask" statuses to combine their runtime keys.
 * @param lists
 * @returns
 */
export function mergeGoalFocusStatuses(
  ...lists: Array<GoalFocusStatus[] | null | undefined>
): GoalFocusStatus[] {
  let merged: GoalFocusStatus[] = []

  for (const list of lists) {
    for (const status of list ?? []) {
      merged = upsertGoalFocusStatus(merged, status)
    }
  }

  return sortGoalFocusStatuses(merged)
}

export function getBlockingGoalFocusStatuses(
  statuses: GoalFocusStatus[] | null | undefined
): GoalBlockingFocusStatus[] {
  return (statuses ?? []).filter(
    (status): status is GoalBlockingFocusStatus => status.isBlocking
  )
}

export function hasBlockingGoalFocusStatus(
  statuses: GoalFocusStatus[] | null | undefined
): boolean {
  return getBlockingGoalFocusStatuses(statuses).length > 0
}

export function normalizeGoalFocusStatuses(
  runtime: GoalFocus | null | undefined
): GoalFocusStatus[] {
  if (!runtime?.focusStatuses) return []
  return sortGoalFocusStatuses(
    runtime.focusStatuses.map(normalizeGoalFocusStatus)
  )
}
/**
 * Normalizes a goal runtime entity by ensuring its focus statuses are expected.
 * @param goalId
 * @param runtime
 * @returns
 */
export function normalizeGoalFocus(
  goalId: GoalID,
  runtime: GoalFocus | null | undefined
): GoalFocus {
  const focusStatuses = normalizeGoalFocusStatuses(runtime)

  return {
    id: goalId,
    isFocused: focusStatuses.length > 0,
    focusStatuses,
  }
}
