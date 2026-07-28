import { PageHeader } from "@/components/shared/PageHeader"
import { GoalContextMenu } from "@/components/contextMenus/GoalContextMenu"
import { TaskItem } from "@/components/task/TaskItem"
import { TaskContextMenu } from "@/components/contextMenus/TaskContextMenu"
import { ChecklistDialog } from "@/components/dialogs/ChecklistDialog"
import { TaskRunsDialog } from "@/components/task/TaskRunsDialog"
import { useTaskRuns } from "@/hooks/use-task-runs"
import { canAddRunToday } from "@/utils/task-runtime"
import { CreateTaskDialog } from "@/components/dialogs/CreateTaskDialog"
import { CreateGoalGuidanceDialog } from "@/components/dialogs/CreateGoalGuidanceDialog"
import {
  SettingsDialog,
  type SettingsTab,
} from "@/components/dialogs/SettingsDialog"
import { PlannerDialog } from "@/components/dialogs/PlannerDialog"
import { TimeQuotaView } from "@/components/task/TimeQuotaView"
import { RepeatDebtPopover } from "@/components/task/RepeatDebtPopover"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Plus,
  Play,
  Undo2,
  BookOpen,
  CalendarClock,
  Cloud,
  RefreshCw,
  CloudDownload,
  CloudAlert,
  CloudOff,
} from "lucide-react"
import { ActionTooltip } from "@/components/shared/ActionTooltip"
import { NavHistoryButtons } from "@/components/shared/NavHistoryButtons"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TodayFocusItem } from "@/components/task/TodayFocusItem"
import { FocusQuotaView } from "@/components/goal/FocusQuotaView"
import { PlanningPressureGrid } from "@/components/home/PlanningPressureGrid"
import { ActivityItem } from "@/components/task/ActivityItem"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useHomePageVM } from "@/hooks/use-page-view-models"
import { useAppStore } from "@/store/app-store"
import { EMPTY_DAY_RUN_MAP, useDayRunMap } from "@/hooks/use-day-runs"
import { useRecentActivities } from "@/hooks/use-activities"
import { Link, useLoaderData, useNavigate, useSearchParams } from "react-router"
import type { ListPagesSnapshot } from "@/hooks/use-page-view-models"
import { toast } from "sonner"
import { useLanguage } from "@/components/shared/language-provider"
import type { HomeTaskItemVM } from "@/domain/view-models/HomePageVM"
import type { FocusQuotaVM } from "@/domain/view-models/HomePageVM"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import { useGoalMap, useTaskMap } from "@/hooks/use-entities"
import { useTagMap } from "@/hooks/use-tags"
import {
  useSyncStore,
  useSyncPanelStatus,
  useSyncPanelErrorCode,
} from "@/store/sync-store"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type HomeVM = ReturnType<typeof useHomePageVM>
type TaskBucket = "todo" | "inProgress" | "done"

function getGreetingText(t: ReturnType<typeof useLanguage>["t"]): string {
  const hour = new Date().getHours()
  if (hour < 6) return t.home.greetingNight
  if (hour < 12) return t.home.greetingMorning
  if (hour < 18) return t.home.greetingAfternoon
  return t.home.greetingEvening
}

export function Home() {
  //MARK:VM
  const initial = useLoaderData<ListPagesSnapshot>()
  const vm = useHomePageVM(initial)
  const setGoalFocus = useAppStore((s) => s.setGoalFocus)
  //Interface for requesting a task to be marked as done
  const transitionTaskStatus = useAppStore((s) => s.transitionTaskStatus)
  const upsertStepsCompleted = useAppStore((s) => s.upsertStepsCompleted)
  const { t } = useLanguage()

  // ── Shared checklist dialog state ──
  const [checklistTarget, setChecklistTarget] = useState<{
    runtimeId: TaskRuntimeID
    taskTitle: string
    steps: { id: string; title: string; done: boolean }[]
    showToast?: boolean
  } | null>(null)

  // When a task with still-unfinished steps is marked as done, show the
  // checklist dialog; no steps (or all already done) → mark done directly.
  const requestDone = useCallback(
    (
      runtimeId: TaskRuntimeID,
      taskTitle: string,
      steps: { id: string; title: string; done: boolean }[],
      showToast = false
    ) => {
      if (steps.length === 0 || steps.every((s) => s.done)) {
        transitionTaskStatus(runtimeId, "done")
        if (showToast) {
          toast.success(t.home.taskMarkedDone(taskTitle))
        }
        return
      }
      setChecklistTarget({ runtimeId, taskTitle, steps, showToast })
    },
    [transitionTaskStatus, t]
  )

  const handleChecklistConfirm = useCallback(() => {
    if (checklistTarget) {
      transitionTaskStatus(checklistTarget.runtimeId, "done")
      if (checklistTarget.showToast) {
        toast.success(t.home.taskMarkedDone(checklistTarget.taskTitle))
      }
      setChecklistTarget(null)
    }
  }, [checklistTarget, transitionTaskStatus, t])

  //For Settings and Planner dialog
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general")
  const [isPlannerOpen, setIsPlannerOpen] = useState(false)

  const openSettings = (tab: SettingsTab) => {
    setSettingsTab(tab)
    setIsSettingsOpen(true)
  }

  //MARK: - Render
  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0">
      <PageHeader>
        <HomeHeader
          onOpenPlanner={() => setIsPlannerOpen(true)}
          onOpenSyncSettings={() => openSettings("sync")}
        />
      </PageHeader>

      {/* dialogs */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        defaultTab={settingsTab}
      />
      <PlannerDialog open={isPlannerOpen} onOpenChange={setIsPlannerOpen} />

      {/* Page Title */}
      <div className="mb-6 flex flex-col gap-1 px-4 pt-4">
        <h1 className="heading-1 text-foreground">{getGreetingText(t)}</h1>
        <p className="caption pl-2 text-muted-foreground">{vm.dateLabel}</p>
      </div>

      {/* Shared checklist dialog */}
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
        onConfirm={handleChecklistConfirm}
      />

      {/* Card Groups */}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4 px-4 pb-4">
        {/*Left Column */}
        <div className="col-span-12 flex flex-col gap-3 lg:col-span-8 lg:grid lg:min-h-0 lg:grid-rows-2">
          {/* Tasks */}
          <TodayTasks
            items={vm.todayTasks}
            timeQuota={vm.timeQuota}
            requestDone={requestDone}
          />
          <TodayFocus
            items={vm.todayFocus}
            focusQuota={vm.focusQuota}
            onToggleAdded={(goalId, isAdded) => {
              setGoalFocus(goalId, isAdded)
            }}
          />
        </div>
        {/*Right Column */}
        <div className="col-span-12 flex flex-col gap-3 lg:col-span-4 lg:grid lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)]">
          {/* Planning pressure forecast */}
          <PlanningPressure pressureByDay={vm.pressureByDay} />
          <Activities initialItems={initial?.recentActivities} />
        </div>
      </div>
    </div>
  )
}
//MARK: - HomeHeader
function HomeHeader({
  onOpenPlanner,
  onOpenSyncSettings,
}: {
  onOpenPlanner: () => void
  onOpenSyncSettings: () => void
}) {
  const { t } = useLanguage()

  return (
    <div className="flex w-full items-center px-4">
      <div className="flex items-center gap-2">
        <NavHistoryButtons />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ActionTooltip label={t.doc.concepts.core}>
          <Button variant="ghost" size="lg" asChild>
            <Link to="/doc/concepts/core">
              <BookOpen />
            </Link>
          </Button>
        </ActionTooltip>

        <Button variant="ghost" size="lg" onClick={onOpenPlanner}>
          <CalendarClock />
        </Button>

        {/* <Button variant="ghost" size="lg" onClick={onOpenSyncSettings}>
          <Cloud />
        </Button> */}
        <CloudSettingButtonWithTooltip
          onOpenSyncSettings={onOpenSyncSettings}
        />
      </div>
    </div>
  )
}
//- Sub components
function CloudSettingButtonWithTooltip({
  onOpenSyncSettings,
}: {
  onOpenSyncSettings: () => void
}): React.ReactNode {
  const syncStatus = useSyncStore((s) => s.syncStatus)
  const lastSyncError = useSyncStore((s) => s.lastSyncError)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const panelStatus = useSyncPanelStatus()
  const panelErrorCode = useSyncPanelErrorCode()
  const { t, language } = useLanguage()

  if (panelStatus === "unauthorized") {
    return (
      <Button variant="ghost" size="lg" onClick={onOpenSyncSettings}>
        <CloudOff />
      </Button>
    )
  }

  const showAlert = syncStatus === "error"
  const tooltipText = getSyncTooltipText(
    panelErrorCode,
    syncStatus,
    lastSyncedAt,
    t,
    language
  )
  const tooltipDetail =
    syncStatus === "error" && lastSyncError ? lastSyncError : null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="lg" onClick={onOpenSyncSettings}>
            {syncStatus === "syncing" && (
              <CloudDownload className="animate-pulse" />
            )}
            {syncStatus !== "syncing" && showAlert && <CloudAlert />}
            {syncStatus !== "syncing" && !showAlert && <Cloud />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {tooltipText}
          {tooltipDetail && (
            <div className="text-muted-foreground">{tooltipDetail}</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function getSyncTooltipText(
  panelErrorCode: ReturnType<typeof useSyncStore.getState>["panelErrorCode"],
  syncStatus: ReturnType<typeof useSyncStore.getState>["syncStatus"],
  lastSyncedAt: string | null,
  t: ReturnType<typeof useLanguage>["t"],
  language: ReturnType<typeof useLanguage>["language"]
): string {
  if (syncStatus === "error") {
    if (panelErrorCode === "authorization_failed")
      return t.sync.syncTooltip.authorizationFailed
    if (panelErrorCode === "sync_unavailable")
      return t.sync.syncTooltip.syncUnavailable
    return t.sync.syncTooltip.error
  }
  if (syncStatus === "syncing") return t.sync.syncTooltip.syncing
  if (!lastSyncedAt) return t.sync.syncTooltip.lastSyncAtNever
  const date = new Date(lastSyncedAt)
  const formatted = new Intl.DateTimeFormat(
    language === "zh" ? "zh-CN" : "en-US",
    {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date)
  return `${t.sync.syncTooltip.lastSyncAt} ${formatted}`
}

//MARK: Today's Tasks
function TodayTasks({
  items,
  timeQuota,
  requestDone,
}: {
  items: HomeVM["todayTasks"]
  timeQuota: HomeVM["timeQuota"]
  requestDone: (
    runtimeId: TaskRuntimeID,
    taskTitle: string,
    steps: { id: string; title: string; done: boolean }[]
  ) => void
}) {
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  // The task whose runs the dialog is showing; set when a collapsed done row is
  // acted on, since that row stands for several runtimes at once.
  const [runsTaskId, setRunsTaskId] = useState<TaskID | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTaskTab = searchParams.get("taskTab")
  const activeTaskTab: TaskBucket =
    rawTaskTab === "inProgress" || rawTaskTab === "done" ? rawTaskTab : "todo"

  const { rows: runs } = useTaskRuns(runsTaskId)
  const taskMap = useTaskMap()
  const taskRuntime = useDayRunMap() ?? EMPTY_DAY_RUN_MAP
  const addTaskRun = useAppStore((s) => s.addTaskRun)
  const runsTask = runsTaskId ? taskMap[runsTaskId] : undefined
  const removeTaskRuntime = useAppStore((s) => s.removeTaskRuntime)
  const transitionTaskStatus = useAppStore((s) => s.transitionTaskStatus)
  const upsertStepsCompleted = useAppStore((s) => s.upsertStepsCompleted)
  const replan = useAppStore((s) => s.replan)
  const skipRepeatTask = useAppStore((s) => s.skipRepeatTask)
  const resolveRepeatDebt = useAppStore((s) => s.resolveRepeatDebt)
  const { t } = useLanguage()
  const navigate = useNavigate()
  const goalMap = useGoalMap()
  const tagMap = useTagMap()
  const goalTagColor = (goalId?: string) => {
    const tagId = goalId ? goalMap[goalId as GoalID]?.tagId : undefined
    return tagId ? tagMap[tagId]?.color : undefined
  }

  //when skip a repeat task, show a toast with "Restore in Plans" action
  // that navigates user to plans tab.
  const handleSkipRepeat = (runtimeId: TaskRuntimeID) => {
    skipRepeatTask(runtimeId)
    toast(t.tasks.taskSkipped, {
      action: {
        label: t.tasks.restoreInPlans,
        onClick: () => navigate("/tasks?tab=plans"),
      },
    })
  }

  const handleIgnoreDebt = (runtimeId: TaskRuntimeID) => {
    resolveRepeatDebt(runtimeId, "skip")
    toast(t.repeatDebt.ignored)
  }

  const handleCompleteDebt = (runtimeId: TaskRuntimeID, taskTitle: string) => {
    resolveRepeatDebt(runtimeId, "done")
    toast.success(t.home.taskMarkedDone(taskTitle))
  }

  //utility to build leading element (checkbox or play button)
  const buildLeading = (item: HomeTaskItemVM) => {
    const stop = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

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
            <Play />
          </Button>
        </ActionTooltip>
      )
    }

    if (item.runtimeStatus === "inProgress") {
      return (
        <Checkbox
          className="cursor-pointer"
          onClick={(e) => {
            stop(e)
            requestDone(item.runtimeId, item.title, item.steps)
          }}
        />
      )
    }

    // done → Undo. When the row collapses several runs, "which one?" has no
    // answer here, so the same button opens the runs dialog instead.
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
          <Undo2 />
        </Button>
      </ActionTooltip>
    )
  }

  const renderTaskItem = (task: HomeTaskItemVM) => {
    // if the item is introduced by repeat policy and is a debt item,
    // show the debt action popover
    const debtAction =
      task.isDebtItem &&
      task.plannedForDate &&
      task.runtimeStatus !== "done" ? (
        <RepeatDebtPopover
          plannedForDate={task.plannedForDate}
          onMarkDone={() => handleCompleteDebt(task.runtimeId, task.title)}
          onIgnore={() => handleIgnoreDebt(task.runtimeId)}
        />
      ) : undefined

    return (
      <TaskContextMenu
        key={task.runtimeId}
        runtimeId={task.runtimeId}
        taskId={task.taskId}
        taskTitle={task.title}
        goalId={task.goalId}
        goalTitle={task.goalTitle}
        runtimeStatus={task.runtimeStatus}
        forcedDueAt={task.forcedDueAt}
        isRepeatTask={task.isRepeatTask}
        canRunAgain={task.canRunAgain}
        runtimeSource={task.runtimeSource}
        plannedForDate={task.plannedForDate}
        onRequestDone={() =>
          requestDone(task.runtimeId, task.title, task.steps)
        }
        onSkipRepeat={
          task.runtimeSource === "repeatPolicy"
            ? () => handleSkipRepeat(task.runtimeId)
            : undefined
        }
      >
        <TaskItem
          data-testid={`task-${task.runtimeId}`}
          taskId={task.taskId}
          title={task.title}
          goalId={task.goalId}
          goalTitle={task.goalTitle ?? t.common.noGoal}
          goalTagColor={goalTagColor(task.goalId)}
          duration={task.estimatedDuration}
          plannedForLabel={task.plannedForLabel}
          runsLabel={task.runsLabel}
          onRunsBadgeClick={
            task.runtimeStatus === "done" && task.runsLabel
              ? () => setRunsTaskId(task.taskId)
              : undefined
          }
          carriedOverLabel={task.carriedOverLabel}
          dueLabel={task.dueAt}
          dueVariant="inline-destructive"
          steps={task.steps}
          showStepProgress={task.runtimeStatus === "inProgress"}
          onStepsCheckChange={
            task.runtimeStatus === "inProgress"
              ? (stepId, done) => {
                  const current = task.steps
                    .filter((s) => s.done)
                    .map((s) => s.id)
                  const next = done
                    ? [...current, stepId]
                    : current.filter((id) => id !== stepId)
                  upsertStepsCompleted(task.runtimeId, next)
                }
              : undefined
          }
          leading={buildLeading(task)}
          action={debtAction}
        />
      </TaskContextMenu>
    )
  }

  // Get task items for each bucket
  const todoItems = items.todo.map(renderTaskItem)
  const inProgressItems = items.inProgress.map(renderTaskItem)
  const doneItems = items.done.map(renderTaskItem)

  return (
    <div className="flex h-[406px] flex-col gap-0.5 lg:h-full lg:min-h-0">
      {/* header */}
      <div className="flex h-9 items-center">
        <h4 className="heading-4 text-foreground">{t.home.todaysTasks}</h4>
        <div className="ml-2">
          <TimeQuotaView {...timeQuota} />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="default"
            className="!leading-4"
            onClick={() => void replan("full")}
            title={t.home.replanToday}
            aria-label={t.home.replanToday}
          >
            <RefreshCw />
          </Button>
          <Button
            data-testid="home-add-task"
            size="default"
            className="!leading-4"
            onClick={() => setIsCreateTaskOpen(true)}
          >
            <Plus />
            {t.home.addTask}
          </Button>
        </div>
      </div>

      <CreateTaskDialog
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
      />

      <TaskRunsDialog
        open={runsTaskId !== null}
        onOpenChange={(open) => !open && setRunsTaskId(null)}
        runs={runs}
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

      {/* task list */}
      <Card className="flex flex-1 flex-col gap-0 pb-2 shadow">
        <Tabs
          value={activeTaskTab}
          className="flex min-h-0 w-full flex-1 flex-col"
          onValueChange={(newValue) => {
            setSearchParams((prev) => {
              const params = new URLSearchParams(prev)
              if (newValue === "todo") {
                params.delete("taskTab")
              } else {
                params.set("taskTab", newValue)
              }
              return params
            })
          }}
        >
          <TabsList className="mx-auto shrink-0 shadow-sm">
            <TabsTrigger
              data-testid="home-tab-todo"
              value="todo"
            >{`${t.status.todo} (${todoItems.length})`}</TabsTrigger>
            <TabsTrigger data-testid="home-tab-inProgress" value="inProgress">
              {`${t.status.inProgress} (${inProgressItems.length})`}
            </TabsTrigger>
            <TabsTrigger
              data-testid="home-tab-done"
              value="done"
            >{`${t.status.done} (${doneItems.length})`}</TabsTrigger>
          </TabsList>
          <TabsContent value="todo" className="min-h-0 flex-1">
            <ScrollArea className="h-full px-2">
              <div className="flex flex-col gap-2 pb-2">{todoItems}</div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="inProgress" className="min-h-0 flex-1">
            <ScrollArea className="h-full px-2">
              <div className="flex flex-col gap-2 pb-2">{inProgressItems}</div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="done" className="min-h-0 flex-1">
            <ScrollArea className="h-full px-2">
              <div className="flex flex-col gap-2 pb-2">{doneItems}</div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}

//MARK: Today's Focus
function TodayFocus({
  items,
  focusQuota,
  onToggleAdded,
}: {
  items: HomeVM["todayFocus"]
  focusQuota: FocusQuotaVM
  onToggleAdded: (goalId: string, isAdded: boolean) => void
}) {
  const [isCreateGoalOpen, setIsCreateGoalOpen] = useState(false)
  const { t } = useLanguage()
  return (
    <div className="flex h-[319px] flex-col gap-0.5 lg:h-full lg:min-h-0">
      {/* header */}
      <div className="flex h-9 items-center">
        <h4 className="heading-4 text-foreground">{t.home.todaysFocus}</h4>
        <div className="ml-2">
          <FocusQuotaView {...focusQuota} />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            data-testid="home-new-goal"
            size="default"
            className="!leading-4"
            onClick={() => setIsCreateGoalOpen(true)}
          >
            <Plus />
            {t.home.newGoal}
          </Button>
        </div>
      </div>

      <CreateGoalGuidanceDialog
        open={isCreateGoalOpen}
        onOpenChange={setIsCreateGoalOpen}
      />

      {/* goal list */}
      <Card className="flex min-h-0 flex-1 flex-col shadow">
        <ScrollArea className="h-full p-2">
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <GoalContextMenu
                key={item.goal.id}
                goalId={item.goal.id}
                goalTitle={item.goal.title}
                isFocused={item.isAdded}
                isDone={false}
                isForced={item.isForced}
                focusStatuses={item.focusStatuses}
              >
                <TodayFocusItem
                  data-testid={`goal-${item.goal.id}`}
                  id={item.goal.id}
                  title={item.goal.title}
                  progress={item.progressPercent}
                  isAdded={item.isAdded}
                  due={item.dueLabel}
                  isForced={item.isForced}
                  focusStatuses={item.focusStatuses}
                  allTasksDismissed={item.allTasksDismissed}
                  onAddedChange={(isAdded) =>
                    onToggleAdded(item.goal.id, isAdded)
                  }
                />
              </GoalContextMenu>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  )
}

//MARK: Planning Pressure
function PlanningPressure({
  pressureByDay,
}: {
  pressureByDay: HomeVM["pressureByDay"]
}) {
  const { t } = useLanguage()
  const today = useMemo(() => new Date(), [])

  return (
    <div className="flex h-[406px] flex-col gap-0.5 lg:h-full lg:min-h-0">
      {/* header */}
      <div className="flex h-9 items-center">
        <h4 className="heading-4 text-foreground">{t.home.planningPressure}</h4>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col shadow">
        <CardContent className="flex min-h-0 flex-1 flex-col justify-center">
          <PlanningPressureGrid today={today} pressureByDay={pressureByDay} />
        </CardContent>
      </Card>
    </div>
  )
}

function Activities({
  initialItems,
}: {
  initialItems?: ListPagesSnapshot["recentActivities"]
}) {
  const items = useRecentActivities(10, initialItems)
  const { t } = useLanguage()

  return (
    <div className="flex h-[195px] flex-col gap-0.5 lg:h-full lg:min-h-0">
      <h4 className="heading-4 flex h-9 items-center text-foreground">
        {t.home.recentActivities}
      </h4>
      {/* goal list */}
      <Card className="flex min-h-0 flex-1 flex-col shadow">
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="heading-3 text-muted-foreground">
              {t.home.noRecentActivities}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full p-2">
            <div className="flex flex-col gap-2">
              {items.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  kind={activity.kind}
                  taskId={activity.taskId}
                  taskTitle={activity.taskTitle}
                  recordedAt={activity.recordedAtLabel}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  )
}
