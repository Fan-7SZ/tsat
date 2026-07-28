import {
  CalendarPlus,
  Plus,
  CheckCircle,
  Undo2,
  RotateCcw,
  CalendarMinus,
  ExternalLink,
  ListChecks,
  SkipForward,
} from "lucide-react"
import { useNavigate } from "react-router"
import { useAppStore } from "@/store/app-store"
import type {
  TaskRuntimeStatus,
  TaskRuntimeSource,
} from "@/domain/entities/TaskRuntimeEntity"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import { TaskForcedHoverCard } from "@/components/shared/ForcedReasonHoverCard"
import { useLanguage } from "@/components/shared/language-provider"

interface TaskQuickActionsProps {
  runtimeId: TaskRuntimeID
  taskId: TaskID
  taskTitle?: string
  goalId?: string
  goalTitle?: string
  runtimeStatus: TaskRuntimeStatus | null
  forcedDueAt?: Date
  isRepeatTask?: boolean
  runtimeSource?: TaskRuntimeSource
  isSkippedRepeat?: boolean
  /** Done counter task with occurrences left: offer "do it again". */
  canRunAgain?: boolean
  plannedForDate?: LocalDateKey
  /** Called instead of directly marking done — allows the parent to show a checklist guard. */
  onRequestDone?: () => void
  onSkipRepeat?: () => void
  onRestoreSkipped?: () => void
  /** Skipped row collapsing several points: open the per-point completion dialog. */
  onCustomizeCompletion?: () => void
}

export function TaskQuickActions({
  runtimeId,
  taskId,
  taskTitle,
  goalId,
  goalTitle,
  runtimeStatus,
  forcedDueAt,
  isRepeatTask,
  runtimeSource,
  isSkippedRepeat,
  canRunAgain,
  plannedForDate,
  onRequestDone,
  onSkipRepeat,
  onRestoreSkipped,
  onCustomizeCompletion,
}: TaskQuickActionsProps) {
  const navigate = useNavigate()
  const upsertTaskRuntime = useAppStore((s) => s.upsertTaskRuntime)
  const transitionTaskStatus = useAppStore((s) => s.transitionTaskStatus)
  const addTaskRun = useAppStore((s) => s.addTaskRun)
  const removeTaskRuntime = useAppStore((s) => s.removeTaskRuntime)
  const { t } = useLanguage()

  const handleMarkDone = () => {
    if (onRequestDone) {
      onRequestDone()
    } else {
      transitionTaskStatus(runtimeId, "done")
    }
  }

  return (
    <>
      {/* Status actions */}
      <ContextMenuGroup>
        {runtimeStatus === null && !isRepeatTask && !isSkippedRepeat && (
          <ContextMenuItem
            data-testid="ctx-task-add"
            onSelect={() =>
              upsertTaskRuntime({
                id: runtimeId,
                taskId,
                arrangementStatus: "todo",
                source: "manual",
              })
            }
          >
            <CalendarPlus />
            {t.actions.addToToday}
          </ContextMenuItem>
        )}

        {runtimeStatus === "todo" && (
          <>
            <ContextMenuItem
              data-testid="ctx-task-inprogress"
              onSelect={() => transitionTaskStatus(runtimeId, "inProgress")}
            >
              <Plus />
              {t.actions.markInProgress}
            </ContextMenuItem>
            <ContextMenuItem
              data-testid="ctx-task-done"
              onSelect={handleMarkDone}
            >
              <CheckCircle />
              {t.actions.markDone}
            </ContextMenuItem>
          </>
        )}

        {runtimeStatus === "inProgress" && (
          <>
            <ContextMenuItem
              data-testid="ctx-task-done"
              onSelect={handleMarkDone}
            >
              <CheckCircle />
              {t.actions.markDone}
            </ContextMenuItem>
            <ContextMenuItem
              data-testid="ctx-task-back-todo"
              onSelect={() => transitionTaskStatus(runtimeId, "todo")}
            >
              <Undo2 />
              {t.actions.moveBackToTodo}
            </ContextMenuItem>
          </>
        )}

        {runtimeStatus === "done" && (
          <>
            {/* "Do it again" keeps the completion just recorded and reopens the
                task for another run; the two "move back" items below retract it. */}
            {canRunAgain && (
              <ContextMenuItem
                data-testid="ctx-task-again"
                onSelect={() => addTaskRun(taskId)}
              >
                <RotateCcw />
                {t.actions.runAgain}
              </ContextMenuItem>
            )}
            <ContextMenuItem
              data-testid="ctx-task-back-inprogress"
              onSelect={() => transitionTaskStatus(runtimeId, "inProgress")}
            >
              <Plus />
              {t.actions.moveBackToInProgress}
            </ContextMenuItem>
            <ContextMenuItem
              data-testid="ctx-task-back-todo"
              onSelect={() => transitionTaskStatus(runtimeId, "todo")}
            >
              <Undo2 />
              {t.actions.moveBackToTodo}
            </ContextMenuItem>
          </>
        )}

        {runtimeStatus !== null &&
          (runtimeSource === "repeatPolicy" ? (
            // Repeat-imported task: show Skip instead of Exclude
            <ContextMenuItem
              data-testid="ctx-task-skip"
              onSelect={() => onSkipRepeat?.()}
            >
              <SkipForward />
              {t.actions.skip}
            </ContextMenuItem>
          ) : forcedDueAt ? (
            // Due-forced runs (the task's own due, or its goal's) cannot be
            // removed from today: the due policy would just pull them straight
            // back. `forcedDueAt` is set by the VM only for duePolicy /
            // goalDuePolicy, so its presence IS the "not dismissible" signal —
            // the hovercard explains which due is holding it here.
            <TaskForcedHoverCard
              taskId={taskId}
              taskTitle={taskTitle ?? ""}
              dueAt={forcedDueAt}
              goalId={goalId}
              goalTitle={goalTitle}
            >
              <ContextMenuItem
                data-testid="ctx-task-exclude-disabled"
                disabled
                onSelect={(e) => e.preventDefault()}
              >
                <CalendarMinus />
                {t.actions.excludeFromToday}
              </ContextMenuItem>
            </TaskForcedHoverCard>
          ) : (
            <ContextMenuItem
              data-testid="ctx-task-exclude"
              onSelect={() => removeTaskRuntime(runtimeId)}
            >
              <CalendarMinus />
              {t.actions.excludeFromToday}
            </ContextMenuItem>
          ))}

        {/* Skipped repeat task: a single skip restores directly; a row that
            collapses several points opens the per-point completion dialog. */}
        {isSkippedRepeat && onRestoreSkipped && (
          <ContextMenuItem
            data-testid="ctx-task-restore"
            onSelect={onRestoreSkipped}
          >
            <Undo2 />
            {t.actions.restoreToTodo}
          </ContextMenuItem>
        )}
        {isSkippedRepeat && onCustomizeCompletion && (
          <ContextMenuItem
            data-testid="ctx-task-customize"
            onSelect={onCustomizeCompletion}
          >
            <ListChecks />
            {t.taskDetail.customCompletion}
          </ContextMenuItem>
        )}

        {/* Future repeat plan: show Add to Today */}
        {runtimeStatus === null &&
          isRepeatTask &&
          !isSkippedRepeat &&
          plannedForDate && (
            <ContextMenuItem
              data-testid="ctx-task-add-future"
              onSelect={() =>
                upsertTaskRuntime({
                  id: runtimeId,
                  taskId,
                  arrangementStatus: "todo",
                  source: "repeatPolicy",
                  plannedForDate,
                })
              }
            >
              <CalendarPlus />
              {t.actions.addToToday}
            </ContextMenuItem>
          )}
      </ContextMenuGroup>

      <ContextMenuSeparator />

      {/* Navigation */}
      <ContextMenuGroup>
        <ContextMenuItem
          data-testid="ctx-task-view"
          onSelect={() => navigate(`/tasks/${taskId}`)}
        >
          <ExternalLink />
          {t.actions.viewDetails}
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  )
}
