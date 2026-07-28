import { Star, StarOff, ExternalLink, Trash2 } from "lucide-react"
import { useNavigate } from "react-router"
import { useAppStore } from "@/store/app-store"
import type { GoalID } from "@/domain/value-objects/types"
import type { GoalFocusStatus } from "@/domain/derived/GoalFocus"
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import { GoalForcedHoverCard } from "@/components/shared/ForcedReasonHoverCard"
import { useLanguage } from "@/components/shared/language-provider"

interface GoalQuickActionsProps {
  goalId: GoalID
  goalTitle: string
  isFocused: boolean
  isDone: boolean
  isForced?: boolean
  focusStatuses?: GoalFocusStatus[]
  onRequestDelete?: () => void
}

export function GoalQuickActions({
  goalId,
  goalTitle,
  isFocused,
  isDone,
  isForced,
  focusStatuses,
  onRequestDelete,
}: GoalQuickActionsProps) {
  const navigate = useNavigate()
  const setGoalFocus = useAppStore((s) => s.setGoalFocus)
  const { t } = useLanguage()

  return (
    <>
      {/* Focus actions (only for not-done goals) */}
      {!isDone && (
        <>
          <ContextMenuGroup>
            {isFocused ? (
              isForced && focusStatuses && focusStatuses.length > 0 ? (
                <GoalForcedHoverCard
                  goalId={goalId}
                  goalTitle={goalTitle}
                  statuses={focusStatuses}
                >
                  <ContextMenuItem
                    disabled
                    onSelect={(e) => e.preventDefault()}
                  >
                    <StarOff />
                    {t.actions.unfocus}
                  </ContextMenuItem>
                </GoalForcedHoverCard>
              ) : (
                <ContextMenuItem
                  data-testid="ctx-goal-unfocus"
                  onSelect={() => setGoalFocus(goalId, false)}
                >
                  <StarOff />
                  {t.actions.unfocus}
                </ContextMenuItem>
              )
            ) : (
              <ContextMenuItem
                data-testid="ctx-goal-focus"
                onSelect={() => setGoalFocus(goalId, true)}
              >
                <Star />
                {t.actions.focusToday}
              </ContextMenuItem>
            )}
          </ContextMenuGroup>

          <ContextMenuSeparator />
        </>
      )}

      {/* Navigation */}
      <ContextMenuGroup>
        <ContextMenuItem
          data-testid="ctx-goal-view"
          onSelect={() => navigate(`/goals/${goalId}`)}
        >
          <ExternalLink />
          {t.actions.viewDetails}
        </ContextMenuItem>
      </ContextMenuGroup>

      <ContextMenuSeparator />

      {/* Destructive */}
      <ContextMenuGroup>
        <ContextMenuItem
          data-testid="ctx-goal-delete"
          variant="destructive"
          onSelect={() => onRequestDelete?.()}
        >
          <Trash2 />
          {t.common.delete}
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  )
}
