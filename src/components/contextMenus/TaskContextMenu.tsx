import type {
  TaskRuntimeStatus,
  TaskRuntimeSource,
} from "@/domain/entities/TaskRuntimeEntity"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TaskQuickActions } from "@/components/task/TaskQuickActions"
import { RowContextMenuProvider } from "@/components/shared/row-context-menu"

interface TaskContextMenuProps {
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
  canRunAgain?: boolean
  plannedForDate?: LocalDateKey
  onRequestDone?: () => void
  onSkipRepeat?: () => void
  onRestoreSkipped?: () => void
  onCustomizeCompletion?: () => void
  children: React.ReactNode
}

export function TaskContextMenu({
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
  children,
}: TaskContextMenuProps) {
  return (
    <RowContextMenuProvider>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <TaskQuickActions
            runtimeId={runtimeId}
            taskId={taskId}
            taskTitle={taskTitle}
            goalId={goalId}
            goalTitle={goalTitle}
            runtimeStatus={runtimeStatus}
            forcedDueAt={forcedDueAt}
            isRepeatTask={isRepeatTask}
            runtimeSource={runtimeSource}
            isSkippedRepeat={isSkippedRepeat}
            canRunAgain={canRunAgain}
            plannedForDate={plannedForDate}
            onRequestDone={onRequestDone}
            onSkipRepeat={onSkipRepeat}
            onRestoreSkipped={onRestoreSkipped}
            onCustomizeCompletion={onCustomizeCompletion}
          />
        </ContextMenuContent>
      </ContextMenu>
    </RowContextMenuProvider>
  )
}
