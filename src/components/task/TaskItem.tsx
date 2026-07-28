import * as React from "react"
import { Badge } from "../ui/badge"
import { cn } from "@/lib/utils"
import { Link, useNavigate } from "react-router"
import { useLanguage } from "@/components/shared/language-provider"
import { TaskStepItem } from "@/components/task/TaskStepItem"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "../ui/button"
import { ButtonGroup, ButtonGroupText } from "../ui/button-group"
import { useState } from "react"
import {
  CalendarMinus,
  ChevronDown,
  ChevronUp,
  History,
  Layers,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { RowMenuButton } from "@/components/shared/row-context-menu"
import { useHasRowContextMenu } from "@/components/shared/row-context-menu-context"

interface TaskItemProps {
  taskId: string
  title: string
  goalId?: string
  goalTitle: string
  /** CSS color of the goal's tag; renders a leading dot before the goal name. */
  goalTagColor?: string
  duration?: number // in minutes
  className?: string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
  /** Leading element rendered at the start (e.g. icon button or checkbox). */
  leading?: React.ReactNode
  /** Optional action element rendered at the trailing edge (e.g. "Add to Today" button). */
  action?: React.ReactNode
  /** Localized display label for repeat plan date. */
  plannedForLabel?: string
  /** Localized "done Nx today"; only set when several items collapse into this row. */
  runsLabel?: string
  /**
   * Makes the runs badge clickable (e.g. open the runs / completion-records
   * dialog for a collapsed row). Click never triggers the row navigation.
   */
  onRunsBadgeClick?: () => void
  /** Localized "since <day>" for an in-progress item carried over from an earlier day. */
  carriedOverLabel?: string
  /** Localized "excluded from today" marker for a task the user removed from today. */
  dismissedLabel?: string
  /** Due date display text, e.g. "Apr 10, 2026 14:30". */
  dueLabel?: string
  /** How to render the due label: badge (MyTasks) or inline red text (Home). */
  dueVariant?: "badge" | "inline-destructive"
  /** Forwarded to the underlying anchor element. */
  ref?: React.Ref<HTMLDivElement>
  steps?: { id: string; title: string; done: boolean }[]
  /**
   * When true the steps badge shows completed progress (done / total);
   * otherwise it shows the plain step count. The caller decides this from the
   * runtime status, keeping runtime concerns out of this render component.
   */
  showStepProgress?: boolean
  /**
   * Called when a step's checkbox is toggled. Its presence is also the edit
   * gate: when omitted the step list renders read-only (no checkboxes), so
   * callers pass it only for states where steps may be edited (e.g. inProgress).
   */
  onStepsCheckChange?: (stepId: string, done: boolean) => void
  /** E2E anchor; flows to the row container via `...rest`. */
  "data-testid"?: string
}

export function TaskItem({
  taskId,
  title,
  goalId,
  goalTitle = "",
  goalTagColor,
  duration,
  className,
  onClick,
  leading,
  action,
  plannedForLabel,
  runsLabel,
  onRunsBadgeClick,
  carriedOverLabel,
  dismissedLabel,
  dueLabel,
  dueVariant = "badge",
  ref,
  steps,
  showStepProgress = false,
  onStepsCheckChange,
  ...rest
}: TaskItemProps) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const hasContextMenu = useHasRowContextMenu()
  const [showCollapsedSteps, setShowCollapsedSteps] = useState(false)
  return (
    <Collapsible
      open={showCollapsedSteps}
      onOpenChange={setShowCollapsedSteps}
      asChild
    >
      <div className={cn("rounded-lg border", className)} ref={ref} {...rest}>
        {/* Header row: the Link carries only navigation + non-interactive summary,
            with the expand trigger and actions as siblings (an anchor may not
            nest buttons). The context menu binds to the CONTAINER above, not to
            the Link, so a right-click anywhere on the row works and the "⋮"
            button's dispatched event reaches it by plain bubbling. */}
        <div className="flex items-center gap-3 p-3">
          <Link
            to={`/tasks/${taskId}`}
            className="flex flex-1 cursor-pointer items-center gap-3 no-underline"
            onClick={onClick}
          >
            {leading}

            <div className="flex flex-1 flex-col gap-0.5">
              <div className="paragraph-small text-foreground">
                <span className="truncate">{title}</span>
              </div>
              {goalId ? (
                <button
                  type="button"
                  className="paragraph-mini inline-flex cursor-pointer items-center gap-1.5 self-start text-left text-muted-foreground hover:text-foreground hover:underline"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    navigate(`/goals/${goalId}`)
                  }}
                >
                  {goalTagColor && (
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: goalTagColor }}
                    />
                  )}
                  {goalTitle}
                </button>
              ) : (
                <div className="paragraph-mini flex items-center gap-1.5 text-muted-foreground">
                  {goalTagColor && (
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: goalTagColor }}
                    />
                  )}
                  {goalTitle}
                </div>
              )}
            </div>

            {duration !== undefined && (
              <Badge size="lg">
                {duration} {t.common.mins}
              </Badge>
            )}
            {plannedForLabel && (
              <Badge size="lg" variant="outline">
                {plannedForLabel}
              </Badge>
            )}
            {carriedOverLabel && (
              <Badge size="lg" variant="outline">
                <History data-icon="inline-start" />
                {carriedOverLabel}
              </Badge>
            )}
            {dismissedLabel && (
              <Badge
                size="lg"
                variant="secondary"
                data-testid="badge-dismissed"
              >
                <CalendarMinus data-icon="inline-start" />
                {dismissedLabel}
              </Badge>
            )}
            {runsLabel &&
              (onRunsBadgeClick ? (
                // Same pattern as the goal chip above: an interactive element
                // inside the row link that intercepts its own clicks.
                <button
                  type="button"
                  data-testid={`runs-badge-${taskId}`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onRunsBadgeClick()
                  }}
                >
                  <Badge
                    size="lg"
                    variant="outline"
                    className="transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Layers data-icon="inline-start" />
                    {runsLabel}
                  </Badge>
                </button>
              ) : (
                <Badge size="lg" variant="outline">
                  {/* Same stacked icon as the task-detail "multiple items"
                      button: both mean "this stands for several items". */}
                  <Layers data-icon="inline-start" />
                  {runsLabel}
                </Badge>
              ))}
            {dueLabel && dueVariant === "badge" && (
              <Badge size="lg" variant="destructive">
                {t.common.due} {dueLabel}
              </Badge>
            )}
            {dueLabel && dueVariant === "inline-destructive" && (
              <span className="ml-auto shrink-0 text-destructive">
                {t.common.due} {dueLabel}
              </span>
            )}
          </Link>

          {steps && steps.length > 0 && (
            <ButtonGroup className="shrink-0">
              <ButtonGroupText>
                {showStepProgress
                  ? `${steps.filter((s) => s.done).length} / ${steps.length}`
                  : t.common.steps(steps.length)}
              </ButtonGroupText>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="icon">
                  {showCollapsedSteps ? <ChevronUp /> : <ChevronDown />}
                </Button>
              </CollapsibleTrigger>
            </ButtonGroup>
          )}

          {action}
          {hasContextMenu && <RowMenuButton />}
        </div>
        <CollapsibleContent className="border-t px-3 py-2">
          <ScrollArea className="h-24">
            <div className="space-y-1">
              {steps?.map((step) => (
                <TaskStepItem
                  key={step.id}
                  {...step}
                  showCheckbox={!!onStepsCheckChange}
                  onToggleDone={
                    onStepsCheckChange
                      ? (id) => onStepsCheckChange(id, !step.done)
                      : undefined
                  }
                />
              ))}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
