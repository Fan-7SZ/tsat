import { ActionTooltip } from "@/components/shared/ActionTooltip"
import { NavHistoryButtons } from "@/components/shared/NavHistoryButtons"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import {
  ChevronDown,
  ChevronRight,
  Play,
  Plus,
  Undo2,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useTasksPageVM } from "@/hooks/use-page-view-models"
import { Checkbox } from "@/components/ui/checkbox"
import { TaskItem } from "@/components/task/TaskItem"
import { TriggerTaskItem } from "@/components/task/TriggerTaskItem"
import { PullUpInfoPopover } from "@/components/task/PullUpInfoPopover"
import { useTriggerPlanItems } from "@/hooks/use-trigger-plan"
import { TaskContextMenu } from "@/components/contextMenus/TaskContextMenu"
import { ChecklistDialog } from "@/components/dialogs/ChecklistDialog"
import { TimeQuotaView } from "@/components/task/TimeQuotaView"
import { RepeatDebtPopover } from "@/components/task/RepeatDebtPopover"
import { useLoaderData, useSearchParams } from "react-router"
import type { ListPagesSnapshot } from "@/hooks/use-page-view-models"
import { toast } from "sonner"
import { useAppStore } from "@/store/app-store"
import { EMPTY_DAY_RUN_MAP, useDayRunMap } from "@/hooks/use-day-runs"
import { useLanguage } from "@/components/shared/language-provider"
import { useSkippedRepeatTasks } from "@/hooks/use-activities"
import { CompletionRecordsDialog } from "@/components/task/CompletionRecordsDialog"
import { useTaskRepeatLedger } from "@/hooks/use-completion"
import { setRepeatPointStatus } from "@/commands/completion.commands"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { CreateTaskDialog } from "@/components/dialogs/CreateTaskDialog"
import { TaskRunsDialog } from "@/components/task/TaskRunsDialog"
import { useTaskRuns } from "@/hooks/use-task-runs"
import { canAddRunToday } from "@/utils/task-runtime"
import type { TasksTaskItemVM } from "@/domain/view-models/TasksPageVM"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import { useGoalMap, useTaskMap } from "@/hooks/use-entities"
import { useTagMap } from "@/hooks/use-tags"

type tasksTab = "today" | "plans" | "unselected"

type TaskCollapseState = {
  openTodo: boolean
  openInProgress: boolean
  openDone: boolean
  openTomorrow: boolean
  openIn7Days: boolean
  openByTrigger: boolean
  openUnselected: boolean
  openSkipped: boolean
}

const TASKS_COLLAPSE_STORAGE_KEY = "tasks-page-collapse-state"

const defaultTaskCollapseState: TaskCollapseState = {
  openTodo: true,
  openInProgress: true,
  openDone: true,
  openTomorrow: true,
  openIn7Days: true,
  openByTrigger: true,
  openUnselected: true,
  openSkipped: true,
}

function readTaskCollapseState(): TaskCollapseState {
  if (typeof window === "undefined") {
    return defaultTaskCollapseState
  }

  try {
    const stored = window.localStorage.getItem(TASKS_COLLAPSE_STORAGE_KEY)
    if (!stored) {
      return defaultTaskCollapseState
    }

    const parsed = JSON.parse(stored) as Partial<TaskCollapseState>

    return {
      openTodo:
        typeof parsed.openTodo === "boolean"
          ? parsed.openTodo
          : defaultTaskCollapseState.openTodo,
      openInProgress:
        typeof parsed.openInProgress === "boolean"
          ? parsed.openInProgress
          : defaultTaskCollapseState.openInProgress,
      openDone:
        typeof parsed.openDone === "boolean"
          ? parsed.openDone
          : defaultTaskCollapseState.openDone,
      openTomorrow:
        typeof parsed.openTomorrow === "boolean"
          ? parsed.openTomorrow
          : defaultTaskCollapseState.openTomorrow,
      openIn7Days:
        typeof parsed.openIn7Days === "boolean"
          ? parsed.openIn7Days
          : defaultTaskCollapseState.openIn7Days,
      openByTrigger:
        typeof parsed.openByTrigger === "boolean"
          ? parsed.openByTrigger
          : defaultTaskCollapseState.openByTrigger,
      openUnselected:
        typeof parsed.openUnselected === "boolean"
          ? parsed.openUnselected
          : defaultTaskCollapseState.openUnselected,
      openSkipped:
        typeof parsed.openSkipped === "boolean"
          ? parsed.openSkipped
          : defaultTaskCollapseState.openSkipped,
    }
  } catch {
    return defaultTaskCollapseState
  }
}

export function Tasks() {
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [runsTaskId, setRunsTaskId] = useState<TaskID | null>(null)
  // Skipped row collapsing several points → per-point completion dialog.
  const [recordsTaskId, setRecordsTaskId] = useState<TaskID | null>(null)
  const [collapseState, setCollapseState] = useState<TaskCollapseState>(
    readTaskCollapseState
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useLanguage()
  const rawTab = searchParams.get("tab")
  const activeTab: tasksTab =
    rawTab === "plans"
      ? "plans"
      : rawTab === "unselected"
        ? "unselected"
        : "today"

  const initial = useLoaderData<ListPagesSnapshot>()
  const vm = useTasksPageVM(initial)
  const goalMap = useGoalMap(initial?.goals)
  const taskMap = useTaskMap(initial?.tasks)
  const taskRuntime = useDayRunMap(initial?.dayRuns) ?? EMPTY_DAY_RUN_MAP
  const tagMap = useTagMap()
  const goalTagColor = (goalId?: string) => {
    const tagId = goalId ? goalMap[goalId as GoalID]?.tagId : undefined
    return tagId ? tagMap[tagId]?.color : undefined
  }
  const skippedItems = useSkippedRepeatTasks(initial)
  const triggerItems = useTriggerPlanItems(initial)
  const upsertTaskRuntime = useAppStore((s) => s.upsertTaskRuntime)
  const transitionTaskStatus = useAppStore((s) => s.transitionTaskStatus)
  const upsertStepsCompleted = useAppStore((s) => s.upsertStepsCompleted)
  const removeTaskRuntime = useAppStore((s) => s.removeTaskRuntime)
  const addTaskRun = useAppStore((s) => s.addTaskRun)
  const skipRepeatTask = useAppStore((s) => s.skipRepeatTask)
  const resolveRepeatDebt = useAppStore((s) => s.resolveRepeatDebt)
  const restoreSkippedRepeatTask = useAppStore(
    (s) => s.restoreSkippedRepeatTask
  )
  const { rows: runsRows } = useTaskRuns(runsTaskId)
  const runsTask = runsTaskId ? taskMap[runsTaskId] : undefined
  const recordsPoints = useTaskRepeatLedger(recordsTaskId ?? undefined)
  const recordsTask = recordsTaskId ? taskMap[recordsTaskId] : undefined

  const handleSkipRepeat = (runtimeId: TaskRuntimeID) => {
    skipRepeatTask(runtimeId)
    toast(t.tasks.taskSkipped, {
      action: {
        label: t.tasks.restoreInPlans,
        onClick: () => setSearchParams({ tab: "plans" }),
      },
    })
  }

  const handleIgnoreDebt = (runtimeId: TaskRuntimeID) => {
    resolveRepeatDebt(runtimeId, "skip")
    toast(t.repeatDebt.ignored)
  }
  const handleCompleteDebt = (runtimeId: TaskRuntimeID) => {
    resolveRepeatDebt(runtimeId, "done")
  }
  const {
    openTodo,
    openInProgress,
    openDone,
    openTomorrow,
    openIn7Days,
    openByTrigger,
    openUnselected,
    openSkipped,
  } = collapseState

  // ── Checklist dialog state ──
  const [checklistTarget, setChecklistTarget] = useState<{
    runtimeId: TaskRuntimeID
    steps: { id: string; title: string; done: boolean }[]
  } | null>(null)

  useEffect(() => {
    window.localStorage.setItem(
      TASKS_COLLAPSE_STORAGE_KEY,
      JSON.stringify(collapseState)
    )
  }, [collapseState])

  const handleOpenChange = (key: keyof TaskCollapseState) => {
    return (open: boolean) => {
      setCollapseState((prev) => ({
        ...prev,
        [key]: open,
      }))
    }
  }

  // Shared guard: open the checklist only when there are still-unfinished steps;
  // no steps (or all already done in runtime) → mark done directly.
  const requestDone = useCallback(
    (
      runtimeId: TaskRuntimeID,
      steps: { id: string; title: string; done: boolean }[]
    ) => {
      if (steps.length === 0 || steps.every((s) => s.done)) {
        transitionTaskStatus(runtimeId, "done")
        return
      }
      setChecklistTarget({ runtimeId, steps })
    },
    [transitionTaskStatus]
  )

  // Build the leading element for each status
  const buildLeading = (item: TasksTaskItemVM) => {
    const stop = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    // null (plans / unselected) → Plus → Add to Today
    if (item.runtimeStatus === null) {
      if (item.isRepeatTask && item.plannedForDate) {
        const plannedForDate = item.plannedForDate
        return (
          <ActionTooltip label={t.actions.addToToday}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 cursor-pointer"
              onClick={(e) => {
                stop(e)
                upsertTaskRuntime({
                  id: item.runtimeId,
                  taskId: item.taskId,
                  arrangementStatus: "todo",
                  source: "repeatPolicy",
                  plannedForDate,
                })
              }}
            >
              <Plus className="size-4" />
            </Button>
          </ActionTooltip>
        )
      }

      return (
        <ActionTooltip label={t.actions.addToToday}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 cursor-pointer"
            onClick={(e) => {
              stop(e)
              upsertTaskRuntime({
                id: item.runtimeId,
                taskId: item.taskId,
                arrangementStatus: "todo",
                source: "manual",
              })
            }}
          >
            <Plus className="size-4" />
          </Button>
        </ActionTooltip>
      )
    }

    // todo → Play → Move to In Progress
    if (item.runtimeStatus === "todo") {
      return (
        <ActionTooltip label={t.actions.markInProgress}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 cursor-pointer"
            onClick={(e) => {
              stop(e)
              transitionTaskStatus(item.runtimeId, "inProgress")
            }}
          >
            <Play className="size-4" />
          </Button>
        </ActionTooltip>
      )
    }

    // inProgress → Checkbox → Mark Done (with guard)
    if (item.runtimeStatus === "inProgress") {
      return (
        <Checkbox
          className="cursor-pointer"
          onClick={(e) => {
            stop(e)
            requestDone(item.runtimeId, item.steps)
          }}
        />
      )
    }

    // done → Undo. A collapsed row of non-equivalent items has no single one to
    // retract, so the same button opens the runs dialog instead.
    const collapsed = (item.collapsedRunIds?.length ?? 0) > 1
    return (
      <ActionTooltip
        label={collapsed ? t.taskRuns.title : t.actions.moveBackToTodo}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 cursor-pointer"
          onClick={(e) => {
            stop(e)
            if (collapsed) {
              setRunsTaskId(item.taskId)
            } else {
              transitionTaskStatus(item.runtimeId, "todo")
            }
          }}
        >
          <Undo2 className="size-4" />
        </Button>
      </ActionTooltip>
    )
  }

  const renderTaskItem = (item: TasksTaskItemVM, showDue = false) => {
    const itemKey = item.runtimeId
    const debtAction =
      item.isDebtItem &&
      item.plannedForDate &&
      item.runtimeStatus !== "done" ? (
        <RepeatDebtPopover
          plannedForDate={item.plannedForDate}
          onMarkDone={() => handleCompleteDebt(item.runtimeId)}
          onIgnore={() => handleIgnoreDebt(item.runtimeId)}
        />
      ) : undefined

    // Read-only repeat-cadence explanation for non-overdue repeat items.
    const pullUpInfoAction =
      item.isRepeatTask && item.repeatRuleSummary ? (
        <PullUpInfoPopover
          kind="repeat"
          ruleSummary={item.repeatRuleSummary}
          pullUpLabel={item.plannedForLabel}
        />
      ) : undefined

    const taskEl = (
      <TaskItem
        data-testid={`task-${item.runtimeId}`}
        taskId={item.taskId}
        title={item.title}
        goalId={item.goalId}
        goalTitle={item.goalTitle ? item.goalTitle : "No goal"}
        goalTagColor={goalTagColor(item.goalId)}
        duration={item.estimatedDuration}
        plannedForLabel={item.plannedForLabel}
        runsLabel={item.runsLabel}
        onRunsBadgeClick={
          item.runtimeStatus === "done" && item.runsLabel
            ? () => setRunsTaskId(item.taskId)
            : undefined
        }
        carriedOverLabel={item.carriedOverLabel}
        dismissedLabel={
          item.isDismissedToday ? t.status.dismissedToday : undefined
        }
        dueLabel={showDue ? item.dueAt : undefined}
        dueVariant="badge"
        steps={item.steps}
        showStepProgress={item.runtimeStatus === "inProgress"}
        onStepsCheckChange={
          item.runtimeStatus === "inProgress"
            ? (stepId, done) => {
                const current = item.steps
                  .filter((s) => s.done)
                  .map((s) => s.id)
                const next = done
                  ? [...current, stepId]
                  : current.filter((id) => id !== stepId)
                upsertStepsCompleted(item.runtimeId, next)
              }
            : undefined
        }
        action={debtAction ?? pullUpInfoAction}
        leading={buildLeading(item)}
      />
    )

    return (
      <TaskContextMenu
        key={itemKey}
        runtimeId={item.runtimeId}
        taskId={item.taskId}
        taskTitle={item.title}
        goalId={item.goalId}
        goalTitle={item.goalTitle}
        runtimeStatus={item.runtimeStatus}
        forcedDueAt={item.forcedDueAt}
        isRepeatTask={item.isRepeatTask}
        canRunAgain={item.canRunAgain}
        runtimeSource={item.runtimeSource}
        plannedForDate={item.plannedForDate}
        onRequestDone={() => requestDone(item.runtimeId, item.steps)}
        onSkipRepeat={
          item.runtimeSource === "repeatPolicy"
            ? () => handleSkipRepeat(item.runtimeId)
            : undefined
        }
      >
        {taskEl}
      </TaskContextMenu>
    )
  }

  const todoBuckets = (vm.today.todo || []).map((i) => renderTaskItem(i, true))
  const inProgressBuckets = (vm.today.inProgress || []).map((i) =>
    renderTaskItem(i, true)
  )
  const doneBuckets = (vm.today.done || []).map((i) => renderTaskItem(i, true))
  const tomorrowBuckets = (vm.plans.tomorrow || []).map((i) =>
    renderTaskItem(i, true)
  )
  const in7DaysBuckets = (vm.plans.in7Days || []).map((i) =>
    renderTaskItem(i, true)
  )
  const unselectedItems = (vm.unselected || []).map((i) => renderTaskItem(i))
  const skippedElements = skippedItems.map((item) => {
    // Mirrors collapsed done rows: several points behind one row have no single
    // skip to retract, so both the leading button and the menu entry open the
    // per-point completion dialog instead of restoring blindly.
    const collapsed = item.skippedDates.length > 1
    const restore = () =>
      restoreSkippedRepeatTask(
        item.runtimeId,
        item.taskId,
        item.plannedForDate!
      )
    const openRecords = () => setRecordsTaskId(item.taskId)
    const taskEl = (
      <TaskItem
        data-testid={`task-${item.runtimeId}`}
        taskId={item.taskId}
        title={item.title}
        goalId={item.goalId}
        goalTitle={item.goalTitle ? item.goalTitle : "No goal"}
        goalTagColor={goalTagColor(item.goalId)}
        duration={item.estimatedDuration}
        plannedForLabel={item.plannedForLabel}
        runsLabel={item.runsLabel}
        onRunsBadgeClick={collapsed ? openRecords : undefined}
        leading={
          <ActionTooltip
            label={
              collapsed
                ? t.taskDetail.customCompletion
                : t.actions.restoreToTodo
            }
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (collapsed) {
                  openRecords()
                } else {
                  restore()
                }
              }}
            >
              <Undo2 className="size-4" />
            </Button>
          </ActionTooltip>
        }
      />
    )
    return (
      <TaskContextMenu
        key={item.runtimeId}
        runtimeId={item.runtimeId}
        taskId={item.taskId}
        taskTitle={item.title}
        goalId={item.goalId}
        goalTitle={item.goalTitle}
        runtimeStatus={null}
        isRepeatTask={true}
        isSkippedRepeat={true}
        plannedForDate={item.plannedForDate}
        onRestoreSkipped={collapsed ? undefined : restore}
        onCustomizeCompletion={collapsed ? openRecords : undefined}
      >
        {taskEl}
      </TaskContextMenu>
    )
  })

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0">
      <PageHeader>
        <Header
          onOpenCreateTask={() => setIsCreateTaskOpen(true)}
          timeQuota={vm.timeQuota}
        />
      </PageHeader>
      <CreateTaskDialog
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
      />
      <TaskRunsDialog
        open={runsTaskId !== null}
        onOpenChange={(open) => !open && setRunsTaskId(null)}
        runs={runsRows}
        onChangeStatus={transitionTaskStatus}
        onRemove={removeTaskRuntime}
        onSkip={skipRepeatTask}
        onResolveDebt={resolveRepeatDebt}
        onAddRun={
          runsTask && canAddRunToday(runsTask, taskRuntime)
            ? () => addTaskRun(runsTask.id)
            : undefined
        }
      />
      <CompletionRecordsDialog
        open={recordsTaskId !== null}
        onOpenChange={(open) => !open && setRecordsTaskId(null)}
        mode="repeat"
        points={recordsPoints}
        onChangeStatus={(dateKey, status) => {
          if (!recordsTask) return
          void setRepeatPointStatus(
            recordsTask,
            dateKey as LocalDateKey,
            status,
            t.commands.taskUpdateFailed
          )
        }}
      />
      <ChecklistDialog
        open={checklistTarget !== null}
        onOpenChange={(open) => {
          if (!open) setChecklistTarget(null)
        }}
        steps={checklistTarget?.steps ?? []}
        onStepsChange={(ids) => {
          if (checklistTarget) {
            upsertStepsCompleted(checklistTarget.runtimeId, ids)
          }
        }}
        onConfirm={() => {
          if (checklistTarget) {
            transitionTaskStatus(checklistTarget.runtimeId, "done")
            setChecklistTarget(null)
          }
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col py-2">
        <Tabs
          value={activeTab}
          className="flex min-h-0 w-full flex-1 flex-col"
          onValueChange={(newValue) => {
            setSearchParams((prev) => {
              const params = new URLSearchParams(prev)
              if (newValue === "today") {
                params.delete("tab")
              } else {
                params.set("tab", newValue)
              }
              return params
            })
          }}
        >
          <TabsList className="mx-auto w-fit shrink-0 shadow-sm">
            <TabsTrigger data-testid="tasks-tab-today" value="today">
              {t.tasks.today}
            </TabsTrigger>
            <TabsTrigger data-testid="tasks-tab-plans" value="plans">
              {t.tasks.plans}
            </TabsTrigger>
            <TabsTrigger data-testid="tasks-tab-unselected" value="unselected">
              {t.tasks.unscheduled}
            </TabsTrigger>
          </TabsList>

          {/* list */}
          <ScrollArea className="min-h-0 flex-1 px-4">
            <TabsContent value="today" className="flex flex-col gap-4">
              <CollapsibleTaskList
                title={t.tasks.todoCount(todoBuckets.length)}
                open={openTodo}
                onOpenChange={handleOpenChange("openTodo")}
              >
                <div className="flex flex-col gap-1">{todoBuckets}</div>
              </CollapsibleTaskList>
              <CollapsibleTaskList
                title={t.tasks.inProgressCount(inProgressBuckets.length)}
                open={openInProgress}
                onOpenChange={handleOpenChange("openInProgress")}
              >
                <div className="flex flex-col gap-1">{inProgressBuckets}</div>
              </CollapsibleTaskList>
              <CollapsibleTaskList
                title={t.tasks.doneCount(doneBuckets.length)}
                open={openDone}
                onOpenChange={handleOpenChange("openDone")}
              >
                <div className="flex flex-col gap-1">{doneBuckets}</div>
              </CollapsibleTaskList>
            </TabsContent>
            <TabsContent value="plans" className="flex flex-col gap-4">
              <CollapsibleTaskList
                title={t.tasks.tomorrowCount(tomorrowBuckets.length)}
                open={openTomorrow}
                onOpenChange={handleOpenChange("openTomorrow")}
              >
                <div className="flex flex-col gap-1">{tomorrowBuckets}</div>
              </CollapsibleTaskList>
              <CollapsibleTaskList
                title={t.tasks.in7DaysCount(in7DaysBuckets.length)}
                open={openIn7Days}
                onOpenChange={handleOpenChange("openIn7Days")}
              >
                <div className="flex flex-col gap-1">{in7DaysBuckets}</div>
              </CollapsibleTaskList>
              <CollapsibleTaskList
                title={t.tasks.byTriggerCount(triggerItems.length)}
                open={openByTrigger}
                onOpenChange={handleOpenChange("openByTrigger")}
              >
                <div className="flex flex-col gap-1">
                  {triggerItems.map((item) => (
                    <TriggerTaskItem
                      key={item.taskId}
                      taskId={item.taskId}
                      title={item.title}
                      goalId={item.goalId}
                      goalTitle={item.goalTitle || t.common.noGoal}
                      byGoalTrigger={item.byGoalTrigger}
                      ruleSummary={item.ruleSummary}
                      windowLabel={item.windowLabel}
                      pullUps={item.pullUps}
                    />
                  ))}
                </div>
              </CollapsibleTaskList>
              {skippedElements.length > 0 && (
                <CollapsibleTaskList
                  title={t.tasks.skippedCount(skippedElements.length)}
                  open={openSkipped}
                  onOpenChange={handleOpenChange("openSkipped")}
                >
                  <div className="flex flex-col gap-1">{skippedElements}</div>
                </CollapsibleTaskList>
              )}
            </TabsContent>
            <TabsContent value="unselected" className="flex flex-col gap-4">
              <CollapsibleTaskList
                title={t.tasks.unscheduledCount(unselectedItems.length)}
                open={openUnselected}
                onOpenChange={handleOpenChange("openUnselected")}
              >
                <div className="flex flex-col gap-1">{unselectedItems}</div>
              </CollapsibleTaskList>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  )
}
// header
function Header({
  onOpenCreateTask,
  timeQuota,
}: {
  onOpenCreateTask: () => void
  timeQuota: import("@/domain/view-models/HomePageVM").TimeQuotaVM
}) {
  const { t } = useLanguage()
  return (
    <div className="flex w-full items-center px-4">
      <div className="flex items-center gap-2">
        <NavHistoryButtons />
        {/* Page Title */}
        <span className="paragraph-regular">{t.nav.tasks}</span>
        <TimeQuotaView {...timeQuota} />
      </div>

      <div className="ml-auto flex gap-1">
        <Button variant="default" size="lg" onClick={onOpenCreateTask}>
          <Plus />
          {t.tasks.addTask}
        </Button>
      </div>
    </div>
  )
}
//Collapsible Task List
function CollapsibleTaskList({
  children,
  open,
  onOpenChange,
  className,
  title,
}: {
  children?: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
  title: string
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={cn("flex flex-col gap-1", className)}
    >
      {/* header */}
      <div className="heading-2 flex w-full">
        <h2>{title}</h2>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="ml-auto">
            {open ? <ChevronDown /> : <ChevronRight />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <Separator />
      {/* content */}
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}
