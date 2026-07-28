import { deleteGoal } from "@/commands/goal.commands"
import type { GoalID } from "@/domain/value-objects/types"
import type { GoalFocusStatus } from "@/domain/derived/GoalFocus"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { GoalQuickActions } from "@/components/goal/GoalQuickActions"
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog"
import { useLanguage } from "@/components/shared/language-provider"
import { RowContextMenuProvider } from "@/components/shared/row-context-menu"
import { useState } from "react"

interface GoalContextMenuProps {
  goalId: GoalID
  goalTitle: string
  isFocused: boolean
  isDone: boolean
  isForced?: boolean
  focusStatuses?: GoalFocusStatus[]
  children: React.ReactNode
}

export function GoalContextMenu({
  goalId,
  goalTitle,
  isFocused,
  isDone,
  isForced,
  focusStatuses,
  children,
}: GoalContextMenuProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const { t } = useLanguage()

  return (
    // The provider must sit OUTSIDE the trigger: `asChild` merges its props
    // (onContextMenu, ref) into its single child, and a context provider is not
    // a DOM element — it would silently swallow them and kill the menu.
    <RowContextMenuProvider>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <GoalQuickActions
            goalId={goalId}
            goalTitle={goalTitle}
            isFocused={isFocused}
            isDone={isDone}
            isForced={isForced}
            focusStatuses={focusStatuses}
            onRequestDelete={() => setIsDeleteOpen(true)}
          />
        </ContextMenuContent>
      </ContextMenu>
      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={t.goalDetail.deleteGoalTitle}
        description={t.goalDetail.deleteGoalDescription}
        onConfirm={() => {
          void deleteGoal(goalId, t.commands.goalDeleteFailed)
        }}
      />
    </RowContextMenuProvider>
  )
}
