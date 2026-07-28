import type { StateCreator } from "zustand"
import type { AppStore } from "../store.types"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
  ActivityID,
} from "@/domain/value-objects/types"
import type {
  DayRunEntity,
  TaskRuntimeEntity,
} from "@/domain/entities/TaskRuntimeEntity"
import type {
  TaskRuntimeStatus,
  StepID,
} from "@/domain/entities/TaskRuntimeEntity"
import {
  type ActivityEntity,
  createStableActivityId,
  createStableRepeatResolutionActivityId,
} from "@/domain/entities/ActivityEntity"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import * as repo from "@/persistence/repository"
import { buildRepeatSkipMutation } from "@/persistence/run-mutations"
import { endOfTodayISO, toLocalDateKey } from "@/utils/date"
import { isRepeatRuntime, createNextRunId } from "@/utils/task-runtime"

export type RepeatDebtResolution = "done" | "skip"

//MARK: RunsState
export interface RunsState {
  /**
   * Device-local end-of-day marker driving the cross-day sweep. Not synced —
   * each device sweeps its own day boundary.
   */
  runtimeValidUntil: string
}

// MARK:RunsActions
export interface RunsActions {
  upsertTaskRuntime: (runtime: TaskRuntimeEntity) => void
  /**
   * Manual focus toggle, expressed as data: focusing writes the day-scoped
   * manualFocuses intent; un-focusing removes it AND drops the goal's
   * auto-planned runs (the auto-focus evidence). Focus itself is derived at
   * read time — see deriveGoalFocus.
   */
  setGoalFocus: (goalId: GoalID, isFocused: boolean) => void
  removeTaskRuntime: (runtimeId: TaskRuntimeID) => void

  transitionTaskStatus: (
    runtimeId: TaskRuntimeID,
    nextStatus: TaskRuntimeStatus
  ) => void
  /**
   * "Do it again": add another run of a counter task to today. A run is its own
   * runtime, so the completed one stays completed — unlike transitioning a done
   * runtime back to `todo`, which retracts its completion.
   */
  addTaskRun: (taskId: TaskID) => void
  skipRepeatTask: (runtimeId: TaskRuntimeID) => void
  resolveRepeatDebt: (
    runtimeId: TaskRuntimeID,
    resolution: RepeatDebtResolution
  ) => void
  restoreSkippedRepeatTask: (
    runtimeId: TaskRuntimeID,
    taskId: TaskID,
    dateKey: LocalDateKey
  ) => void
  upsertStepsCompleted: (
    runtimeId: TaskRuntimeID,
    stepsCompleted: StepID[]
  ) => void
}

export type RunsSlice = RunsState & RunsActions

/** Stamps a runtime as a dayRuns row materialized for today. */
function toDayRun(runtime: TaskRuntimeEntity): DayRunEntity {
  return { ...runtime, dateKey: toLocalDateKey(new Date()) }
}

export const createRunsSlice: StateCreator<AppStore, [], [], RunsSlice> = (
  _set,
  get
) => ({
  runtimeValidUntil: endOfTodayISO(),

  setGoalFocus: (goalId, isFocused) => {
    void (async () => {
      if (isFocused) {
        await repo.putManualFocus(goalId, toLocalDateKey(new Date()))
      } else {
        await repo.deleteManualFocus(goalId)
        await repo.deleteAutoRunsForGoal(goalId)
      }
      // Focus-scope replan: fill newly-focused goals / reconcile the set.
      await get().replan("focus")
    })()
  },

  upsertTaskRuntime: (runtime) => {
    void (async () => {
      await repo.applyRunMutation({
        putRuns: [toDayRun(runtime)],
        // If manually re-added, clear any dismissal (tombstoned so it syncs).
        deleteDismissalTaskIds:
          runtime.source === "manual" ? [runtime.taskId] : undefined,
      })
      // Reconcile goalFocus focus statuses with the new runtime, but do not
      // auto-fill new tasks (partial scope skips step 5).
      await get().replan("partial")
    })()
  },

  removeTaskRuntime: (runtimeId) => {
    void (async () => {
      const removed = await repo.queryDayRun(runtimeId)
      if (!removed) return

      // Repeat-source runtimes can't be plainly removed: the ledger still
      // marks the date as "planned", so replan's step 2 would immediately
      // recreate the runtime (ghost reappearance). Route to skip semantics.
      if (removed.source === "repeatPolicy") {
        get().skipRepeatTask(runtimeId)
        return
      }

      // Record dismiss for auto-planned tasks so replan won't re-add them
      // today. Trigger runtimes need it too: they are re-derived from trigger
      // state on every replan, so without a dismissal the removal bounces
      // straight back.
      const isOpen =
        removed.arrangementStatus === "todo" ||
        removed.arrangementStatus === "inProgress"
      let dismiss =
        isOpen &&
        (removed.source === "default" || removed.source === "triggerPolicy")
      // Source alone doesn't tell the whole story: removing a *manual* run of
      // a trigger task leaves the fired trigger free to re-derive a runtime on
      // the very next replan — same bounce, different source. "Remove from
      // today" means "not today" regardless of how the item got there.
      if (!dismiss && isOpen) {
        const task = await repo.queryTaskById(removed.taskId)
        if (task?.trigger != null) dismiss = true
      }

      await repo.applyRunMutation({
        deleteRunIds: [runtimeId],
        putDismissals: dismiss
          ? [{ taskId: removed.taskId, dateKey: toLocalDateKey(new Date()) }]
          : undefined,
      })
      // Reconcile goalFocus after removal, but do not auto-fill the gap.
      await get().replan("partial")
    })()
  },

  transitionTaskStatus: (runtimeId, nextStatus) => {
    void (async () => {
      const runtime = await repo.queryDayRun(runtimeId)
      if (!runtime) return
      const prevStatus = runtime.arrangementStatus
      if (prevStatus === nextStatus) return

      const enteringDone = nextStatus === "done" && prevStatus !== "done"
      const leavingDone = prevStatus === "done" && nextStatus !== "done"
      const enteringInProgress =
        nextStatus === "inProgress" && prevStatus !== "inProgress"
      const leavingInProgress =
        prevStatus === "inProgress" && nextStatus !== "inProgress"

      try {
        // The whole write-set — run status, activities, counter, ledger point —
        // commits in one transaction (applyRunMutation), so the completedCount
        // invariant can't be torn apart by a crash or a concurrent reader.
        const mutation: repo.RunMutation = {
          putRuns: [{ ...runtime, arrangementStatus: nextStatus }],
        }

        const task = await repo.queryTaskById(runtime.taskId)
        if (task) {
          const now = new Date()
          const recordedDateKey = toLocalDateKey(now)
          const plannedForDate = isRepeatRuntime(runtime)
            ? runtime.plannedForDate
            : undefined
          const activitiesToAdd: ActivityEntity[] = []
          const activityIdsToRemove: ActivityID[] = []

          if (enteringInProgress) {
            activitiesToAdd.push({
              id: createStableActivityId("task-in-progress", runtime.id),
              kind: "task-in-progress",
              taskId: task.id,
              goalId: task.goalId,
              runtimeId: runtime.id,
              plannedForDate,
              recordedDateKey,
              recordedAt: now,
              taskTitleSnapshot: task.title,
            })
          }

          if (leavingInProgress && nextStatus === "todo") {
            activityIdsToRemove.push(
              createStableActivityId("task-in-progress", runtime.id)
            )
          }

          // completedCount is NOT touched here — it is a projection of the
          // records below (the task-done activity, and the ledger point for a
          // repeat run). Those records are written first, then the count is
          // recomputed from them, so it can never drift (the single-source-of-truth model).
          if (enteringDone) {
            activitiesToAdd.push({
              id: createStableActivityId("task-done", runtime.id),
              kind: "task-done",
              taskId: task.id,
              goalId: task.goalId,
              runtimeId: runtime.id,
              plannedForDate,
              recordedDateKey,
              recordedAt: now,
              taskTitleSnapshot: task.title,
            })
            if (plannedForDate) {
              mutation.ledgerMarks = [
                {
                  taskId: task.id,
                  dateKey: plannedForDate,
                  status: "completed",
                },
              ]
            }
          } else if (leavingDone) {
            activityIdsToRemove.push(
              createStableActivityId("task-done", runtime.id)
            )
            if (plannedForDate) {
              mutation.ledgerMarks = [
                { taskId: task.id, dateKey: plannedForDate, status: "planned" },
              ]
            }
          }

          mutation.putActivities = activitiesToAdd
          mutation.deleteActivityIds = activityIdsToRemove
          if (enteringDone || leavingDone) {
            mutation.recomputeCompletedCountFor = [task.id]
          }
        }

        await repo.applyRunMutation(mutation)
      } finally {
        await get().replan("partial")
      }
    })()
  },

  addTaskRun: (taskId) => {
    void (async () => {
      const runs = await repo.queryDayRunsByTask(taskId)
      const runMap = Object.fromEntries(
        runs.map((run) => [run.id, run])
      ) as Record<TaskRuntimeID, TaskRuntimeEntity>
      // A fresh runtime rather than reopening the done one: the finished run
      // keeps its task-done activity and its share of completedCount, and the
      // new run starts clean (own id ⇒ own activity when it completes). The id is
      // date-scoped, so it can never reuse an id whose completion is recorded on
      // an earlier day.
      const runtime: TaskRuntimeEntity = {
        id: createNextRunId(runMap, taskId, toLocalDateKey(new Date())),
        taskId,
        arrangementStatus: "todo",
        source: "manual",
      }

      await repo.applyRunMutation({
        putRuns: [toDayRun(runtime)],
        deleteDismissalTaskIds: [taskId],
      })
      await get().replan("partial")
    })()
  },

  skipRepeatTask: (runtimeId) => {
    void (async () => {
      const runtime = await repo.queryDayRun(runtimeId)
      if (!runtime) return

      try {
        const task = await repo.queryTaskById(runtime.taskId)
        await repo.applyRunMutation(
          buildRepeatSkipMutation(runtime, task, new Date())
        )
      } finally {
        await get().replan("partial")
      }
    })()
  },

  resolveRepeatDebt: (runtimeId, resolution) => {
    void (async () => {
      const runtime = await repo.queryDayRun(runtimeId)
      if (!runtime) return

      const plannedForDate = isRepeatRuntime(runtime)
        ? runtime.plannedForDate
        : undefined
      if (!plannedForDate) return

      try {
        const task = await repo.queryTaskById(runtime.taskId)
        if (!task) {
          await repo.applyRunMutation({ deleteRunIds: [runtimeId] })
          return
        }

        const now = new Date()
        const kind = resolution === "done" ? "task-done" : "repeat-skip"
        const activity: ActivityEntity = {
          id: createStableRepeatResolutionActivityId(
            kind,
            runtime.taskId,
            plannedForDate
          ),
          kind,
          taskId: task.id,
          goalId: task.goalId,
          runtimeId: runtime.id,
          plannedForDate,
          recordedDateKey: toLocalDateKey(now),
          recordedAt: now,
          taskTitleSnapshot: task.title,
        }

        await repo.applyRunMutation({
          deleteRunIds: [runtimeId],
          putActivities: [activity],
          ledgerMarks: [
            {
              taskId: task.id,
              dateKey: plannedForDate,
              status: resolution === "done" ? "completed" : "skipped",
            },
          ],
          // completedCount is the projection of the ledger; re-derive it in the
          // same transaction rather than incrementing in place.
          recomputeCompletedCountFor: [task.id],
        })
      } finally {
        await get().replan("partial")
      }
    })()
  },

  restoreSkippedRepeatTask: (runtimeId, taskId, dateKey) => {
    void (async () => {
      try {
        await repo.applyRunMutation({
          putRuns: [
            {
              id: runtimeId,
              taskId,
              arrangementStatus: "todo" as const,
              source: "repeatPolicy" as const,
              plannedForDate: dateKey,
              dateKey: toLocalDateKey(new Date()),
            },
          ],
          // A skip may have been recorded under either stable id shape:
          // runtime-derived (skipRepeatTask) or resolution-derived
          // (resolveRepeatDebt). Detail-page skips wrote no activity at all,
          // so deleting a missing id is a harmless no-op.
          deleteActivityIds: [
            createStableActivityId("repeat-skip", runtimeId),
            createStableRepeatResolutionActivityId(
              "repeat-skip",
              taskId,
              dateKey
            ),
          ],
          ledgerMarks: [{ taskId, dateKey, status: "planned" }],
        })
      } finally {
        await get().replan("partial")
      }
    })()
  },

  upsertStepsCompleted: (runtimeId, stepsCompleted) => {
    void (async () => {
      const runtime = await repo.queryDayRun(runtimeId)
      if (!runtime) return
      await repo.applyRunMutation({
        putRuns: [{ ...runtime, stepsCompleted }],
      })
    })()
  },
})
