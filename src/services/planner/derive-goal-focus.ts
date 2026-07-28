import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { GoalFocus } from "@/domain/derived/GoalFocus"
import type { ManualFocusRecord } from "@/domain/entities/IntentRecord"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type { PlannerPolicy } from "@/services/planner/types"
import { isGoalForcedFocused } from "./internal/forced-policy"
import { buildGoalTaskMap } from "./internal/planning-helpers"
import { isGoalDone } from "@/utils/goal-done"
import { mergeGoalFocusStatuses } from "@/utils/goal-focus-status"
import { toLocalDateKey } from "@/utils/date"

export interface GoalFocusInput {
  goals: Record<GoalID, GoalEntity>
  tasks: Record<TaskID, TaskGroupEntity>
  /** Today's run rows (dayRuns), keyed by run id. */
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
  manualFocuses: Record<GoalID, ManualFocusRecord>
  policy: PlannerPolicy
  now: Date
}

/** Goals manually focused today (day-scoped records, dead goals filtered). */
export function deriveManualFocusGoalIds(
  input: Pick<GoalFocusInput, "goals" | "manualFocuses"> & { todayKey: string }
): Set<GoalID> {
  const ids = new Set<GoalID>()
  for (const record of Object.values(input.manualFocuses)) {
    if (record.dateKey === input.todayKey && input.goals[record.goalId]) {
      ids.add(record.goalId)
    }
  }
  return ids
}

/**
 * Auto-focus evidence: the OPEN (`todo`) `default`-source runs a goal holds.
 * Runs already acted on (inProgress / done) are historical facts that must
 * survive an un-focus — they cannot double as focus evidence, or un-focusing
 * a goal with an in-progress auto task could never stick (the un-deletable
 * run would keep re-deriving the focus forever).
 */
export function deriveAutoPlannedRuntimeIdsByGoal(
  tasks: Record<TaskID, TaskGroupEntity>,
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
): Map<GoalID, TaskRuntimeID[]> {
  const byGoal = new Map<GoalID, TaskRuntimeID[]>()
  for (const runtime of Object.values(taskRuntime)) {
    if (runtime.source !== "default") continue
    if (runtime.arrangementStatus !== "todo") continue
    const goalId = tasks[runtime.taskId]?.goalId
    if (!goalId) continue
    const ids = byGoal.get(goalId) ?? []
    ids.push(runtime.id)
    byGoal.set(goalId, ids)
  }
  return byGoal
}

/**
 * The focus set and the evidence behind it, computed once from authoritative
 * facts. This is THE composition rule — `focusSet = forced ∪ manual ∪ auto` —
 * shared by the read side (`deriveGoalFocus`) and the planner's step 4, so the
 * two can never disagree on what counts as focused. Callers choose the runtime
 * snapshot: stored rows on the read side, the mid-replan working set in the
 * planner.
 */
export interface FocusMembership {
  /** Non-done goals with at least one blocking (forced) reason. */
  forcedGoalStatusMap: Map<
    GoalID,
    ReturnType<typeof isGoalForcedFocused>["statuses"]
  >
  manualFocusGoalIds: Set<GoalID>
  autoPlannedRuntimeIdsByGoal: Map<GoalID, TaskRuntimeID[]>
  focusSet: Set<GoalID>
}

export function computeFocusMembership(input: GoalFocusInput): FocusMembership {
  const { goals, tasks, taskRuntime, policy, now } = input
  const todayKey = toLocalDateKey(now)
  const goalTaskMap = buildGoalTaskMap(tasks)

  const forcedGoalStatusMap: FocusMembership["forcedGoalStatusMap"] = new Map()
  for (const goal of Object.values(goals)) {
    if (isGoalDone(goal.id, tasks)) continue
    const forced = isGoalForcedFocused(
      goal,
      goalTaskMap.get(goal.id) ?? [],
      taskRuntime,
      policy,
      now
    )
    if (forced.statuses.length > 0) {
      forcedGoalStatusMap.set(goal.id, forced.statuses)
    }
  }

  const manualFocusGoalIds = deriveManualFocusGoalIds({
    goals,
    manualFocuses: input.manualFocuses,
    todayKey,
  })
  const autoPlannedRuntimeIdsByGoal = deriveAutoPlannedRuntimeIdsByGoal(
    tasks,
    taskRuntime
  )

  return {
    forcedGoalStatusMap,
    manualFocusGoalIds,
    autoPlannedRuntimeIdsByGoal,
    focusSet: new Set<GoalID>([
      ...forcedGoalStatusMap.keys(),
      ...manualFocusGoalIds,
      ...autoPlannedRuntimeIdsByGoal.keys(),
    ]),
  }
}

/**
 * Derives the whole goal-focus state from authoritative facts — nothing here is
 * stored. Manual focus comes from the day-scoped `manualFocuses` intent table,
 * auto focus from the `default`-source runs a goal holds, forced focus from
 * policy over goals/tasks/runs. This replaces the persisted `goalFocus`
 * blob: focus is an interpretation of the data, never data of its own.
 */
export function deriveGoalFocus(
  input: GoalFocusInput
): Record<GoalID, GoalFocus> {
  const { goals } = input
  const membership = computeFocusMembership(input)
  const { manualFocusGoalIds, autoPlannedRuntimeIdsByGoal } = membership

  return Object.fromEntries(
    (Object.keys(goals) as GoalID[]).map((goalId) => {
      const forcedStatuses = membership.forcedGoalStatusMap.get(goalId) ?? []

      // `manualFocusGoalIds` already filtered to today's rows, so the record
      // behind a hit is today's — read its source for the reason wording.
      const manualFocusStatuses = manualFocusGoalIds.has(goalId)
        ? [
            {
              kind: "manualFocus" as const,
              isBlocking: false as const,
              source: input.manualFocuses[goalId]?.source ?? "manual",
            },
          ]
        : []
      const autoRuntimeKeys = autoPlannedRuntimeIdsByGoal.get(goalId) ?? []
      const autoStatuses =
        autoRuntimeKeys.length > 0
          ? [
              {
                kind: "autoPlannedTask" as const,
                isBlocking: false as const,
                runtimeKeys: [...new Set(autoRuntimeKeys)],
              },
            ]
          : []

      const focusStatuses = mergeGoalFocusStatuses(
        manualFocusStatuses,
        autoStatuses,
        forcedStatuses
      )

      return [
        goalId,
        {
          id: goalId,
          isFocused: focusStatuses.length > 0,
          focusStatuses,
        } satisfies GoalFocus,
      ]
    })
  ) as Record<GoalID, GoalFocus>
}
