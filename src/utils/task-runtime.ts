import type {
  RepeatPolicyTaskRuntime,
  TaskRuntimeEntity,
  TaskRuntimeSource,
  TaskRuntimeStatus,
} from "@/domain/entities/TaskRuntimeEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import {
  LocalDateKeySchema,
  type LocalDateKey,
} from "@/domain/value-objects/schemas"
import { classifyTask } from "@/utils/task-classify"
import { toLocalDateKey } from "@/utils/date"

const RUNTIME_ID_SEPARATOR = "::"
const RUN_ID_MARKER = "run"

/**
 * A runtime is *one run* of a task — not "the task's state today". A task can
 * hold several runtimes on the same day, and the id is what keeps them apart:
 *
 * - repeatPolicy → `taskId::YYYY-MM-DD`, one per occurrence (today's point plus
 *   any overdue debt points).
 * - a single-run task's run → plain `taskId`.
 * - a counter task's run → `taskId::run::YYYY-MM-DD::N`, the N-th run made on
 *   that day (see `counterRunId`).
 *
 * Every id is *intrinsic*: keyed by WHEN the run happens (its date), never by a
 * mutable count. So it is stable within a day yet never reused across days —
 * exactly like a repeat occurrence. Activity ids derive from the runtime id, so
 * each run records a distinct task-done entry and no completion can collide with
 * a past one regardless of undo/order.
 */
export function createTaskRuntimeId(
  taskId: TaskID,
  source?: TaskRuntimeSource,
  plannedForDate?: LocalDateKey
): TaskRuntimeID {
  if (source === "repeatPolicy" && plannedForDate) {
    return [taskId, plannedForDate].join(RUNTIME_ID_SEPARATOR)
  }

  return taskId
}

/**
 * The id of the N-th counter run on a given day. Date-scoped so it is stable for
 * a day but globally unique across the task's life — never derived from a count,
 * so undo/out-of-order completion can never make it collide with a past run.
 */
export function counterRunId(
  taskId: TaskID,
  dateKey: LocalDateKey,
  seq: number
): TaskRuntimeID {
  return [taskId, RUN_ID_MARKER, dateKey, String(seq)].join(
    RUNTIME_ID_SEPARATOR
  )
}

/**
 * The primary "today" run id of a task: a counter (total > 1) gets its
 * date-scoped first run of the day; a single-run task keeps the bare `taskId`.
 */
export function primaryTodayRunId(
  task: TaskGroupEntity,
  dateKey: LocalDateKey
): TaskRuntimeID {
  return task.total > 1
    ? counterRunId(task.id, dateKey, 1)
    : createTaskRuntimeId(task.id)
}

/**
 * The id for the next extra counter run made TODAY: the lowest unused sequence
 * for `dateKey`, so a removed run frees its slot without leaving a gap. Scoped to
 * the day, so it never reuses a sequence whose completion lives on another day.
 */
export function createNextRunId(
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  taskId: TaskID,
  dateKey: LocalDateKey
): TaskRuntimeID {
  let seq = 1
  while (taskRuntime[counterRunId(taskId, dateKey, seq)]) {
    seq += 1
  }
  return counterRunId(taskId, dateKey, seq)
}

export function parseRepeatRuntimeId(
  runtimeId: TaskRuntimeID
): { taskId: TaskID; plannedForDate: LocalDateKey } | null {
  const parts = runtimeId.split(RUNTIME_ID_SEPARATOR)
  if (parts.length !== 2) return null
  const [taskId, plannedForDateRaw] = parts
  if (!taskId || !plannedForDateRaw) return null
  const plannedForDate = LocalDateKeySchema.safeParse(plannedForDateRaw)
  if (!plannedForDate.success) return null
  return { taskId: taskId as TaskID, plannedForDate: plannedForDate.data }
}

export function isRepeatRuntime(
  runtime: TaskRuntimeEntity
): runtime is RepeatPolicyTaskRuntime {
  return runtime.source === "repeatPolicy"
}

export function isForcedRuntime(runtime: TaskRuntimeEntity): boolean {
  return (
    runtime.source === "duePolicy" ||
    runtime.source === "goalDuePolicy" ||
    runtime.source === "repeatPolicy"
  )
}

export function getRuntimePlannedForDate(
  runtime: TaskRuntimeEntity
): LocalDateKey | undefined {
  return isRepeatRuntime(runtime) ? runtime.plannedForDate : undefined
}

/**
 * Extract all runtimes for a given taskId, sorted by plannedForDate if applicable. Runtimes without a plannedForDate are sorted first.
 * @param taskRuntime The record of all task runtimes.
 * @param taskId The ID of the task to extract runtimes for.
 * @returns An array of TaskRuntimeEntity objects associated with the given taskId, ascending sorted by plannedForDate if applicable.
 */
export function getTaskRuntimeEntries(
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  taskId: TaskID
): TaskRuntimeEntity[] {
  return Object.values(taskRuntime)
    .filter((runtime) => runtime.taskId === taskId)
    .sort((left, right) => {
      const leftDate = getRuntimePlannedForDate(left) ?? ""
      const rightDate = getRuntimePlannedForDate(right) ?? ""
      return leftDate.localeCompare(rightDate)
    })
}
/**
 * Check if there are any runtime entries for a given task.
 * @param taskRuntime The record of task runtimes.
 * @param taskId The ID of the task to check.
 * @returns True if there are runtime entries for the task, false otherwise.
 */
export function hasTaskRuntimeForTask(
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  taskId: TaskID
): boolean {
  return getTaskRuntimeEntries(taskRuntime, taskId).length > 0
}

export function getPrimaryTaskRuntime(
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  taskId: TaskID
): TaskRuntimeEntity | undefined {
  return getTaskRuntimeEntries(taskRuntime, taskId)[0]
}

export function getTaskRuntimeIdsForTask(
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  taskId: TaskID
): TaskRuntimeID[] {
  return getTaskRuntimeEntries(taskRuntime, taskId).map((runtime) => runtime.id)
}

export function getRuntimeDateKey(
  runtime: TaskRuntimeEntity
): LocalDateKey | undefined {
  return getRuntimePlannedForDate(runtime)
}

/**
 * Pick the runtime representing "today's occurrence" that the task-detail
 * completion action (and its checklist) operates on. For repeat tasks: today's
 * planned point, falling back to a manual-pull runtime. For others: the single
 * todo/inProgress/done runtime. Shared by the TaskDetail component and its VM so
 * both agree on which runtime owns the step progress.
 */
export function selectCompletionRuntime(
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  task: TaskGroupEntity
): TaskRuntimeEntity | undefined {
  const runtimes = getTaskRuntimeEntries(taskRuntime, task.id)
  if (classifyTask(task) === "repeat") {
    const todayKey = toLocalDateKey(new Date())
    return (
      runtimes.find(
        (r) => isRepeatRuntime(r) && r.plannedForDate === todayKey
      ) ?? runtimes.find((r) => r.source === "manual")
    )
  }
  return runtimes.find(
    (r) =>
      r.arrangementStatus === "todo" ||
      r.arrangementStatus === "inProgress" ||
      r.arrangementStatus === "done"
  )
}

/**
 * The one status to show where a task gets a single row (sidebar, AllTasks, flow
 * nodes) even though it may hold several runs. Anything still being worked wins;
 * otherwise it only reads as done once *every* run is done — a task with one run
 * finished and another still open is not finished.
 */
export function aggregateRuntimeStatus(
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  taskId: TaskID
): TaskRuntimeStatus | undefined {
  const runs = getTaskRuntimeEntries(taskRuntime, taskId)
  if (runs.length === 0) return undefined
  if (runs.some((r) => r.arrangementStatus === "inProgress"))
    return "inProgress"
  if (runs.every((r) => r.arrangementStatus === "done")) return "done"
  return "todo"
}

/**
 * Whether the task can be given another item today: its occurrence budget must
 * have room for one more once you count what is *already on today's list*.
 *
 * Counting only `completedCount < total` would let a user stack up more open
 * items than the task has occurrences (pull it three times, finish none, pull
 * again). The open items are claims on the remaining budget, so they count.
 *
 * Repeat tasks are excluded: their occurrences belong to the ledger (one point
 * per day), so an extra same-day item is meaningless.
 */
export function canAddRunToday(
  task: TaskGroupEntity,
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
): boolean {
  if (task.repeat != null) return false
  const openRuns = getTaskRuntimeEntries(taskRuntime, task.id).filter(
    (runtime) => runtime.arrangementStatus !== "done"
  ).length
  return task.completedCount + openRuns < task.total
}

/** The most recently finished run — the one an "undo once" should retract. */
export function findLatestDoneRun(
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  taskId: TaskID
): TaskRuntimeEntity | undefined {
  const done = getTaskRuntimeEntries(taskRuntime, taskId).filter(
    (runtime) => runtime.arrangementStatus === "done"
  )
  return done[done.length - 1]
}

/**
 * Whether these runs are interchangeable — i.e. acting on any one of them has
 * the same effect, so asking the user *which* one would be a meaningless choice.
 * This is what decides whether a collapsed row can act directly or must open the
 * runs dialog.
 *
 * Two things break interchangeability:
 * - A repeat run is bound to a specific ledger date: retracting yesterday's debt
 *   point and retracting today's point are different acts.
 * - Mixed sources have different fates afterwards: a `manual` run returned to
 *   todo is preserved by the planner forever, while a `default` one is dropped
 *   and re-picked on the next full replan.
 *
 * Same-source non-repeat runs (the common case: a counter task run twice by
 * hand) are fully interchangeable — retracting either deletes one task-done
 * activity and decrements completedCount, full stop.
 */
export function areRunsInterchangeable(runs: TaskRuntimeEntity[]): boolean {
  if (runs.some(isRepeatRuntime)) return false
  return new Set(runs.map((runtime) => runtime.source)).size <= 1
}
