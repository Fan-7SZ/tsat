import {
  deleteTask as deleteTaskCommand,
  updateTask,
} from "@/commands/task.commands"
import { PageHeader } from "@/components/shared/PageHeader"
import { TaskTriggerRepeatCards } from "@/components/task/TaskTriggerRepeatCards"
import { HelpTooltip } from "@/components/shared/HelpTooltip"
import { RepeatOccurrencesField } from "@/components/task/RepeatOccurrencesField"
import { Button } from "@/components/ui/button"
import { NavHistoryButtons } from "@/components/shared/NavHistoryButtons"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { DurationInput } from "@/components/shared/DurationInput"
import { StepsEditor } from "@/components/task/StepsEditor"
import {
  AiStepsButton,
  type StepsAutofillPhase,
} from "@/components/task/AiStepsButton"
import { StepsSkeletonList } from "@/components/task/StepsSkeletonList"
import {
  estimateStepCount,
  generateTaskSteps,
} from "@/services/ai/ai-scenarios"
import { extractAiError } from "@/services/ai/ai"
import { useUiStore } from "@/store/ui-store"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format, startOfDay } from "date-fns"
import {
  CalendarIcon,
  CalendarMinus,
  CalendarPlus,
  Check,
  Flag,
  Layers,
  ListChecks,
  MoreVertical,
  Play,
  RotateCcw,
  SkipForward,
  Trash,
  Undo2,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { ActivityItem } from "@/components/task/ActivityItem"
import { useLanguage } from "@/components/shared/language-provider"
import { useTaskActivities } from "@/hooks/use-activities"
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useNavigate,
  useParams,
  useRouteError,
} from "react-router"
import type { TaskDetailLoaderData } from "@/router/loaders"
import type { DayRunEntity as DayRunRow } from "@/domain/entities/TaskRuntimeEntity"
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog"
import { ChecklistDialog } from "@/components/dialogs/ChecklistDialog"
import { FlowPanelTask } from "@/components/flow/FlowPanel"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GoalSelect } from "@/components/goal/GoalSelect"
import { useTaskGoalRebind } from "@/hooks/use-task-goal-rebind"
import type { SelectTriggerMode } from "@/components/trigger/TriggerPanel"
import { InLineSwitchEditor } from "@/components/shared/InLineSwitchEditor"
import {
  SettingField,
  SettingFieldTitle,
} from "@/components/shared/setting-field"
import { Input } from "@/components/ui/input"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  ActivityID,
  DurationInMinutes,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import { createStep } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import type { ActiveRepeatRule } from "@/domain/value-objects/repeatRule"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import { computeProjectedConductedCount } from "@/utils/repeat-count"
import {
  mergeDateAndTime,
  timeStringFromDate,
  toLocalDateKey,
} from "@/utils/date"
import { classifyTask } from "@/utils/task-classify"
import {
  TaskCompletionControl,
  type CompletionActionItem,
  type CompletionPrimaryAction,
} from "@/components/task/TaskCompletionControl"
import { TaskCompletionBadge } from "@/components/task/TaskCompletionBadge"
import { TaskForcedHoverCard } from "@/components/shared/ForcedReasonHoverCard"
import { TaskRuntimeBadge } from "@/components/task/TaskRuntimeBadge"
import { DueBadge } from "@/components/shared/DueBadge"
import { Badge } from "@/components/ui/badge"
import { CompletionRecordsDialog } from "@/components/task/CompletionRecordsDialog"
import { TaskRunsDialog } from "@/components/task/TaskRunsDialog"
import { useTaskRuns } from "@/hooks/use-task-runs"
import {
  useTaskCompletionRecords,
  useTaskRepeatLedger,
} from "@/hooks/use-completion"
import {
  addCompletionRecord,
  removeCompletionRecord,
  setRepeatPointStatus,
  updateCompletionRecordDate,
} from "@/commands/completion.commands"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"
import { EMPTY_DAY_RUN_MAP, useDayRunMap } from "@/hooks/use-day-runs"
import { toast } from "sonner"
import { isDateOutsideGoalRange, toClosedDayRange } from "@/utils/repeat-window"
import { translateScheduleValidationError } from "@/utils/repeat-validation"
import { useRepeatDraft, useTriggerWindowDraft } from "@/hooks/use-repeat-draft"
import { useTaskDetailPageStore } from "@/store/pages/task-detail-page.store"
import {
  canAddRunToday,
  findLatestDoneRun,
  getTaskRuntimeEntries,
  selectCompletionRuntime,
} from "@/utils/task-runtime"
import {
  buildDefaultTriggerRule,
  validateTriggerDraft,
} from "@/utils/trigger-draft"
import {
  deleteTaskTrigger,
  saveTaskTrigger,
} from "@/commands/task-trigger.commands"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { TaskDetailPageVM } from "@/domain/view-models/TaskDetailPageVM"
import { useTaskDetailPageVM } from "@/hooks/use-page-view-models"

function areSameRepeatRules(
  left?: ActiveRepeatRule,
  right?: ActiveRepeatRule
): boolean {
  if (!left || !right) {
    return left == null && right == null
  }

  if (left.mode === "daily") {
    return right.mode === "daily" && left.interval === right.interval
  }

  return (
    right.mode === "weekly" &&
    left.interval === right.interval &&
    left.daysOfWeek.length === right.daysOfWeek.length &&
    left.daysOfWeek.every((day, index) => day === right.daysOfWeek[index])
  )
}

// Canonical string form of a repeat rule (sorted weekdays) for signature
// comparison between the persisted config and the live draft.
function serializeRepeatRule(rule: ActiveRepeatRule): string {
  if (rule.mode === "daily") {
    return `daily:${rule.interval}`
  }
  return `weekly:${rule.interval}:${[...rule.daysOfWeek]
    .sort((a, b) => a - b)
    .join(",")}`
}

// Stable string form of a trigger draft (rule + window) for dirty comparison.
function serializeTrigger(
  rule: triggerRule | null,
  startsAt?: Date,
  endsAt?: Date
): string {
  if (!rule) return "none"
  let base: string
  switch (rule.mode) {
    case "daily":
      base = `daily:${rule.interval}`
      break
    case "weekly":
      base = `weekly:${rule.interval}:${[...rule.daysOfWeek]
        .sort((a, b) => a - b)
        .join(",")}`
      break
    case "monthly":
      base = `monthly:${rule.dayOfMonth}`
      break
    case "custom":
      base = `custom:${rule.date
        .map((d) => d.getTime())
        .sort((a, b) => a - b)
        .join(",")}`
      break
    default: {
      const exhausted: never = rule
      return exhausted
    }
  }
  return `${base}|${startsAt?.getTime() ?? ""}|${endsAt?.getTime() ?? ""}`
}

function areSameOptionalDates(left?: Date, right?: Date): boolean {
  if (!left && !right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  return startOfDay(left).getTime() === startOfDay(right).getTime()
}

/** Route error UI: 404 from the loader renders the "task not found" copy. */
export function TaskDetailErrorBoundary() {
  const error = useRouteError()
  const { t } = useLanguage()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="heading-2 text-muted-foreground">
          {t.taskDetail.taskNotFound}
        </p>
      </div>
    )
  }
  throw error
}

export function TaskDetail() {
  const { id: taskId = "" } = useParams()
  const { t } = useLanguage()
  const initial = useLoaderData<TaskDetailLoaderData>()

  const {
    vm: taskDetailPageVM,
    goalForTask,
    goalTasks,
    dependencyForTask,
  } = useTaskDetailPageVM(taskId as TaskID | undefined, initial)
  const deleteTaskTarget = useTaskDetailPageStore(
    (state) => state.deleteTaskTarget
  )
  const setDeleteTaskTarget = useTaskDetailPageStore(
    (state) => state.setDeleteTaskTarget
  )
  const resetUiState = useTaskDetailPageStore((state) => state.resetUiState)
  const taskHistory = useTaskActivities(taskId || undefined)

  useEffect(() => {
    resetUiState()
    return () => {
      resetUiState()
    }
  }, [taskId, resetUiState])

  useEffect(() => {
    if (
      deleteTaskTarget &&
      !goalTasks.some((goalTask) => goalTask.id === deleteTaskTarget)
    ) {
      setDeleteTaskTarget(null)
    }
  }, [deleteTaskTarget, goalTasks, setDeleteTaskTarget])

  // The loader guarantees first-frame data; this only remains reachable if the
  // task is deleted (locally or by sync) while the page is open.
  if (!taskDetailPageVM) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="heading-2 text-muted-foreground">
          {t.taskDetail.taskNotFound}
        </p>
      </div>
    )
  }

  return (
    <TaskDetailContent
      key={taskDetailPageVM.task.id}
      taskDetailPageVM={taskDetailPageVM}
      goalForTask={goalForTask}
      goalTasks={goalTasks}
      dependencyForTask={dependencyForTask}
      taskHistory={taskHistory}
      initialDayRuns={initial?.dayRuns}
    />
  )
}

type TaskDetailContentProps = {
  taskDetailPageVM: TaskDetailPageVM
  goalForTask: GoalEntity | null
  goalTasks: TaskGroupEntity[]
  dependencyForTask: DependencyEntity | null
  taskHistory: ReturnType<typeof useTaskActivities>
  initialDayRuns?: DayRunRow[]
}

function TaskDetailContent({
  taskDetailPageVM,
  goalForTask,
  goalTasks,
  dependencyForTask,
  taskHistory,
  initialDayRuns,
}: TaskDetailContentProps) {
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const isDeleteOpen = useTaskDetailPageStore((state) => state.isDeleteOpen)
  const setIsDeleteOpen = useTaskDetailPageStore((state) => state.setDeleteOpen)
  const deleteTaskTarget = useTaskDetailPageStore(
    (state) => state.deleteTaskTarget
  )
  const setDeleteTaskTarget = useTaskDetailPageStore(
    (state) => state.setDeleteTaskTarget
  )
  const transitionTaskStatus = useAppStore((s) => s.transitionTaskStatus)
  const upsertStepsCompleted = useAppStore((s) => s.upsertStepsCompleted)
  const removeTaskRuntime = useAppStore((s) => s.removeTaskRuntime)
  const skipRepeatTask = useAppStore((s) => s.skipRepeatTask)
  const resolveRepeatDebt = useAppStore((s) => s.resolveRepeatDebt)
  // The route loader supplies the first frame, so the completion control
  // renders its real state from the very first paint (no skeleton frame);
  // undefined only remains possible without a loader (stories/tests).
  const dayRunMap = useDayRunMap(initialDayRuns)
  const taskRuntime = dayRunMap ?? EMPTY_DAY_RUN_MAP
  const [dueDate, setDueDate] = useState<Date | undefined>(
    taskDetailPageVM.task.dueAt
      ? startOfDay(taskDetailPageVM.task.dueAt)
      : undefined
  )
  const [dueTime, setDueTime] = useState<string>(
    taskDetailPageVM.task.dueAt
      ? timeStringFromDate(taskDetailPageVM.task.dueAt)
      : "23:59"
  )
  const [repeatMode, setRepeatMode] = useState<"none" | "daily" | "weekly">(
    () => taskDetailPageVM.task.repeat?.rule.mode ?? "none"
  )
  const [repeatInterval, setRepeatInterval] = useState<number>(
    () => taskDetailPageVM.task.repeat?.rule.interval ?? 1
  )
  const [repeatDaysOfWeek, setRepeatDaysOfWeek] = useState<number[]>(() => {
    const rule = taskDetailPageVM.task.repeat?.rule
    return rule?.mode === "weekly" ? rule.daysOfWeek : []
  })
  const [repeatStartsAt, setRepeatStartsAt] = useState<Date | undefined>(
    taskDetailPageVM.task.repeat?.startsAt
  )
  const [repeatEndsAt, setRepeatEndsAt] = useState<Date | undefined>(
    taskDetailPageVM.task.repeat?.endsAt
  )
  const [totalDraft, setTotalDraft] = useState<number>(
    () => taskDetailPageVM.task.total
  )
  // The whole schedule area is a single draft committed by one Save/Cancel.
  // The component is keyed by task.id (remounts per task), so initialising every
  // draft from the task here is correct per task.
  const [durationDraft, setDurationDraft] = useState<
    DurationInMinutes | undefined
  >(() => taskDetailPageVM.task.estimatedDuration)
  const [allowCrossDayDraft, setAllowCrossDayDraft] = useState<boolean>(
    () => taskDetailPageVM.task.allowCrossDay ?? false
  )
  const [triggerEnabledDraft, setTriggerEnabledDraft] = useState<boolean>(
    () => taskDetailPageVM.task.trigger != null
  )
  const [triggerDraft, setTriggerDraft] = useState<triggerRule | null>(
    () => taskDetailPageVM.task.trigger?.rule ?? null
  )
  const [triggerStartsAt, setTriggerStartsAt] = useState<Date | undefined>(
    () => taskDetailPageVM.task.trigger?.startsAt
  )
  const [triggerEndsAt, setTriggerEndsAt] = useState<Date | undefined>(
    () => taskDetailPageVM.task.trigger?.endsAt
  )
  const [taskNoteDraft, setTaskNoteDraft] = useState(
    taskDetailPageVM.task.notes ?? ""
  )
  const taskNoteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [stepInput, setStepInput] = useState("")
  const [checklistTarget, setChecklistTarget] = useState<{
    runtimeId?: TaskRuntimeID
    steps: { id: string; title: string; done: boolean }[]
  } | null>(null)

  const isFinished =
    taskDetailPageVM.task.completedCount >= taskDetailPageVM.task.total

  const completionCategory = classifyTask(taskDetailPageVM.task)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const completionRecords = useTaskCompletionRecords(taskDetailPageVM.task.id)
  const repeatPoints = useTaskRepeatLedger(taskDetailPageVM.task.id)

  // The runtime representing "today's occurrence" the action model acts on.
  // For repeat: today's planned point, or a manual-pull runtime (id=taskId,
  // source "manual"). For others: the single id=taskId runtime.
  const todayCompletionRuntime = useMemo(
    () => selectCompletionRuntime(taskRuntime, taskDetailPageVM.task),
    [taskRuntime, taskDetailPageVM.task]
  )

  // Status-aware completion action model: a primary action + dropdown of
  // secondary actions, derived from category + runtime state + count.
  const addTaskRun = useAppStore((s) => s.addTaskRun)

  // Today's items for this task. More than one, and not equivalent (repeat debt,
  // or mixed sources), means no single item owns the header's quick action.
  const [isRunsOpen, setIsRunsOpen] = useState(false)
  const { rows: taskRuns, interchangeable: runsInterchangeable } = useTaskRuns(
    taskDetailPageVM.task.id
  )
  const needsRunsDialog = taskRuns.length > 1 && !runsInterchangeable
  const transitionRunStatus = useAppStore((s) => s.transitionTaskStatus)
  const removeRun = useAppStore((s) => s.removeTaskRuntime)

  const completionAction = useMemo(() => {
    const task = taskDetailPageVM.task
    const rt = todayCompletionRuntime
    const status = rt?.arrangementStatus
    const pulledByRepeat = rt?.source === "repeatPolicy"
    const isMulti = task.total > 1
    const hasSteps = (task.steps ?? []).length > 0
    const latestDoneRun = findLatestDoneRun(taskRuntime, task.id)

    const doneGuarded = (runtimeId: TaskRuntimeID) => () => {
      if (hasSteps)
        setChecklistTarget({
          runtimeId,
          steps: taskDetailPageVM.checklistSteps,
        })
      else transitionTaskStatus(runtimeId, "done")
    }
    const undoSingle = () => {
      const doneRuntime = getTaskRuntimeEntries(taskRuntime, task.id).find(
        (r) => r.arrangementStatus === "done"
      )
      if (doneRuntime) {
        transitionTaskStatus(doneRuntime.id, "todo")
        return
      }
      // Trigger completions are activity-backed (completedCount is recounted
      // from task-done activities), so retract the newest record rather than
      // decrementing the counter and leaving the activity to resurrect it.
      const latestRecord = completionRecords[completionRecords.length - 1]
      if (completionCategory === "trigger" && latestRecord) {
        void removeCompletionRecord(
          task,
          latestRecord.id as ActivityID,
          t.commands.taskUpdateFailed
        )
        return
      }
      void updateTask(
        task.id,
        { completedCount: Math.max(0, task.completedCount - 1) },
        t.commands.taskUpdateFailed
      )
    }
    const markDoneDirect = () => {
      if (hasSteps)
        setChecklistTarget({
          runtimeId: taskDetailPageVM.completionRuntimeId,
          steps: taskDetailPageVM.checklistSteps,
        })
      else
        void updateTask(
          task.id,
          { completedCount: task.completedCount + 1 },
          t.commands.taskUpdateFailed
        )
    }

    // ── primary ──
    let primary: CompletionPrimaryAction
    if (needsRunsDialog) {
      // Several items today that are NOT equivalent: no single one owns this
      // button, so it opens the dialog rather than silently picking one. The
      // dropdown below stays — it holds the actions that need no such choice.
      primary = {
        key: "runs",
        label: t.taskRuns.openLabel(taskRuns.length),
        icon: <Layers />,
        tone: "neutral",
        onSelect: () => setIsRunsOpen(true),
      }
    } else if (
      (completionCategory === "single" || completionCategory === "trigger") &&
      isFinished
    ) {
      // Trigger tasks are single-run too: once finished, the only sane header
      // action is retracting the completion — "add to today" would mint an
      // occurrence the task doesn't have (completedCount past total).
      primary = {
        key: "undo",
        label: t.actions.undoComplete,
        icon: <Undo2 />,
        tone: "done",
        onSelect: undoSingle,
      }
    } else if (rt) {
      if (status === "todo") {
        primary = {
          key: "play",
          label: t.actions.markInProgress,
          icon: <Play />,
          tone: "neutral",
          onSelect: () => transitionTaskStatus(rt.id, "inProgress"),
        }
      } else if (status === "inProgress") {
        primary = {
          key: "done",
          label: t.actions.markDone,
          icon: <Check />,
          tone: "neutral",
          onSelect: doneGuarded(rt.id),
        }
      } else {
        primary = {
          key: "undo",
          label: t.actions.undoComplete,
          icon: <Undo2 />,
          tone: "done",
          onSelect: () => transitionTaskStatus(rt.id, "todo"),
        }
      }
    } else if (task.repeat != null) {
      // A repeat task's items belong to the ledger. A hand-added run carries no
      // ledger point, so completing it could never be recorded there and the
      // completedCount invariant would erase it. With nothing pulled in today,
      // the header's one meaningful act is editing the ledger directly — a
      // single button, no dropdown group.
      return {
        primary: {
          key: "records",
          label: t.taskDetail.customCompletion,
          icon: <ListChecks />,
          tone: "neutral",
          onSelect: () => setRecordsOpen(true),
        } satisfies CompletionPrimaryAction,
        secondary: [] as CompletionActionItem[],
      }
    } else {
      primary = {
        key: "addToday",
        label: t.actions.addToToday,
        icon: <CalendarPlus />,
        tone: "neutral",
        // addTaskRun, not a fixed-id upsert: the id must be free, or pulling the
        // task in again would overwrite an existing item instead of adding one.
        onSelect: () => addTaskRun(task.id),
      }
    }

    // ── secondary (independent rules) ──
    const secondary: CompletionActionItem[] = []

    // A counter task with budget left can always be pulled in for another go —
    // including while one is already done, which is the whole point of a counter.
    if (canAddRunToday(task, taskRuntime)) {
      secondary.push({
        key: "runAgain",
        label: rt ? t.actions.runAgain : t.actions.addToToday,
        icon: rt ? <RotateCcw /> : <CalendarPlus />,
        onSelect: () => addTaskRun(task.id),
      })
    }

    // With several completions today, the primary "undo" may not even be showing
    // (it depends which item the header picked), so retracting one needs its own
    // entry. Always acts on the most recent completion.
    if (isMulti && latestDoneRun) {
      secondary.push({
        key: "undoOnce",
        label: t.actions.undoOnce,
        icon: <Undo2 />,
        onSelect: () => transitionTaskStatus(latestDoneRun.id, "todo"),
      })
    }

    if (isMulti) {
      secondary.push({
        key: "records",
        label: t.taskDetail.customCompletion,
        icon: <ListChecks />,
        onSelect: () => setRecordsOpen(true),
      })
    }
    // Skip / exclude act on ONE item, so they only make sense when a single item
    // owns the header; with several, they belong in the dialog (per-item rows).
    // Done is reverted via the primary "undo"; never offer remove/skip on done
    // (it would orphan completedCount + activity / desync the ledger).
    if (!needsRunsDialog && rt && status !== "done") {
      if (pulledByRepeat) {
        secondary.push({
          key: "skip",
          label: t.actions.skip,
          icon: <SkipForward />,
          onSelect: () => skipRepeatTask(rt.id),
        })
      } else if (rt.source === "duePolicy" && task.dueAt != null) {
        // Due-policy forced: removing is a silent no-op (replan re-adds it).
        // Mirror My Tasks / Home — disable Exclude and explain via hovercard.
        const dueAt = task.dueAt
        secondary.push({
          key: "remove",
          label: t.actions.excludeFromToday,
          icon: <CalendarMinus />,
          disabled: true,
          wrap: (node) => (
            <TaskForcedHoverCard
              taskId={task.id}
              taskTitle={task.title}
              dueAt={dueAt}
              goalId={task.goalId}
              goalTitle={taskDetailPageVM.goalTitle}
            >
              {node}
            </TaskForcedHoverCard>
          ),
          onSelect: () => {},
        })
      } else {
        secondary.push({
          key: "remove",
          label: t.actions.excludeFromToday,
          icon: <CalendarMinus />,
          variant: "destructive",
          onSelect: () => removeTaskRuntime(rt.id),
        })
      }
    }
    if (!needsRunsDialog && !rt && task.total === 1 && !isFinished) {
      secondary.push({
        key: "markDone",
        label: t.actions.markDone,
        icon: <Check />,
        onSelect: markDoneDirect,
      })
    }

    return { primary, secondary }
  }, [
    completionCategory,
    completionRecords,
    isFinished,
    removeTaskRuntime,
    skipRepeatTask,
    t,
    taskDetailPageVM.task,
    taskDetailPageVM.goalTitle,
    taskDetailPageVM.checklistSteps,
    taskDetailPageVM.completionRuntimeId,
    taskRuntime,
    todayCompletionRuntime,
    transitionTaskStatus,
    addTaskRun,
    needsRunsDialog,
    taskRuns.length,
  ])

  const commitTaskPatch = useCallback(
    (patch: Parameters<typeof updateTask>[1]) => {
      void updateTask(
        taskDetailPageVM.task.id,
        patch,
        t.commands.taskUpdateFailed
      )
    },
    [taskDetailPageVM.task.id, t]
  )

  // ── AI step autofill ──
  const aiSettings = useAppStore((s) => s.aiSettings)
  const [stepsAiPhase, setStepsAiPhase] = useState<StepsAutofillPhase>("idle")
  const [stepsAiCount, setStepsAiCount] = useState(3)

  const showAiError = useCallback(
    (err: unknown) => {
      const { code } = extractAiError(err)
      const isNetwork =
        code === "timeout" ||
        code === "serverError" ||
        code === "badGateway" ||
        code === "serviceUnavailable"
      const msg = isNetwork ? t.ai.errorNetwork : t.ai.errorApi
      toast.error(msg, {
        action: {
          label: t.ai.goSettings,
          onClick: () => useUiStore.getState().openSettings("ai"),
        },
      })
    },
    [t]
  )

  const handleAutofillSteps = async () => {
    const task = taskDetailPageVM.task
    const hasKey =
      aiSettings.provider === "deepseek"
        ? !!aiSettings.deepseekApiKey
        : !!aiSettings.openRouterApiKey
    if (!hasKey) {
      toast.error(t.ai.noApiKey, {
        action: {
          label: t.ai.goSettings,
          onClick: () => useUiStore.getState().openSettings("ai"),
        },
      })
      return
    }
    const input = {
      id: task.id,
      title: task.title,
      description: task.description,
      steps: task.steps,
      goalTitle: goalForTask?.title,
    }
    setStepsAiPhase("counting")
    try {
      const count = await estimateStepCount(aiSettings, input, language)
      setStepsAiCount(count)
      setStepsAiPhase("filling")
      const steps = await generateTaskSteps(aiSettings, input, "", language)
      if (steps.length > 0) {
        commitTaskPatch({ steps: steps.map(createStep) })
      } else {
        showAiError(new Error("Empty AI response"))
      }
    } catch (err) {
      showAiError(err)
    } finally {
      setStepsAiPhase("idle")
    }
  }

  const goalRebind = useTaskGoalRebind()
  const [isEditGoalOpen, setIsEditGoalOpen] = useState(false)

  const dueLabel = useMemo(() => {
    if (!dueDate) return t.taskDetail.notSet
    return format(mergeDateAndTime(dueDate, dueTime), "PPP HH:mm")
  }, [dueDate, dueTime, t])

  const isStandaloneTask = !taskDetailPageVM.task.goalId
  const isTriggerGoalForTask = goalForTask?.trigger != null
  const taskTrigger = taskDetailPageVM.task.trigger ?? null
  const isTaskTriggerEnabled = taskTrigger != null
  // Draft-driven mutual exclusivity: enabling the trigger draft disables the
  // repeat fields and the due picker; choosing a repeat mode disables the trigger
  // switch. (Repeat is blocked outright under a trigger-goal.)
  const isRepeatTaskForCrossDay = repeatMode !== "none"
  const isDueDisabledByTrigger = triggerEnabledDraft
  const goalTasksById = useMemo(
    () =>
      Object.fromEntries(goalTasks.map((task) => [task.id, task])) as Record<
        string,
        TaskGroupEntity | undefined
      >,
    [goalTasks]
  )

  const editableNodeIds = useMemo(() => {
    if (!dependencyForTask) return []
    const index = dependencyForTask.tree.findIndex(
      (node) => node.data === taskDetailPageVM.task.id
    )
    return index >= 0 ? [String(index)] : []
  }, [dependencyForTask, taskDetailPageVM.task.id])

  const {
    rule: repeatRuleForPreview,
    draftConfig: repeatDraftConfig,
    validation: repeatValidation,
    explicitRange: explicitRepeatRange,
    periodDraftValue: repeatPeriodDraftValue,
    periodMessage: repeatPeriodMessage,
    totalLimitMessage,
    calendarModifiers: repeatCalendarModifiers,
    calendarModifierClassNames: repeatCalendarModifierClassNames,
    previewModifiers: previewCalendarModifiers,
    previewModifierClassNames: previewCalendarModifierClassNames,
  } = useRepeatDraft({
    mode: repeatMode,
    interval: repeatInterval,
    daysOfWeek: repeatDaysOfWeek,
    startsAt: repeatStartsAt,
    endsAt: repeatEndsAt,
    goal: goalForTask ?? undefined,
    fallbackStart: taskDetailPageVM.task.createdAt,
    dependency: dependencyForTask,
    currentNodeData: taskDetailPageVM.task.id,
    tasksById: goalTasksById,
    messages: {
      periodRequired: t.taskDetail.repeatPeriodRequired,
      pickBothDates: t.taskDetail.pickBothDates,
    },
    resolveError: (error) => translateScheduleValidationError(error, t),
    total: totalDraft,
    totalExceedsMessage: t.taskDetail.totalExceedsOccurrences,
  })

  const { validation: triggerWindowValidation, message: triggerPeriodMessage } =
    useTriggerWindowDraft({
      enabled: triggerEnabledDraft,
      startsAt: triggerStartsAt,
      endsAt: triggerEndsAt,
      goal: goalForTask ?? undefined,
      fallbackStart: taskDetailPageVM.task.createdAt,
      dependency: dependencyForTask,
      currentNodeData: taskDetailPageVM.task.id,
      tasksById: goalTasksById,
      pickBothMessage: t.taskDetail.triggerPeriodPickBoth,
      resolveError: (error) => translateScheduleValidationError(error, t),
    })

  useEffect(() => {
    if (!goalForTask && taskDetailPageVM.task.repeat != null) {
      commitTaskPatch({ repeat: undefined })
    }
  }, [commitTaskPatch, goalForTask, taskDetailPageVM.task.repeat])

  // DB-consistency guard for an inconsistent *persisted* state (a task should
  // never have both a repeat and a trigger/trigger-goal). Uses persisted flags,
  // not the draft, so toggling the trigger switch never commits prematurely.
  const isRepeatBlockedByPersistedTrigger =
    isTriggerGoalForTask || isTaskTriggerEnabled
  useEffect(() => {
    if (
      !isRepeatBlockedByPersistedTrigger ||
      taskDetailPageVM.task.repeat == null
    ) {
      return
    }

    queueMicrotask(() => {
      setRepeatMode("none")
      setRepeatInterval(1)
      setRepeatDaysOfWeek([])
      setRepeatStartsAt(undefined)
      setRepeatEndsAt(undefined)
    })
    commitTaskPatch({ repeat: undefined })
  }, [
    commitTaskPatch,
    isRepeatBlockedByPersistedTrigger,
    taskDetailPageVM.task.repeat,
  ])

  // Standalone tasks, tasks under a trigger-goal, and tasks with their own
  // trigger are always single-occurrence.
  useEffect(() => {
    if (
      !isStandaloneTask &&
      !isTriggerGoalForTask &&
      taskDetailPageVM.task.trigger == null
    ) {
      return
    }

    if (taskDetailPageVM.task.total !== 1) {
      commitTaskPatch({ total: 1 })
    }
  }, [
    commitTaskPatch,
    isStandaloneTask,
    isTriggerGoalForTask,
    taskDetailPageVM.task.total,
    taskDetailPageVM.task.trigger,
  ])

  // Reactive trigger-rule validity covering every case (weekly without days,
  // custom without dates, half-filled window) so the unified Save can be disabled
  // and the error shown inline, instead of only toasting on click.
  const triggerDraftMessage = triggerEnabledDraft
    ? (validateTriggerDraft(triggerDraft, t) ??
      triggerPeriodMessage ??
      (triggerWindowValidation.error
        ? translateScheduleValidationError(triggerWindowValidation.error, t)
        : null))
    : null

  useEffect(() => {
    if (taskNoteDebounceRef.current) {
      clearTimeout(taskNoteDebounceRef.current)
      taskNoteDebounceRef.current = null
    }

    const normalizedDraft = taskNoteDraft.trim()
    const normalizedCurrent = (taskDetailPageVM.task.notes ?? "").trim()

    if (normalizedDraft === normalizedCurrent) {
      return
    }

    taskNoteDebounceRef.current = setTimeout(() => {
      commitTaskPatch({
        notes: normalizedDraft.length > 0 ? normalizedDraft : undefined,
      })
      taskNoteDebounceRef.current = null
    }, 300)

    return () => {
      if (taskNoteDebounceRef.current) {
        clearTimeout(taskNoteDebounceRef.current)
        taskNoteDebounceRef.current = null
      }
    }
  }, [commitTaskPatch, taskDetailPageVM.task.notes, taskNoteDraft])

  const isRepeatDirty = useMemo(() => {
    const currentRepeat = taskDetailPageVM.task.repeat
    const repeatSame =
      areSameRepeatRules(currentRepeat?.rule, repeatDraftConfig?.rule) &&
      areSameOptionalDates(
        currentRepeat?.startsAt,
        repeatDraftConfig?.startsAt
      ) &&
      areSameOptionalDates(currentRepeat?.endsAt, repeatDraftConfig?.endsAt)
    return !repeatSame || totalDraft !== taskDetailPageVM.task.total
  }, [
    repeatDraftConfig,
    taskDetailPageVM.task.repeat,
    taskDetailPageVM.task.total,
    totalDraft,
  ])

  // Effective draft due datetime — only meaningful in plain mode.
  const draftDueAt =
    repeatMode === "none" && !triggerEnabledDraft && dueDate
      ? mergeDateAndTime(dueDate, dueTime)
      : undefined

  const isTriggerDirty = useMemo(() => {
    if (triggerEnabledDraft !== isTaskTriggerEnabled) return true
    if (!triggerEnabledDraft) return false
    const persisted = taskDetailPageVM.task.trigger
    return (
      serializeTrigger(triggerDraft, triggerStartsAt, triggerEndsAt) !==
      serializeTrigger(
        persisted?.rule ?? null,
        persisted?.startsAt,
        persisted?.endsAt
      )
    )
  }, [
    triggerEnabledDraft,
    isTaskTriggerEnabled,
    triggerDraft,
    triggerStartsAt,
    triggerEndsAt,
    taskDetailPageVM.task.trigger,
  ])

  const isDueDirty = !areSameOptionalDates(
    taskDetailPageVM.task.dueAt,
    draftDueAt
  )
  const isDurationDirty =
    (durationDraft ?? undefined) !==
    (taskDetailPageVM.task.estimatedDuration ?? undefined)
  const isAllowCrossDayDirty =
    allowCrossDayDraft !== (taskDetailPageVM.task.allowCrossDay ?? false)

  const isScheduleDirty =
    isDueDirty ||
    isDurationDirty ||
    isAllowCrossDayDirty ||
    isRepeatDirty ||
    isTriggerDirty

  // Reactive gate for the unified Save button — covers repeat + trigger.
  const scheduleInvalid = triggerEnabledDraft
    ? triggerDraftMessage != null
    : repeatMode !== "none"
      ? repeatValidation.error != null ||
        totalLimitMessage != null ||
        !explicitRepeatRange
      : false

  const handleTriggerToggle = (checked: boolean) => {
    setTriggerEnabledDraft(checked)
    if (checked) {
      if (!triggerDraft) setTriggerDraft(buildDefaultTriggerRule("daily"))
      // Trigger is mutually exclusive with repeat and a due date — clear those
      // drafts so the panels reflect the single active mode.
      setRepeatMode("none")
      setRepeatInterval(1)
      setRepeatDaysOfWeek([])
      setRepeatStartsAt(undefined)
      setRepeatEndsAt(undefined)
      setDueDate(undefined)
      setDueTime("23:59")
    }
  }

  const handleTriggerModeChange = (mode: SelectTriggerMode) => {
    if (!mode) return
    const nextRule =
      triggerDraft?.mode === mode ? triggerDraft : buildDefaultTriggerRule(mode)
    setTriggerDraft(nextRule)
    // Custom triggers fire on explicit dates, so a validity window is redundant
    // (and would wrongly filter those dates). Clear it when switching to custom.
    if (mode === "custom") {
      setTriggerStartsAt(undefined)
      setTriggerEndsAt(undefined)
    }
  }

  const fillEstimatedOccurrences = () => {
    if (
      !explicitRepeatRange ||
      repeatValidation.error ||
      !repeatRuleForPreview
    ) {
      return
    }

    const calculated = computeProjectedConductedCount(
      explicitRepeatRange.start,
      explicitRepeatRange.end,
      repeatRuleForPreview
    )
    setTotalDraft(calculated)
  }

  // Signature of the persisted repeat config (day-normalized window + rule) so
  // the reactive auto-fill below can tell an actual edit apart from the initial
  // load / a Cancel that restores the persisted values. Canonical serialization
  // (sorted weekdays, no reliance on key order) keeps it comparable to the draft.
  const persistedRepeatSignature = useMemo(() => {
    const repeat = taskDetailPageVM.task.repeat
    if (!repeat) return null
    const range = toClosedDayRange(repeat.startsAt, repeat.endsAt)
    if (!range) return null
    return `${+range.start}|${+range.end}|${serializeRepeatRule(repeat.rule)}`
  }, [taskDetailPageVM.task.repeat])

  // Reactively seed the occurrence count from the repeat rule + window whenever
  // they differ from what was persisted. Skipping the persisted signature keeps
  // the saved count on initial load and after Cancel; any genuine rule/window
  // change recomputes the estimate. Manual edits to totalDraft survive because
  // this effect does not depend on totalDraft.
  useEffect(() => {
    if (
      !explicitRepeatRange ||
      repeatValidation.error ||
      !repeatRuleForPreview
    ) {
      return
    }

    const signature = `${+explicitRepeatRange.start}|${+explicitRepeatRange.end}|${serializeRepeatRule(repeatRuleForPreview)}`
    if (signature === persistedRepeatSignature) {
      return
    }

    const calculated = computeProjectedConductedCount(
      explicitRepeatRange.start,
      explicitRepeatRange.end,
      repeatRuleForPreview
    )
    setTotalDraft(calculated)
  }, [
    explicitRepeatRange,
    repeatRuleForPreview,
    repeatValidation.error,
    persistedRepeatSignature,
  ])

  const addStep = () => {
    const trimmed = stepInput.trim()
    if (!trimmed) return
    commitTaskPatch({
      steps: [...(taskDetailPageVM.task.steps ?? []), createStep(trimmed)],
    })
    toast.success(t.taskDetail.stepAdded)
    setStepInput("")
  }

  // One Cancel reverts the whole schedule draft back to the persisted task.
  const onScheduleCancel = () => {
    const task = taskDetailPageVM.task
    const persistedRepeat = task.repeat
    setRepeatMode(persistedRepeat?.rule.mode ?? "none")
    setRepeatInterval(persistedRepeat?.rule.interval ?? 1)
    setRepeatDaysOfWeek(
      persistedRepeat?.rule.mode === "weekly"
        ? persistedRepeat.rule.daysOfWeek
        : []
    )
    setRepeatStartsAt(persistedRepeat?.startsAt)
    setRepeatEndsAt(persistedRepeat?.endsAt)
    setTotalDraft(task.total)
    setDueDate(task.dueAt ? startOfDay(task.dueAt) : undefined)
    setDueTime(task.dueAt ? timeStringFromDate(task.dueAt) : "23:59")
    setDurationDraft(task.estimatedDuration)
    setAllowCrossDayDraft(task.allowCrossDay ?? false)
    setTriggerEnabledDraft(task.trigger != null)
    setTriggerDraft(task.trigger?.rule ?? null)
    setTriggerStartsAt(task.trigger?.startsAt)
    setTriggerEndsAt(task.trigger?.endsAt)
  }

  // One Save commits the whole schedule draft, routing through the right command
  // for the active mode (trigger / repeat / plain). Mutually exclusive by UI.
  const onScheduleSave = () => {
    if (!isScheduleDirty || scheduleInvalid) return
    void (async () => {
      const id = taskDetailPageVM.task.id
      const lockedTotal =
        isStandaloneTask || isTriggerGoalForTask ? 1 : totalDraft

      if (triggerEnabledDraft) {
        // Trigger mode: clear any persisted repeat + task-level fields first,
        // then persist the trigger (atomic save also clears dueAt).
        const isCustom = triggerDraft?.mode === "custom"
        const cleared = await updateTask(
          id,
          {
            repeat: undefined,
            // Trigger tasks are single-run — each fire is the one occurrence.
            total: 1,
            estimatedDuration: durationDraft,
            allowCrossDay: allowCrossDayDraft,
          },
          t.commands.taskUpdateFailed
        )
        if (!cleared) return
        const saved = await saveTaskTrigger(id, {
          rule: triggerDraft!,
          startsAt: isCustom ? undefined : triggerStartsAt,
          endsAt: isCustom ? undefined : triggerEndsAt,
        })
        if (!saved) return
        setDueDate(undefined)
        setDueTime("23:59")
      } else if (repeatMode !== "none") {
        // Repeat mode: drop any persisted trigger, then persist the repeat rule.
        if (isTaskTriggerEnabled) {
          const removed = await deleteTaskTrigger(id)
          if (!removed) return
        }
        const ok = await updateTask(
          id,
          {
            repeat: repeatDraftConfig,
            total: lockedTotal,
            dueAt: undefined,
            allowCrossDay: false,
            estimatedDuration: durationDraft,
          },
          t.commands.taskUpdateFailed
        )
        if (!ok) return
      } else {
        // Plain mode: switching the trigger off + Save removes it.
        if (isTaskTriggerEnabled) {
          const removed = await deleteTaskTrigger(id)
          if (!removed) return
        }
        const ok = await updateTask(
          id,
          {
            dueAt: draftDueAt,
            repeat: undefined,
            total: lockedTotal,
            allowCrossDay: allowCrossDayDraft,
            estimatedDuration: durationDraft,
          },
          t.commands.taskUpdateFailed
        )
        if (!ok) return
      }
      toast.success(t.taskDetail.scheduleSaved)
    })()
  }

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0">
      <PageHeader>
        <div className="flex w-full">
          <Header
            title={taskDetailPageVM.task.title}
            trailing={
              <div className="flex items-center gap-2">
                <TaskCompletionBadge
                  category={completionCategory}
                  completedCount={taskDetailPageVM.task.completedCount}
                  total={taskDetailPageVM.task.total}
                />
                {todayCompletionRuntime && (
                  <TaskRuntimeBadge
                    status={todayCompletionRuntime.arrangementStatus}
                    source={todayCompletionRuntime.source}
                  />
                )}
                {todayCompletionRuntime?.source === "duePolicy" &&
                  todayCompletionRuntime.arrangementStatus !== "done" &&
                  !isFinished &&
                  taskDetailPageVM.task.dueAt != null && (
                    <DueBadge dueAt={taskDetailPageVM.task.dueAt} />
                  )}
                {taskDetailPageVM.isDismissedToday && (
                  <Badge
                    size="lg"
                    variant="secondary"
                    data-testid="badge-dismissed"
                  >
                    <CalendarMinus data-icon="inline-start" />
                    {t.status.dismissedToday}
                  </Badge>
                )}
              </div>
            }
          />
        </div>
      </PageHeader>

      {/*MARK: task title */}
      <div className="flex shrink-0 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Wrapping row: the goal quick-link stays on one line and drops
              below the title as a whole when space runs out; each side
              truncates instead of squeezing the other. */}
          <div className="flex flex-wrap items-baseline-last gap-x-4 gap-y-1">
            <InLineSwitchEditor
              className="max-w-full shrink-0"
              view={
                <h2 className="heading-2 truncate">
                  {taskDetailPageVM.task.title}
                </h2>
              }
              edit={
                // field-sizing:content keeps the input as wide as its text
                // (matching the view), so switching to edit mode doesn't grow
                // the box; `size` is the fallback for browsers without it.
                <input
                  className="heading-2 field-sizing-content max-w-full border-none bg-transparent p-0 ring-0 outline-none focus:ring-0"
                  size={Math.max(taskDetailPageVM.task.title.length, 1)}
                  value={taskDetailPageVM.task.title}
                  onChange={(e) =>
                    commitTaskPatch({
                      title: e.target.value,
                    })
                  }
                />
              }
            />
            {/* Goal Quick link */}
            {taskDetailPageVM.goalTitle && taskDetailPageVM.task.goalId && (
              <p className="paragraph-small flex max-w-full items-baseline gap-1 whitespace-nowrap text-muted-foreground">
                <span className="shrink-0">{t.taskDetail.contributeTo}</span>
                <Link
                  to={`/goals/${taskDetailPageVM.task.goalId}`}
                  className="truncate text-foreground underline transition-opacity hover:opacity-80"
                >
                  {taskDetailPageVM.goalTitle}
                </Link>
              </p>
            )}
          </div>
          {/* MARK:Description */}
          <InLineSwitchEditor
            view={
              <p className="paragraph-large text-muted-foreground">
                {taskDetailPageVM.task.description ??
                  t.taskDetail.doubleClickDescription}
              </p>
            }
            edit={
              <textarea
                className="paragraph-large w-full resize-none border-none bg-transparent p-0 text-muted-foreground ring-0 outline-none focus:ring-0"
                value={taskDetailPageVM.task.description ?? ""}
                onChange={(e) =>
                  commitTaskPatch({
                    description: e.target.value,
                  })
                }
              />
            }
          />
        </div>
        <div className="m-auto flex shrink-0 items-center gap-2 pl-4">
          {/* The control is always the same shape — with several non-equivalent
              items its primary opens the dialog (see completionAction), but the
              dropdown must not disappear with it. */}
          <TaskCompletionControl
            primary={completionAction.primary}
            secondary={completionAction.secondary}
            menuLabel={t.taskDetail.customCompletion}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditGoalOpen(true)}>
                <Flag className="mr-2 size-4" />
                {isStandaloneTask
                  ? t.goalRebind.addRelationship
                  : t.goalRebind.editRelationship}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash className="mr-2 size-4" />
                {t.common.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={isEditGoalOpen} onOpenChange={setIsEditGoalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {isStandaloneTask
                    ? t.goalRebind.addRelationship
                    : t.goalRebind.editRelationship}
                </DialogTitle>
                <DialogDescription>
                  {t.goalRebind.relationshipHint}
                </DialogDescription>
              </DialogHeader>
              <GoalSelect
                value={taskDetailPageVM.task.goalId}
                onChange={(goalId) => {
                  setIsEditGoalOpen(false)
                  void goalRebind.requestRebind(
                    taskDetailPageVM.task.id,
                    goalId
                  )
                }}
                aria-label={t.goalRebind.label}
              />
            </DialogContent>
          </Dialog>
          <ConfirmDeleteDialog
            open={isDeleteOpen}
            onOpenChange={setIsDeleteOpen}
            title={t.taskDetail.deleteTaskTitle}
            description={t.taskDetail.deleteTaskDescription}
            onConfirm={() => {
              void (async () => {
                const deleted = await deleteTaskCommand(
                  taskDetailPageVM.task.id,
                  t.commands.taskDeleteFailed
                )
                if (deleted) {
                  navigate(-1)
                }
              })()
            }}
          />
          {goalRebind.dialogs}
          <ChecklistDialog
            open={checklistTarget !== null}
            onOpenChange={(open) => {
              if (!open) setChecklistTarget(null)
            }}
            steps={checklistTarget?.steps ?? []}
            onStepsChange={(ids) => {
              if (checklistTarget?.runtimeId) {
                upsertStepsCompleted(checklistTarget.runtimeId, ids)
              }
            }}
            onConfirm={() => {
              const runtimes = getTaskRuntimeEntries(
                taskRuntime,
                taskDetailPageVM.task.id
              )
              const activeRuntime = runtimes.find(
                (r) =>
                  r.arrangementStatus === "todo" ||
                  r.arrangementStatus === "inProgress"
              )
              if (activeRuntime) {
                transitionTaskStatus(activeRuntime.id, "done")
              } else {
                void updateTask(
                  taskDetailPageVM.task.id,
                  {
                    completedCount: taskDetailPageVM.task.completedCount + 1,
                  },
                  t.commands.taskUpdateFailed
                )
              }
              setChecklistTarget(null)
            }}
          />
          <TaskRunsDialog
            open={isRunsOpen}
            onOpenChange={setIsRunsOpen}
            runs={taskRuns}
            onChangeStatus={transitionRunStatus}
            onRemove={removeRun}
            onSkip={skipRepeatTask}
            onResolveDebt={resolveRepeatDebt}
            onAddRun={
              canAddRunToday(taskDetailPageVM.task, taskRuntime)
                ? () => addTaskRun(taskDetailPageVM.task.id)
                : undefined
            }
          />
          {completionCategory !== "single" && (
            <CompletionRecordsDialog
              open={recordsOpen}
              onOpenChange={setRecordsOpen}
              mode={completionCategory === "repeat" ? "repeat" : "records"}
              records={completionRecords}
              onQuickAddToday={() =>
                void addCompletionRecord(
                  taskDetailPageVM.task,
                  toLocalDateKey(new Date()),
                  t.commands.taskUpdateFailed
                )
              }
              onAddRow={() =>
                void addCompletionRecord(
                  taskDetailPageVM.task,
                  toLocalDateKey(new Date()),
                  t.commands.taskUpdateFailed
                )
              }
              onRemoveRow={(id) =>
                void removeCompletionRecord(
                  taskDetailPageVM.task,
                  id as ActivityID,
                  t.commands.taskUpdateFailed
                )
              }
              onChangeDate={(id, date) =>
                void updateCompletionRecordDate(
                  id as ActivityID,
                  date as LocalDateKey,
                  t.commands.taskUpdateFailed
                )
              }
              points={repeatPoints}
              onChangeStatus={(dateKey, status) =>
                void setRepeatPointStatus(
                  taskDetailPageVM.task,
                  dateKey as LocalDateKey,
                  status,
                  t.commands.taskUpdateFailed
                )
              }
            />
          )}
        </div>
      </div>

      {/* content */}
      <div className="flex w-full flex-col gap-2 px-4 py-2 lg:grid lg:h-full lg:min-h-0 lg:flex-1 lg:grid-cols-12">
        {/* left */}
        <div className="min-h-0 lg:col-span-8 lg:h-full">
          <Card className="shadow lg:h-full">
            <CardContent className="flex h-full min-h-0 flex-col gap-1">
              <h4 className="heading-4">{t.taskDetail.notes}</h4>
              <Textarea
                placeholder={t.taskDetail.notesPlaceholder}
                value={taskNoteDraft}
                onChange={(event) => setTaskNoteDraft(event.target.value)}
                onBlur={() => {
                  if (taskNoteDebounceRef.current) {
                    clearTimeout(taskNoteDebounceRef.current)
                    taskNoteDebounceRef.current = null
                  }
                  const normalized = taskNoteDraft.trim()
                  const nextNotes =
                    normalized.length > 0 ? normalized : undefined
                  if (nextNotes === taskDetailPageVM.task.notes) return
                  commitTaskPatch({ notes: nextNotes })
                  toast.success(t.taskDetail.notesSaved)
                }}
              />

              <Separator />
              <div className="flex w-full items-center justify-between">
                <h4 className="heading-4">{t.taskDetail.steps}</h4>
                <div className="flex items-center gap-2">
                  <AiStepsButton
                    phase={stepsAiPhase}
                    onClick={handleAutofillSteps}
                    disabled={!taskDetailPageVM.task.title.trim()}
                  />
                  {todayCompletionRuntime?.arrangementStatus === "inProgress" &&
                    taskDetailPageVM.checklistSteps.length > 0 && (
                      <Button
                        className="cursor-pointer"
                        variant="outline"
                        onClick={() =>
                          setChecklistTarget({
                            runtimeId: taskDetailPageVM.completionRuntimeId,
                            steps: taskDetailPageVM.checklistSteps,
                          })
                        }
                      >
                        <ListChecks />
                        {
                          taskDetailPageVM.checklistSteps.filter((s) => s.done)
                            .length
                        }{" "}
                        / {taskDetailPageVM.checklistSteps.length}
                      </Button>
                    )}
                </div>
              </div>
              {/*MARK: Adding Steps */}
              {stepsAiPhase !== "idle" ? (
                <div className="h-36.5 overflow-y-auto">
                  <StepsSkeletonList
                    count={stepsAiPhase === "counting" ? 3 : stepsAiCount}
                  />
                </div>
              ) : (
                <StepsEditor
                  steps={taskDetailPageVM.task.steps ?? []}
                  stepInput={stepInput}
                  onStepInputChange={setStepInput}
                  onAddStep={addStep}
                  onUpdateStep={(index, value) =>
                    commitTaskPatch({
                      steps: (taskDetailPageVM.task.steps ?? []).map(
                        (step, i) =>
                          i === index ? { ...step, title: value } : step
                      ),
                    })
                  }
                  onRemoveStep={(index) =>
                    commitTaskPatch({
                      steps: (taskDetailPageVM.task.steps ?? []).filter(
                        (_, i) => i !== index
                      ),
                    })
                  }
                  onReorderSteps={(next) => commitTaskPatch({ steps: next })}
                  placeholder={t.taskDetail.addStepPlaceholder}
                  addStepAriaLabel="Add step"
                  addRowFirst
                  scrollClassName="h-36.5 w-full"
                  reserveScroll
                />
              )}
              <Separator />
              <h4 className="heading-4">{t.taskDetail.relationships}</h4>
              <div className="h-[55vh] overflow-hidden rounded-lg border bg-muted/20 p-2 lg:h-auto lg:min-h-0 lg:flex-1">
                {dependencyForTask ? (
                  <FlowPanelTask
                    dependency={dependencyForTask}
                    goalTitle={goalForTask?.title}
                    className="h-full"
                    highlightNodeData={taskDetailPageVM.task.id}
                    editableNodeIds={editableNodeIds}
                    onNodeDetail={(id) => navigate(`/tasks/${id}`)}
                    onNodeDelete={(id) => setDeleteTaskTarget(id as TaskID)}
                  />
                ) : (
                  <p className="paragraph-small p-3 text-muted-foreground">
                    {t.taskDetail.noDependencyGraph}
                  </p>
                )}
              </div>
              <ConfirmDeleteDialog
                open={deleteTaskTarget !== null}
                onOpenChange={(open) => {
                  if (!open) setDeleteTaskTarget(null)
                }}
                title={t.taskDetail.deleteTaskTitle}
                description={t.taskDetail.deleteTaskDescription}
                onConfirm={() => {
                  if (deleteTaskTarget) {
                    void (async () => {
                      const deleted = await deleteTaskCommand(deleteTaskTarget)
                      if (deleted) {
                        setDeleteTaskTarget(null)
                      }
                    })()
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* right */}
        <div className="flex min-h-0 flex-col gap-2 lg:col-span-4 lg:h-full">
          <Card className="shadow lg:min-h-0 lg:flex-2">
            <CardContent className="flex h-full min-h-0 flex-col gap-3">
              {/* One Save/Cancel pair governs the whole schedule draft; it only
                  appears once the draft is dirty. */}
              <div className="flex min-h-9 items-center justify-between gap-2">
                <h4 className="heading-4">{t.taskDetail.schedule}</h4>
                {isScheduleDirty && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={scheduleInvalid}
                      onClick={onScheduleSave}
                    >
                      {t.common.save}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onScheduleCancel}
                    >
                      {t.common.cancel}
                    </Button>
                  </div>
                )}
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-3 pr-4 pb-1 pl-1">
                  {/* Cross-day carry-over: task-level, applies to every kind except
                  repeat-rule tasks (whose pull-up dates are fixed). */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="task-allow-cross-day"
                        className="paragraph-small-medium"
                      >
                        {t.taskDetail.allowCrossDay}
                      </label>
                      <Switch
                        id="task-allow-cross-day"
                        checked={allowCrossDayDraft}
                        disabled={isRepeatTaskForCrossDay}
                        onCheckedChange={setAllowCrossDayDraft}
                      />
                      <HelpTooltip
                        content={t.taskDetail.allowCrossDayHelp}
                        label={t.taskDetail.allowCrossDayHelpLabel}
                      />
                    </div>
                    {isRepeatTaskForCrossDay && (
                      <p className="paragraph-small text-muted-foreground">
                        {t.taskDetail.crossDayDisabledByRepeat}
                      </p>
                    )}
                  </div>
                  <Separator />

                  {isTriggerGoalForTask && (
                    <>
                      <RepeatOccurrencesField
                        label={t.taskDetail.estimatedOccurrences}
                        total={1}
                        onTotalChange={() => {}}
                        disabled
                        message={null}
                      />
                      <p className="paragraph-small text-muted-foreground">
                        {t.taskDetail.scheduleLockedByTriggerGoal}
                      </p>
                    </>
                  )}

                  {/* Due */}
                  {!isTriggerGoalForTask &&
                    repeatMode === "none" &&
                    isDueDisabledByTrigger && (
                      <SettingField>
                        <SettingFieldTitle>
                          {t.taskDetail.due}
                        </SettingFieldTitle>
                        <p className="paragraph-small text-muted-foreground">
                          {t.taskDetail.dueDisabledByTrigger}
                        </p>
                      </SettingField>
                    )}
                  {!isTriggerGoalForTask &&
                    repeatMode === "none" &&
                    !isDueDisabledByTrigger && (
                      <SettingField>
                        <SettingFieldTitle>
                          {t.taskDetail.due}
                        </SettingFieldTitle>
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "h-9 flex-1 justify-start text-left font-normal",
                                  !dueDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon data-icon="inline-start" />
                                {dueLabel}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={dueDate}
                                onSelect={(date) => {
                                  setDueDate(date)
                                  setRepeatMode("none")
                                  setRepeatInterval(1)
                                  setRepeatDaysOfWeek([])
                                  setRepeatStartsAt(undefined)
                                  setRepeatEndsAt(undefined)
                                }}
                                disabled={(date) =>
                                  isDateOutsideGoalRange(
                                    date,
                                    goalForTask ?? undefined
                                  )
                                }
                                initialFocus
                              />
                              <Separator />
                              <div className="flex flex-col gap-3 p-3">
                                <SettingField>
                                  <SettingFieldTitle>
                                    {t.taskDetail.latestFinishTime}
                                  </SettingFieldTitle>
                                  <Input
                                    type="time"
                                    step="60"
                                    value={dueTime}
                                    onChange={(e) => setDueTime(e.target.value)}
                                  />
                                </SettingField>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive disabled:text-muted-foreground disabled:opacity-100 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                            onClick={() => {
                              setDueDate(undefined)
                              setDueTime("23:59")
                            }}
                            disabled={!dueDate}
                            aria-label="Clear due date"
                          >
                            <Trash />
                          </Button>
                        </div>
                      </SettingField>
                    )}

                  {/* Estimated Duration */}
                  <SettingField>
                    <SettingFieldTitle>
                      {t.taskDetail.estimatedDuration}
                    </SettingFieldTitle>
                    <DurationInput
                      value={durationDraft}
                      onChange={(v) =>
                        setDurationDraft(v as DurationInMinutes | undefined)
                      }
                    />
                  </SettingField>

                  {/* Repeat + Trigger */}
                  {taskDetailPageVM.task.goalId && !isTriggerGoalForTask && (
                    <TaskTriggerRepeatCards
                      repeat={{
                        idPrefix: "task-detail-repeat",
                        mode: repeatMode,
                        onModeChange: (mode) => {
                          setRepeatMode(mode)
                          setRepeatInterval(1)
                          setRepeatDaysOfWeek([])
                          setRepeatStartsAt(undefined)
                          setRepeatEndsAt(undefined)
                          if (mode !== "none") {
                            setDueDate(undefined)
                            setDueTime("23:59")
                          }
                        },
                        interval: repeatInterval,
                        onIntervalChange: setRepeatInterval,
                        daysOfWeek: repeatDaysOfWeek,
                        onDaysOfWeekChange: setRepeatDaysOfWeek,
                        extraDisabled: isTriggerGoalForTask,
                        description: t.taskDetail.repeatRuleHelp,
                        labels: {
                          repeat: t.taskDetail.repeat,
                          daily: t.taskDetail.daily,
                          weekly: t.taskDetail.weekly,
                          dailyInterval: t.taskDetail.everyNDays,
                          daysOfWeek: t.taskDetail.daysOfWeek,
                          everyNWeeks: t.taskDetail.everyNWeeks,
                          period: t.createTask.repeatPeriod,
                        },
                        modeFooter: isTriggerGoalForTask ? (
                          <p className="paragraph-small text-muted-foreground">
                            {t.taskDetail.repeatDisabledByTriggerGoal}
                          </p>
                        ) : undefined,
                        // The repeat period is self-contained (its own
                        // start/end), so the picker always renders — it no
                        // longer requires the goal to have a due date.
                        period: {
                          value: repeatPeriodDraftValue,
                          onChange: (range) => {
                            setRepeatStartsAt(range?.start)
                            setRepeatEndsAt(range?.end)
                          },
                          // A goal due date, when present, is an upper bound.
                          isDateDisabled: (date) =>
                            isTriggerGoalForTask ||
                            isDateOutsideGoalRange(
                              date,
                              goalForTask ?? undefined
                            ),
                          message: repeatPeriodMessage,
                          modifiers: repeatCalendarModifiers,
                          modifiersClassNames: repeatCalendarModifierClassNames,
                        },
                      }}
                      trigger={{
                        id: "task-detail-trigger",
                        enabled: triggerEnabledDraft,
                        onEnabledChange: handleTriggerToggle,
                        switchAriaLabel: triggerEnabledDraft
                          ? t.taskDetail.closeTriggerSettings
                          : t.taskDetail.openTriggerSettings,
                        title: t.taskDetail.trigger,
                        description: t.common.triggerHelpTooltip,
                        config: {
                          option: triggerDraft?.mode ?? null,
                          onOptionChange: handleTriggerModeChange,
                          draft: triggerDraft,
                          onDraftChange: setTriggerDraft,
                          period: {
                            value:
                              triggerStartsAt && triggerEndsAt
                                ? {
                                    start: triggerStartsAt,
                                    end: triggerEndsAt,
                                  }
                                : undefined,
                            onChange: (range) => {
                              setTriggerStartsAt(range?.start)
                              setTriggerEndsAt(range?.end)
                            },
                            isDateDisabled: (date) =>
                              isDateOutsideGoalRange(
                                date,
                                goalForTask ?? undefined
                              ),
                            message: triggerPeriodMessage,
                          },
                        },
                        error: triggerDraftMessage ? (
                          <p className="paragraph-small text-destructive">
                            {triggerDraftMessage}
                          </p>
                        ) : undefined,
                      }}
                    />
                  )}

                  {/* A task-level trigger forces single-run, mirroring the
                      trigger-goal case above: keep the field visible but
                      locked, with the reason spelled out. */}
                  {triggerEnabledDraft && !isTriggerGoalForTask && (
                    <>
                      <RepeatOccurrencesField
                        label={t.taskDetail.estimatedOccurrences}
                        total={1}
                        onTotalChange={() => {}}
                        disabled
                        message={null}
                      />
                      <p className="paragraph-small text-muted-foreground">
                        {t.taskDetail.totalLockedByTrigger}
                      </p>
                    </>
                  )}
                  {!triggerEnabledDraft && !isTriggerGoalForTask && (
                    <RepeatOccurrencesField
                      label={t.taskDetail.estimatedOccurrences}
                      total={totalDraft}
                      onTotalChange={setTotalDraft}
                      disabled={isStandaloneTask}
                      message={totalLimitMessage}
                      showEstimateActions={Boolean(
                        repeatMode !== "none" &&
                        explicitRepeatRange &&
                        !repeatValidation.error
                      )}
                      onAutoEstimate={fillEstimatedOccurrences}
                      autoEstimateLabel={t.taskDetail.autoEstimate}
                      previewDatesLabel={t.taskDetail.previewDates}
                      previewModifiers={previewCalendarModifiers}
                      previewModifiersClassNames={
                        previewCalendarModifierClassNames
                      }
                      isPreviewDateDisabled={(date) =>
                        isDateOutsideGoalRange(date, goalForTask ?? undefined)
                      }
                    />
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          {/* Activity Log */}
          <Card className="shadow lg:min-h-0 lg:flex-1">
            <CardContent className="flex flex-col gap-2 lg:h-full lg:min-h-0">
              <h4 className="heading-4">{t.taskDetail.activityLogs}</h4>
              {/* MARK: Activity Logs */}
              {taskHistory.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="heading-4 text-muted-foreground">
                    {t.taskDetail.noRecentActivities}
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-42 lg:min-h-0 lg:flex-1">
                  <ol className="flex flex-col gap-1">
                    {taskHistory.map((item) => (
                      <li key={item.id}>
                        <ActivityItem
                          kind={item.kind}
                          taskId={item.taskId}
                          taskTitle={item.taskTitle}
                          recordedAt={item.recordedAtLabel}
                        />
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Header({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div className="flex w-full items-center px-4">
      <div className="flex items-center gap-2">
        <NavHistoryButtons />
        {/* Page Title */}
        <span className="paragraph-regular">{title}</span>
        {trailing}
      </div>
    </div>
  )
}
