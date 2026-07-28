import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/shared/language-provider"
import type {
  TaskRuntimeSource,
  TaskRuntimeStatus,
} from "@/domain/entities/TaskRuntimeEntity"
import { RUNTIME_STATUS_ICON } from "@/utils/task-runtime-icon"
import { STATUS_TONE } from "@/utils/status-tone"

export interface TaskRuntimeBadgeProps {
  /** Today's runtime status; render the badge only when in a runtime. */
  status: TaskRuntimeStatus
  /** When provided, hovering explains how the task was pulled into today. */
  source?: TaskRuntimeSource
}

/**
 * "Today's runtime" state indicator (待办 / 进行中 / 完成), shown alongside the
 * task-level completion badge whenever the task has a runtime for today.
 * Presentational — driven entirely by props.
 */
export function TaskRuntimeBadge({ status, source }: TaskRuntimeBadgeProps) {
  const { t } = useLanguage()

  const config = {
    todo: { label: t.status.todo, className: "text-muted-foreground" },
    inProgress: {
      label: t.status.inProgress,
      className: STATUS_TONE.amber,
    },
    done: {
      label: t.taskDetail.todayDone,
      className: STATUS_TONE.green,
    },
  }[status]
  const StatusIcon = RUNTIME_STATUS_ICON[status]

  const badge = (
    <Badge size="lg" variant="outline" className={cn(config.className)}>
      <StatusIcon data-icon="inline-start" />
      {config.label}
    </Badge>
  )

  if (source == null) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className="max-w-80">
          <p className="paragraph-small">{t.runtimeSource[source]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
