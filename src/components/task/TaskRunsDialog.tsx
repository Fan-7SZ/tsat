import { Plus, SkipForward, Trash } from "lucide-react"

import type { TaskRuntimeStatus } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskRuntimeID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import type { RepeatDebtResolution } from "@/store/slices/runs.slice"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RepeatDebtPopover } from "@/components/task/RepeatDebtPopover"
import { ActionTooltip } from "@/components/shared/ActionTooltip"
import { useLanguage } from "@/components/shared/language-provider"

/** What the row's trailing control does, matching that item's affordance elsewhere. */
export type TaskRunTrailing =
  | { kind: "remove" }
  | { kind: "skip" }
  | { kind: "debt"; plannedForDate: LocalDateKey }

export interface TaskRunRow {
  runtimeId: TaskRuntimeID
  /** What distinguishes this item: its date (repeat) or how it was pulled in. */
  label: string
  status: TaskRuntimeStatus
  trailing: TaskRunTrailing
}

export interface TaskRunsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  runs: TaskRunRow[]
  onChangeStatus: (runtimeId: TaskRuntimeID, status: TaskRuntimeStatus) => void
  onRemove: (runtimeId: TaskRuntimeID) => void
  onSkip: (runtimeId: TaskRuntimeID) => void
  onResolveDebt: (
    runtimeId: TaskRuntimeID,
    resolution: RepeatDebtResolution
  ) => void
  /** Offered only while the task's occurrence budget has room for one more. */
  onAddRun?: () => void
}

/**
 * The one place a task's several items of today can be acted on individually.
 * Anywhere a task collapses to a single row — the done bucket, the task-detail
 * header — that row cannot map to one item, so its action opens this instead of
 * silently picking one.
 *
 * Status is switchable on every row (that is allowed on the tasks page too), but
 * the trailing control per row mirrors what that item supports elsewhere: a
 * counter item is removed, today's repeat point is skipped, and a repeat debt
 * point opens the same resolve/ignore popover it shows in the list.
 */
export function TaskRunsDialog({
  open,
  onOpenChange,
  runs,
  onChangeStatus,
  onRemove,
  onSkip,
  onResolveDebt,
  onAddRun,
}: TaskRunsDialogProps) {
  const { t } = useLanguage()

  const statusLabel: Record<TaskRuntimeStatus, string> = {
    todo: t.status.todo,
    inProgress: t.status.inProgress,
    done: t.status.done,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.taskRuns.title}</DialogTitle>
          <DialogDescription>{t.taskRuns.description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.taskRuns.columnRun}</TableHead>
                <TableHead>{t.taskRuns.columnStatus}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.runtimeId}>
                  <TableCell>{run.label}</TableCell>
                  <TableCell>
                    <Select
                      value={run.status}
                      onValueChange={(next) =>
                        onChangeStatus(run.runtimeId, next as TaskRuntimeStatus)
                      }
                    >
                      <SelectTrigger
                        data-testid={`run-status-${run.runtimeId}`}
                        className="h-8 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          data-testid="run-status-opt-todo"
                          value="todo"
                        >
                          {statusLabel.todo}
                        </SelectItem>
                        <SelectItem
                          data-testid="run-status-opt-inProgress"
                          value="inProgress"
                        >
                          {statusLabel.inProgress}
                        </SelectItem>
                        <SelectItem
                          data-testid="run-status-opt-done"
                          value="done"
                        >
                          {statusLabel.done}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {run.trailing.kind === "debt" ? (
                      <RepeatDebtPopover
                        plannedForDate={run.trailing.plannedForDate}
                        onMarkDone={() => onResolveDebt(run.runtimeId, "done")}
                        onIgnore={() => onResolveDebt(run.runtimeId, "skip")}
                      />
                    ) : run.trailing.kind === "skip" ? (
                      <ActionTooltip label={t.actions.skip}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.actions.skip}
                          onClick={() => onSkip(run.runtimeId)}
                        >
                          <SkipForward />
                        </Button>
                      </ActionTooltip>
                    ) : (
                      <ActionTooltip label={t.taskRuns.remove}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.taskRuns.remove}
                          className="text-destructive hover:text-destructive"
                          onClick={() => onRemove(run.runtimeId)}
                        >
                          <Trash />
                        </Button>
                      </ActionTooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        {onAddRun && (
          <Button variant="outline" className="w-fit" onClick={onAddRun}>
            <Plus data-icon="inline-start" />
            {t.actions.runAgain}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
