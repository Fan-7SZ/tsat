import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import {
  createRepeatRuntimeEntity,
  getActiveTodayPoints,
} from "@/utils/repeat-ledger"
import {
  createTaskRuntimeId,
  hasTaskRuntimeForTask,
  isRepeatRuntime,
  primaryTodayRunId,
} from "@/utils/task-runtime"
import { isGoalDone } from "@/utils/goal-done"
import { computeGoalCompletionRatio } from "@/utils/goal-progress"
import {
  computeFocusMembership,
  deriveAutoPlannedRuntimeIdsByGoal,
} from "./derive-goal-focus"
import { toLocalDateKey } from "@/utils/date"
import { selectTodayDismissedTaskIds } from "@/utils/dismissed-tasks"
import type { PlannerInput, PlannerOutput } from "./types"
import type { PlannerScope, PlannerService } from "./planner-service"
import {
  isGoalDueForcedToday,
  isTaskForcedToday,
} from "./internal/forced-policy"
import {
  areTaskAncestorsResolved,
  buildGoalDependencyMap,
  buildGoalTaskMap,
  compareGoals,
  compareTasks,
  computeUsedMinutes,
  getTaskPlanMinutes,
  isTaskFinished,
  selectGoalFrontierTasks,
  shouldPreserveRuntime,
} from "./internal/planning-helpers"

/**
 * Fill a goal's chain-top tasks into the plan (discretionary "free" layer):
 * one unfinished task per dependency chain (no descend), skipping repeat/trigger
 * tasks and user-dismissed tasks, bounded by the remaining time capacity.
 */
function fillGoalFrontier(
  goalId: GoalID,
  input: PlannerInput,
  nextTaskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  usedMinutes: number,
  goalTaskMap: Map<GoalID, TaskGroupEntity[]>,
  goalDepMap: Map<GoalID, DependencyEntity>,
  dismissedTaskIds: ReadonlySet<TaskID>
): { addedRuntimeIds: TaskRuntimeID[]; usedMinutes: number } {
  const { snapshot, policy } = input
  const todayKey = toLocalDateKey(input.now)
  const frontier = selectGoalFrontierTasks({
    goalTasks: (goalTaskMap.get(goalId) ?? []).filter(
      (task) => !dismissedTaskIds.has(task.id)
    ),
    tasks: snapshot.tasks,
    dependency: goalDepMap.get(goalId),
    nextTaskRuntime,
    includeRuleTasks: false,
  }).sort(compareTasks)

  const addedRuntimeIds: TaskRuntimeID[] = []
  for (const task of frontier) {
    const taskMinutes = getTaskPlanMinutes(task)
    if (
      taskMinutes > 0 &&
      usedMinutes + taskMinutes > policy.dailyCapacityMinutes
    ) {
      continue
    }

    const runtimeId = primaryTodayRunId(task, todayKey)
    if (nextTaskRuntime[runtimeId]) continue
    nextTaskRuntime[runtimeId] = {
      id: runtimeId,
      taskId: task.id,
      arrangementStatus: "todo",
      source: "default",
    }
    addedRuntimeIds.push(runtimeId)
    usedMinutes += taskMinutes
  }

  return { addedRuntimeIds, usedMinutes }
}

export class DefaultPlannerService implements PlannerService {
  replan(input: PlannerInput, scope: PlannerScope = "full"): PlannerOutput {
    const { snapshot, policy, now } = input
    const { goals, tasks } = snapshot
    const todayKey = toLocalDateKey(now)

    const goalTaskMap = buildGoalTaskMap(tasks)
    const goalDepMap = buildGoalDependencyMap(snapshot.deps)

    // ── 1. Preserve existing runtimes that should survive replan ──
    const preservedTaskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity> = {}
    for (const runtime of Object.values(input.currentTaskRuntime)) {
      const task = tasks[runtime.taskId]
      if (!task) continue
      if (!shouldPreserveRuntime(runtime, task, todayKey, scope)) continue
      // Due-forced rows are policy-derived: the source stamp is only as good
      // as its reason. If the due was edited out of the forced window since
      // the row was created, drop it — otherwise the stale stamp keeps the
      // row locked ("remove from today" disabled) forever.
      if (runtime.arrangementStatus === "todo") {
        if (
          runtime.source === "duePolicy" &&
          !isTaskForcedToday(task, policy, now).isForced
        ) {
          continue
        }
        if (runtime.source === "goalDuePolicy") {
          const goal = task.goalId ? goals[task.goalId] : undefined
          if (!goal || !isGoalDueForcedToday(goal, policy, now)) continue
        }
        // A repeat (debt) row is only as good as its ledger point: a rule edit
        // may have pruned the planned point, or another device may have
        // resolved it — either way an unbacked row must not survive.
        if (isRepeatRuntime(runtime)) {
          const ledger = snapshot.repeatLedgers[task.id]
          if (ledger?.points[runtime.plannedForDate] !== "planned") continue
        }
      }
      preservedTaskRuntime[runtime.id] = runtime
    }
    const nextTaskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity> = {
      ...preservedTaskRuntime,
    }

    // ── 2. Repeat runtimes from ledger (plan reason; highest dedup priority) ──
    for (const [taskId, ledger] of Object.entries(
      snapshot.repeatLedgers
    ) as Array<[TaskID, (typeof snapshot.repeatLedgers)[TaskID]]>) {
      const repeatTask = tasks[taskId]
      if (repeatTask != null && isTaskFinished(repeatTask)) continue
      const activeDateKeys = getActiveTodayPoints(ledger, todayKey)
      for (const dateKey of activeDateKeys) {
        const runtime = createRepeatRuntimeEntity({ taskId, dateKey })
        if (nextTaskRuntime[runtime.id]) continue
        nextTaskRuntime[runtime.id] = runtime
      }
    }

    // Today's dismissals, shared by trigger re-derivation (2b) and the free
    // fill layer (step 5). Built here — before 2b — because removal replans run
    // with `partial` scope and must still see the dismissal.
    const dismissedTaskSet = selectTodayDismissedTaskIds(
      Object.values(snapshot.dismissedTasks),
      todayKey
    )

    // ── 2b. Trigger runtimes for tasks whose trigger fired today ──
    const scheduledTaskIdsForTrigger = new Set(
      Object.values(nextTaskRuntime).map((runtime) => runtime.taskId)
    )
    for (const task of Object.values(tasks)) {
      if (task.trigger == null) continue
      const state = snapshot.taskTriggerStates[task.id]
      if (state?.lastTriggeredDateKey !== todayKey) continue
      if (isTaskFinished(task)) continue
      if (hasTaskRuntimeForTask(nextTaskRuntime, task.id)) continue
      // Removed from today by the user — day-scoped, so tomorrow's fire is
      // unaffected. Re-adding by hand clears the dismissal (upsert does).
      if (dismissedTaskSet.has(task.id)) continue
      if (
        !areTaskAncestorsResolved(
          task,
          tasks,
          task.goalId ? goalDepMap.get(task.goalId) : undefined,
          scheduledTaskIdsForTrigger
        )
      ) {
        continue
      }

      const runtimeId = createTaskRuntimeId(task.id, "triggerPolicy")
      nextTaskRuntime[runtimeId] = {
        id: runtimeId,
        taskId: task.id,
        arrangementStatus: "todo",
        source: "triggerPolicy",
      }
      scheduledTaskIdsForTrigger.add(task.id)
    }

    // ── 3. Task due-policy forced tasks ──────────────────────────
    for (const task of Object.values(tasks)) {
      const result = isTaskForcedToday(task, policy, now)
      if (!result.isForced) continue
      if (hasTaskRuntimeForTask(nextTaskRuntime, task.id)) continue

      const runtimeId = primaryTodayRunId(task, todayKey)
      nextTaskRuntime[runtimeId] = {
        id: runtimeId,
        taskId: task.id,
        arrangementStatus: "todo",
        source: "duePolicy",
      }
    }

    // ── 3b. Goal due-policy: pull each chain's top unfinished task ──
    // Runs after repeat/trigger/task-due so plan reasons win dedup. Like the
    // free layer (step 5), this skips repeat/trigger tasks: only plain tasks are
    // eligible for due forcing. A repeat/trigger task has its own schedule
    // (ledger occurrences / trigger fires); force-pulling the whole task in has
    // no completable slot and would desync completedCount.
    for (const goal of Object.values(goals)) {
      if (isGoalDone(goal.id, tasks)) continue
      // Empty goals (no tasks) ignore their due date — nothing to pull up.
      if ((goalTaskMap.get(goal.id) ?? []).length === 0) continue
      if (!isGoalDueForcedToday(goal, policy, now)) continue

      const frontier = selectGoalFrontierTasks({
        goalTasks: goalTaskMap.get(goal.id) ?? [],
        tasks,
        dependency: goalDepMap.get(goal.id),
        nextTaskRuntime,
        includeRuleTasks: false,
      })
      for (const task of frontier) {
        const runtimeId = primaryTodayRunId(task, todayKey)
        if (nextTaskRuntime[runtimeId]) continue
        nextTaskRuntime[runtimeId] = {
          id: runtimeId,
          taskId: task.id,
          arrangementStatus: "todo",
          source: "goalDuePolicy",
        }
      }
    }

    // ── 4. Compute goal focus sets ────────────────────────────────
    // Membership (forced ∪ manual ∪ auto) comes from the SAME composition rule
    // the read side uses (`computeFocusMembership`), fed the mid-replan working
    // set: manual focus is authoritative in the day-scoped `manualFocuses`
    // table, auto focus is evidenced by the `default`-source runs still
    // present, so a partial replan preserves today's auto-fill without any
    // stored focus state.
    const membership = computeFocusMembership({
      goals,
      tasks,
      taskRuntime: nextTaskRuntime,
      manualFocuses: snapshot.manualFocuses,
      policy,
      now,
    })
    const { forcedGoalStatusMap, manualFocusGoalIds, focusSet } = membership
    const autoPlannedRuntimeIdsByGoal = new Map<GoalID, TaskRuntimeID[]>()

    // All forced goals count toward the focus cap; goals forced ONLY by a
    // manually-added task are not auto-filled with extra tasks.
    const forcedGoalIds = new Set(forcedGoalStatusMap.keys())
    const fillSeedForcedGoalIds = new Set<GoalID>()
    for (const [goalId, statuses] of forcedGoalStatusMap) {
      if (statuses.some((status) => status.kind !== "manualTodayTask")) {
        fillSeedForcedGoalIds.add(goalId)
      }
    }

    // focus scope: drop auto (default) todos whose goal left the focus set.
    if (scope === "focus") {
      for (const [runtimeId, runtime] of Object.entries(nextTaskRuntime)) {
        if (runtime.source !== "default") continue
        if (runtime.arrangementStatus !== "todo") continue
        const goalId = tasks[runtime.taskId]?.goalId
        if (!goalId || !focusSet.has(goalId)) {
          delete nextTaskRuntime[runtimeId]
        }
      }
    }

    // Auto-focused goals = those still holding an OPEN default runtime
    // (post-drop). One rule, one implementation: this reuses the shared
    // derivation, whose todo-only filter is load-bearing — a surviving
    // inProgress run of a just-un-focused goal must not re-enter the fill
    // list and resurrect the focus on the same replan.
    for (const [goalId, runtimeIds] of deriveAutoPlannedRuntimeIdsByGoal(
      tasks,
      nextTaskRuntime
    )) {
      autoPlannedRuntimeIdsByGoal.set(goalId, runtimeIds)
    }

    // ── 5. Free layer: fill chain-top tasks for focused goals ─────
    // Skipped for "partial" (today's plan stays frozen). "full" additionally
    // runs the completion-based goal top-up; "focus" only honours the set above.
    if (scope !== "partial") {
      let usedMinutes = computeUsedMinutes(nextTaskRuntime, tasks)
      const autoFocusedGoalIds = new Set(autoPlannedRuntimeIdsByGoal.keys())
      const existingFocusedGoalIds = new Set<GoalID>([
        ...forcedGoalIds,
        ...manualFocusGoalIds,
        ...autoFocusedGoalIds,
      ])
      if (usedMinutes < policy.dailyCapacityMinutes) {
        const sortGoals = (goalList: GoalEntity[]) =>
          [...goalList].sort((left, right) =>
            compareGoals(left, right, goalTaskMap, nextTaskRuntime)
          )
        const activeGoals = (pred: (goal: GoalEntity) => boolean) =>
          Object.values(goals).filter(
            (goal) => !isGoalDone(goal.id, tasks) && pred(goal)
          )

        // Fill already-focused goals first: forced (excl. manual-task-only) →
        // manual focus → preserved auto-focus.
        const prioritizedFocusedGoals = [
          ...sortGoals(activeGoals((g) => fillSeedForcedGoalIds.has(g.id))),
          ...sortGoals(
            activeGoals(
              (g) =>
                !fillSeedForcedGoalIds.has(g.id) && manualFocusGoalIds.has(g.id)
            )
          ),
          ...sortGoals(
            activeGoals(
              (g) =>
                !fillSeedForcedGoalIds.has(g.id) &&
                !manualFocusGoalIds.has(g.id) &&
                autoFocusedGoalIds.has(g.id)
            )
          ),
        ]

        for (const goal of prioritizedFocusedGoals) {
          if (usedMinutes >= policy.dailyCapacityMinutes) break
          const { addedRuntimeIds, usedMinutes: nextUsedMinutes } =
            fillGoalFrontier(
              goal.id,
              input,
              nextTaskRuntime,
              usedMinutes,
              goalTaskMap,
              goalDepMap,
              dismissedTaskSet
            )
          if (addedRuntimeIds.length > 0) {
            const existing = autoPlannedRuntimeIdsByGoal.get(goal.id) ?? []
            autoPlannedRuntimeIdsByGoal.set(goal.id, [
              ...new Set([...existing, ...addedRuntimeIds]),
            ])
          }
          usedMinutes = nextUsedMinutes
        }

        // Top up NEW goals (full only): most-complete first (finish what is
        // closest to done before opening fresh goals), excl. trigger goals.
        if (scope === "full") {
          let focusedGoalCount = existingFocusedGoalIds.size
          const autoGoalCandidates = Object.values(goals)
            .filter(
              (goal) =>
                !isGoalDone(goal.id, tasks) &&
                !existingFocusedGoalIds.has(goal.id) &&
                goal.trigger == null &&
                // Skip empty goals (no tasks): nothing to auto-fill / focus.
                (goalTaskMap.get(goal.id) ?? []).length > 0
            )
            .sort((left, right) => {
              const diff =
                computeGoalCompletionRatio(right.id, tasks) -
                computeGoalCompletionRatio(left.id, tasks)
              return diff !== 0 ? diff : left.title.localeCompare(right.title)
            })

          for (const goal of autoGoalCandidates) {
            if (focusedGoalCount >= policy.maxFocusGoals) break
            if (usedMinutes >= policy.dailyCapacityMinutes) break

            const { addedRuntimeIds, usedMinutes: nextUsedMinutes } =
              fillGoalFrontier(
                goal.id,
                input,
                nextTaskRuntime,
                usedMinutes,
                goalTaskMap,
                goalDepMap,
                dismissedTaskSet
              )
            usedMinutes = nextUsedMinutes
            if (addedRuntimeIds.length === 0) continue

            autoPlannedRuntimeIdsByGoal.set(goal.id, addedRuntimeIds)
            focusedGoalCount += 1
          }
        }
      }
    }

    return { taskRuntime: nextTaskRuntime }
  }
}
