import * as React from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Link, useNavigate } from "react-router"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/shared/language-provider"
import { PullUpInfoPopover } from "@/components/task/PullUpInfoPopover"

/** One pull-up occurrence of a trigger task (a single fire date). */
export interface TriggerPullUp {
  /** Stable key (e.g. the date key). */
  key: string
  /** Localized pull-up date label, e.g. "Jun 18 (Thu)". */
  label: string
}

interface TriggerTaskItemProps {
  taskId: string
  title: string
  goalId?: string
  goalTitle: string
  duration?: number // in minutes
  /**
   * Pull-up occurrences, sorted nearest-first by the caller. The badge always
   * shows the nearest date; when there is more than one, a chevron expands a
   * date-only list of the remaining pull-ups.
   */
  pullUps: TriggerPullUp[]
  /**
   * True when the task is pulled up by *its goal's* trigger (rather than its
   * own task-level trigger). Renders a muted goal marker explaining the source.
   */
  byGoalTrigger?: boolean
  /** Localized cadence summary for the pull-up info popover (e.g. "Weekly on Thu"). */
  ruleSummary?: string
  /** Localized validity window label for the info popover (task triggers). */
  windowLabel?: string
  /** Whether the stack starts expanded (multi only). */
  defaultExpanded?: boolean
  className?: string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
  /** Forwarded to the underlying anchor element. */
  ref?: React.Ref<HTMLAnchorElement>
}

/**
 * Task item for trigger-pulled tasks. Mirrors {@link TaskItem}'s card layout but
 * surfaces the pull-up date(s) — a trigger fires on a rule rather than a fixed
 * due date. When the same task has several upcoming pull-ups they stack under a
 * collapsible header instead of repeating the whole card. Goal-triggered tasks
 * show a muted goal marker with an explanatory tooltip.
 */
export function TriggerTaskItem({
  taskId,
  title,
  goalId,
  goalTitle = "",
  duration,
  pullUps,
  byGoalTrigger = false,
  ruleSummary,
  windowLabel,
  defaultExpanded = false,
  className,
  onClick,
  ref,
  ...rest
}: TriggerTaskItemProps) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [expanded, setExpanded] = React.useState(defaultExpanded)

  const isStack = pullUps.length > 1
  const nearest = pullUps[0]

  return (
    <div className={cn("overflow-hidden rounded-lg border", className)}>
      <Link
        to={`/tasks/${taskId}`}
        ref={ref}
        className={cn(
          "block no-underline",
          "flex cursor-pointer items-center gap-3 p-3"
        )}
        onClick={onClick}
        {...rest}
      >
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="paragraph-small text-foreground">
            <span className="truncate">{title}</span>
          </div>
          {goalId ? (
            <button
              type="button"
              className="paragraph-mini cursor-pointer self-start text-left text-muted-foreground hover:text-foreground hover:underline"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                navigate(`/goals/${goalId}`)
              }}
            >
              {goalTitle}
            </button>
          ) : (
            <div className="paragraph-mini text-muted-foreground">
              {goalTitle}
            </div>
          )}
        </div>

        {duration !== undefined && (
          <Badge size="lg">
            {duration} {t.common.mins}
          </Badge>
        )}

        {/* Nearest pull-up date (always shown, same badge as the single case). */}
        <Badge size="lg" variant="outline">
          {t.tasks.pullUpLabel(nearest.label)}
        </Badge>

        {ruleSummary && (
          <PullUpInfoPopover
            kind={byGoalTrigger ? "goalTrigger" : "trigger"}
            ruleSummary={ruleSummary}
            pullUpLabel={nearest.label}
            windowLabel={windowLabel}
          />
        )}

        {isStack && (
          // A chevron toggles the date-only list of the remaining pull-ups.
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t.tasks.alsoTriggersOn}
                  aria-expanded={expanded}
                  className="inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setExpanded((v) => !v)
                  }}
                >
                  {expanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6} className="max-w-60">
                <p className="paragraph-small">{t.tasks.alsoTriggersOn}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Link>

      {isStack && expanded && (
        <ul className="border-t">
          {pullUps.slice(1).map((pullUp) => (
            <li key={pullUp.key} className="px-3 py-2">
              <span className="paragraph-small text-muted-foreground">
                {pullUp.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
