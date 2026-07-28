import { useCallback, useState } from "react"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog"
import { useLanguage } from "@/components/shared/language-provider"
import {
  planTaskGoalRebind,
  rebindTaskGoal,
  type TaskGoalRebindPlan,
} from "@/commands/task.commands"
import type { GoalID, TaskID } from "@/domain/value-objects/types"

type PendingRebind = {
  taskId: TaskID
  toGoalId: GoalID | undefined
  plan: TaskGoalRebindPlan
}

/**
 * Orchestrates re-binding a task to another goal (or detaching to standalone).
 * The only confirmation it may need is a normalization confirm — when the
 * destination can't hold the task's repeat / trigger rule, moving it resets the
 * task to single-run. (Detaching bridges the task's dependents up to all of its
 * parents automatically, so no parent-picker is needed.)
 *
 * Returns `requestRebind` to start the flow and `dialogs` to render once in the
 * host component. Reusable across TaskDetail and the AllTasks table.
 */
export function useTaskGoalRebind() {
  const { t } = useLanguage()
  const [pending, setPending] = useState<PendingRebind | null>(null)

  const reset = useCallback(() => setPending(null), [])

  const execute = useCallback(
    async (target: PendingRebind) => {
      const ok = await rebindTaskGoal(
        target.taskId,
        target.toGoalId,
        { normalize: target.plan.requiresNormalization },
        t.goalRebind.moveFailed
      )
      if (ok) {
        toast.success(t.goalRebind.moved)
      }
      reset()
    },
    [reset, t]
  )

  const requestRebind = useCallback(
    async (taskId: TaskID, toGoalId: GoalID | undefined) => {
      const plan = await planTaskGoalRebind(taskId, toGoalId)
      if (!plan) {
        return
      }
      const target: PendingRebind = { taskId, toGoalId, plan }
      if (plan.requiresNormalization) {
        setPending(target)
      } else {
        await execute(target)
      }
    },
    [execute]
  )

  const dialogs = (
    <ConfirmDeleteDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) reset()
      }}
      title={t.goalRebind.normalizeTitle}
      description={t.goalRebind.normalizeDescription}
      confirmLabel={t.common.continue}
      onConfirm={() => {
        if (pending) void execute(pending)
      }}
    />
  )

  return { requestRebind, dialogs }
}
