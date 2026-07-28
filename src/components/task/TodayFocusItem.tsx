import { Link } from "react-router"
import { Button } from "../ui/button"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Plus, Check, Lock, EyeOff } from "lucide-react"
import type { GoalID } from "@/domain/value-objects/types"
import type { GoalFocusStatus } from "@/domain/derived/GoalFocus"
import {
  AllTasksDismissedHoverCard,
  GoalForcedHoverCard,
} from "@/components/shared/ForcedReasonHoverCard"
import { useLanguage } from "@/components/shared/language-provider"
import { RowMenuButton } from "@/components/shared/row-context-menu"
import { useHasRowContextMenu } from "@/components/shared/row-context-menu-context"

interface TodayFocusItemProps extends React.ComponentProps<"div"> {
  id: GoalID
  title: string
  progress: number
  isAdded: boolean
  due?: string
  className?: string
  isForced?: boolean
  focusStatuses?: GoalFocusStatus[]
  /**
   * Every unfinished task of this goal is removed from today, so focusing it
   * could not surface anything — the toggle is disabled instead of flipping
   * with no visible effect.
   */
  allTasksDismissed?: boolean
  onAddedChange?: (isAdded: boolean) => void
}

export function TodayFocusItem({
  id,
  title,
  progress,
  isAdded,
  due,
  className,
  isForced,
  focusStatuses,
  allTasksDismissed,
  onAddedChange,
  ref,
  ...rest
}: TodayFocusItemProps) {
  const isAddDisabled = (isForced && isAdded) || Boolean(allTasksDismissed)

  const handleToggleAdded = () => {
    if (isAddDisabled) return
    onAddedChange?.(!isAdded)
  }

  const { t } = useLanguage()
  const hasContextMenu = useHasRowContextMenu()

  const toggleButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={allTasksDismissed ? t.home.focusAllTasksDismissed : undefined}
      data-testid={
        allTasksDismissed ? `focus-toggle-disabled-${id}` : `focus-toggle-${id}`
      }
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        handleToggleAdded()
      }}
      disabled={isAddDisabled}
      className="cursor-pointer"
    >
      {isForced && isAdded ? (
        <Lock />
      ) : allTasksDismissed ? (
        // Locked because every task was removed from today, not by a policy —
        // same precedence as the hover card below, so icon and reason agree.
        <EyeOff />
      ) : isAdded ? (
        <Check />
      ) : (
        <Plus />
      )}
    </Button>
  )

  return (
    // Container, not an anchor: the toggle and the "⋮" button are real buttons
    // and an anchor may not nest them, and the context menu binds here so a
    // right-click works across the whole row.
    <div
      ref={ref}
      {...rest}
      className={cn(
        "flex items-center gap-4 rounded-lg border bg-card p-4",
        className
      )}
    >
      {isForced && isAdded && focusStatuses && focusStatuses.length > 0 ? (
        <GoalForcedHoverCard
          goalId={id}
          goalTitle={title}
          statuses={focusStatuses}
        >
          {toggleButton}
        </GoalForcedHoverCard>
      ) : allTasksDismissed ? (
        <AllTasksDismissedHoverCard>{toggleButton}</AllTasksDismissedHoverCard>
      ) : (
        toggleButton
      )}
      <Link
        to={`/goals/${id}`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 no-underline"
      >
        <div className="paragraph-small-medium flex">
          <span className="text-card-foreground">{title}</span>
          {due && (
            <span className="ml-auto text-destructive">
              {t.common.due} {due}
            </span>
          )}
        </div>
        <div className="w-full">
          <Progress value={progress} />
        </div>
      </Link>
      {hasContextMenu && <RowMenuButton />}
    </div>
  )
}
