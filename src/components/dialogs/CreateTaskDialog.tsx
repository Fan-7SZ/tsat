import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, isSameDay, startOfDay } from "date-fns"
import { CalendarIcon, Trash } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { toast } from "sonner"

import {
  createDependency,
  updateDependency,
} from "@/commands/dependency.commands"
import { createTask, deleteTask } from "@/commands/task.commands"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  DependencyEntityID,
  DurationInMinutes,
  GoalID,
  Step,
  TaskID,
} from "@/domain/value-objects/types"
import { createStep } from "@/domain/value-objects/types"
import type { ActiveRepeatRule } from "@/domain/value-objects/repeatRule"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import { useAllGoals, useAllTasks, useDeps } from "@/hooks/use-entities"
import { FlowPanelDraft } from "@/components/flow/FlowPanel"
import type { SelectTriggerMode } from "@/components/trigger/TriggerPanel"
import { TaskTriggerRepeatCards } from "@/components/task/TaskTriggerRepeatCards"
import { HelpTooltip } from "@/components/shared/HelpTooltip"
import {
  SettingField,
  SettingFieldTitle,
  SettingFieldError,
  SettingFieldDescription,
} from "@/components/shared/setting-field"
import { RepeatOccurrencesField } from "@/components/task/RepeatOccurrencesField"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useAppStore } from "@/store/app-store"
import { useUiStore } from "@/store/ui-store"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/shared/language-provider"
import {
  clampMinOne,
  computeProjectedConductedCount,
} from "@/utils/repeat-count"
import { mergeDateAndTime, timeStringFromDate } from "@/utils/date"
import { isDateOutsideGoalRange } from "@/utils/repeat-window"
import {
  translateScheduleValidationError,
  validateRepeatConfiguration,
} from "@/utils/repeat-validation"
import { useRepeatDraft, useTriggerWindowDraft } from "@/hooks/use-repeat-draft"
import {
  buildDefaultTriggerRule,
  validateTriggerDraft,
} from "@/utils/trigger-draft"

const NO_GOAL_VALUE = "__none__"
const DEFAULT_DUE_TIME = "23:59"
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const DRAFT_TASK_NODE_DATA = "__draft_new_task__"
const DEFAULT_DRAFT_TASK_TITLE = "New Task"

function buildGoalRecord(goals: GoalEntity[]): Record<GoalID, GoalEntity> {
  return Object.fromEntries(goals.map((goal) => [goal.id, goal])) as Record<
    GoalID,
    GoalEntity
  >
}

function buildTaskRecord(
  tasks: TaskGroupEntity[]
): Record<TaskID, TaskGroupEntity> {
  return Object.fromEntries(tasks.map((task) => [task.id, task])) as Record<
    TaskID,
    TaskGroupEntity
  >
}

function buildDraftDependency(
  baseDep: DependencyEntity | undefined,
  goalId: GoalID,
  taskTitle: string
): DependencyEntity {
  const normalizedTitle = taskTitle.trim() || DEFAULT_DRAFT_TASK_TITLE

  if (!baseDep) {
    return {
      id: `draft-${goalId}` as DependencyEntityID,
      belongTo: goalId,
      tree: [
        {
          data: DRAFT_TASK_NODE_DATA,
          title: normalizedTitle,
          parent: null,
          children: null,
        },
      ],
    }
  }

  const clonedTree = baseDep.tree.map((node) => ({
    ...node,
    parent: node.parent ? [...node.parent] : null,
    children: node.children ? [...node.children] : null,
  }))

  const draftNodeIndex = clonedTree.findIndex(
    (node) => node.data === DRAFT_TASK_NODE_DATA
  )

  if (draftNodeIndex >= 0) {
    clonedTree[draftNodeIndex] = {
      ...clonedTree[draftNodeIndex],
      title: normalizedTitle,
    }
  } else {
    clonedTree.push({
      data: DRAFT_TASK_NODE_DATA,
      title: normalizedTitle,
      parent: null,
      children: null,
    })
  }

  return {
    ...baseDep,
    tree: clonedTree,
  }
}

// Error messages are stored as i18n keys (relative to `t.createTask`) rather
// than translated strings, so the schema does not need to be rebuilt when the
// language changes. Keys are resolved to the current language at render time via
// `resolveCreateTaskError`. Parameterized messages are encoded as "key:arg".
const createTaskFormSchema = z
  .object({
    title: z.string().trim().min(1, "taskNameRequired"),
    description: z.string().trim(),
    goalId: z.string(),
    dueDate: z.date().optional(),
    dueTime: z.string().regex(TIME_PATTERN, "invalidTime"),
    estimatedMinutes: z.number().int().min(1, "atLeast1Minute").optional(),
    repeatStartsAt: z.date().optional(),
    repeatEndsAt: z.date().optional(),
    repeatMode: z.enum(["none", "daily", "weekly"]),
    repeatInterval: z.number().int().min(1).optional(),
    repeatDaysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    plannedTotal: z.number().int().min(1),
  })
  .superRefine((values, ctx) => {
    if (values.goalId === NO_GOAL_VALUE && !values.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "dueRequired",
      })
    }

    if (values.goalId === NO_GOAL_VALUE && values.repeatMode !== "none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repeatMode"],
        message: "repeatRequiresGoal",
      })
    }

    if (values.repeatMode !== "none" && values.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "noDueWithRepeat",
      })
    }

    if (
      values.repeatMode !== "none" &&
      values.repeatStartsAt &&
      values.repeatEndsAt &&
      values.repeatEndsAt.getTime() >= values.repeatStartsAt.getTime()
    ) {
      const rule = buildRepeatRule(values)
      if (rule) {
        const occurrences = computeProjectedConductedCount(
          values.repeatStartsAt,
          values.repeatEndsAt,
          rule
        )
        if (values.plannedTotal > occurrences) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["plannedTotal"],
            message: `totalExceedsOccurrences:${occurrences}`,
          })
        }
      }
    }
  })

type CreateTaskFormValues = z.infer<typeof createTaskFormSchema>

/** Resolve a zod error message (an i18n key, possibly "key:arg") to text. */
function resolveCreateTaskError(
  t: ReturnType<typeof useLanguage>["t"],
  message?: string
): string | undefined {
  if (!message) return undefined
  if (message.startsWith("totalExceedsOccurrences:")) {
    const max = Number(message.slice("totalExceedsOccurrences:".length))
    return t.createTask.totalExceedsOccurrences(max)
  }
  const dict = t.createTask as unknown as Record<string, string>
  return dict[message] ?? message
}

// Keep form defaults centralized so reset/open behavior stays consistent.
function getDefaultValues(fixedGoalId?: GoalID): CreateTaskFormValues {
  const defaultDueDate = fixedGoalId ? undefined : startOfDay(new Date())

  return {
    title: "",
    description: "",
    goalId: fixedGoalId ?? NO_GOAL_VALUE,
    dueDate: defaultDueDate,
    dueTime: DEFAULT_DUE_TIME,
    estimatedMinutes: undefined,
    repeatStartsAt: undefined,
    repeatEndsAt: undefined,
    repeatMode: "none",
    repeatInterval: undefined,
    repeatDaysOfWeek: undefined,
    plannedTotal: 1,
  }
}

// Convert UI repeat fields into the domain repeat rule shape.
function buildRepeatRule(
  values: CreateTaskFormValues
): ActiveRepeatRule | undefined {
  if (values.repeatMode === "daily") {
    return { mode: "daily", interval: values.repeatInterval ?? 1 }
  }
  if (values.repeatMode === "weekly") {
    return {
      mode: "weekly",
      interval: values.repeatInterval ?? 1,
      daysOfWeek: values.repeatDaysOfWeek ?? [],
    }
  }
  return undefined
}

// Task due is modeled as a single datetime point, not a range.
function buildDueAt(
  dueDate: Date | undefined,
  dueTime: string
): Date | undefined {
  if (!dueDate) {
    return undefined
  }

  return mergeDateAndTime(dueDate, dueTime)
}

// Ignore invalid fixed goal IDs from callers to avoid broken locked state.
function resolveFixedGoalId(
  fixedGoalId: GoalID | undefined,
  goalsRaw: Record<GoalID, GoalEntity>
): GoalID | undefined {
  if (!fixedGoalId) {
    return undefined
  }

  return goalsRaw[fixedGoalId] ? fixedGoalId : undefined
}

// Datetime-level guard used for both live validation and submit-time validation.
// A goal's due date is only an upper bound (goals have no start date).
function getDueConstraintMessage(
  dueAt: Date | undefined,
  goal: GoalEntity | undefined,
  dueTooLate: (date: string) => string
): string | undefined {
  if (!dueAt || !goal) {
    return undefined
  }

  if (goal.dueAt && dueAt > goal.dueAt) {
    return dueTooLate(format(goal.dueAt, "PPP HH:mm"))
  }

  return undefined
}

// Display helper for the right panel and schedule hint.
function formatGoalDuration(goal: GoalEntity | undefined): string | undefined {
  if (!goal?.dueAt) {
    return undefined
  }

  return `Until ${format(goal.dueAt, "PPP HH:mm")}`
}

// On the due boundary day, limit time input so users cannot bypass the goal's
// due date by hour/minute.
function getTimeBounds(
  dueDate: Date | undefined,
  goal: GoalEntity | undefined
): { min?: string; max?: string } {
  if (!dueDate || !goal) {
    return {}
  }

  const max =
    goal.dueAt && isSameDay(dueDate, goal.dueAt)
      ? timeStringFromDate(goal.dueAt)
      : undefined

  return { max }
}

type CreateTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fixedGoalId?: GoalID
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  fixedGoalId,
}: CreateTaskDialogProps) {
  const rawGoals = useAllGoals()
  const rawTasks = useAllTasks()
  const depsRaw = useDeps()
  const goalsRaw = useMemo(() => buildGoalRecord(rawGoals), [rawGoals])
  const tasksRaw = useMemo(() => buildTaskRecord(rawTasks), [rawTasks])
  const { t, language } = useLanguage()
  const aiSettings = useAppStore((s) => s.aiSettings)
  // Normalize external fixed goal once per goals map change.
  const normalizedFixedGoalId = useMemo(
    () => resolveFixedGoalId(fixedGoalId, goalsRaw),
    [fixedGoalId, goalsRaw]
  )
  // Default values depend on whether this entry point has a locked goal.
  const defaultValues = useMemo(
    () => getDefaultValues(normalizedFixedGoalId),
    [normalizedFixedGoalId]
  )
  // Sorted options keep the goal selector predictable.
  const goalOptions = useMemo<GoalEntity[]>(() => {
    return [...rawGoals].sort((left, right) =>
      left.title.localeCompare(right.title)
    )
  }, [rawGoals])

  const {
    control,
    clearErrors,
    formState: { errors, isValid },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    trigger,
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues,
    mode: "onChange",
  })

  const [steps, setSteps] = useState<Step[]>([])
  const [stepInput, setStepInput] = useState("")
  const [stepsAiPhase, setStepsAiPhase] = useState<StepsAutofillPhase>("idle")
  const [stepsAiCount, setStepsAiCount] = useState(3)
  const [taskEnableTrigger, setTaskEnableTrigger] = useState(false)
  const [taskTriggerOption, setTaskTriggerOption] =
    useState<SelectTriggerMode>(null)
  const [taskTriggerDraft, setTaskTriggerDraft] = useState<triggerRule | null>(
    null
  )
  const [taskAllowCrossDay, setTaskAllowCrossDay] = useState(false)
  const [taskTriggerStartsAt, setTaskTriggerStartsAt] = useState<
    Date | undefined
  >(undefined)
  const [taskTriggerEndsAt, setTaskTriggerEndsAt] = useState<Date | undefined>(
    undefined
  )
  const [draftTree, setDraftTree] = useState<DependencyEntity["tree"] | null>(
    null
  )

  useEffect(() => {
    if (!open) {
      return
    }

    reset(getDefaultValues(normalizedFixedGoalId))
    queueMicrotask(() => {
      setSteps([])
      setStepInput("")
      setDraftTree(null)
    })

    const frameId = window.requestAnimationFrame(() => {
      void trigger()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [open, trigger, normalizedFixedGoalId, reset])

  const selectedGoalId = useWatch({ control, name: "goalId" })
  const draftTaskTitle = useWatch({ control, name: "title" })
  const dueDate = useWatch({ control, name: "dueDate" })
  const dueTime = useWatch({ control, name: "dueTime" })
  const repeatStartsAt = useWatch({ control, name: "repeatStartsAt" })
  const repeatEndsAt = useWatch({ control, name: "repeatEndsAt" })
  const repeatMode = useWatch({ control, name: "repeatMode" })
  const repeatInterval = useWatch({ control, name: "repeatInterval" })
  const repeatDaysOfWeek = useWatch({ control, name: "repeatDaysOfWeek" })
  const draftTaskDescription = useWatch({ control, name: "description" })

  // ── AI step autofill ──
  const showAiError = (err: unknown) => {
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
  }

  const handleAutofillSteps = async () => {
    const title = (draftTaskTitle ?? "").trim()
    if (!title) return
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
    const goalTitle =
      selectedGoalId && selectedGoalId !== NO_GOAL_VALUE
        ? goalsRaw[selectedGoalId as GoalID]?.title
        : undefined
    const input = {
      id: "draft",
      title,
      description: draftTaskDescription?.trim() || undefined,
      steps,
      goalTitle,
    }
    setStepsAiPhase("counting")
    try {
      const count = await estimateStepCount(aiSettings, input, language)
      setStepsAiCount(count)
      setStepsAiPhase("filling")
      const result = await generateTaskSteps(aiSettings, input, "", language)
      if (result.length > 0) {
        setSteps(result.map(createStep))
      } else {
        showAiError(new Error("Empty AI response"))
      }
    } catch (err) {
      showAiError(err)
    } finally {
      setStepsAiPhase("idle")
    }
  }
  const plannedTotal = useWatch({ control, name: "plannedTotal" })
  const isStandaloneTask = selectedGoalId === NO_GOAL_VALUE

  // Selected goal drives due constraints and the right-side info panel.
  const selectedGoal =
    selectedGoalId === NO_GOAL_VALUE
      ? undefined
      : goalsRaw[selectedGoalId as GoalID]
  const isTriggerGoal = selectedGoal?.trigger != null

  const selectedGoalDependency = useMemo(() => {
    if (!selectedGoal) return undefined
    return Object.values(depsRaw).find(
      (dep) => dep.belongTo === selectedGoal.id
    )
  }, [depsRaw, selectedGoal])

  const baseDraftDependency = useMemo(() => {
    if (!selectedGoal) return null
    return buildDraftDependency(
      selectedGoalDependency,
      selectedGoal.id,
      draftTaskTitle
    )
  }, [draftTaskTitle, selectedGoal, selectedGoalDependency])
  // Preview the final due datetime shown in the trigger button.
  const dueAtPreview = useMemo(
    () => buildDueAt(dueDate, dueTime),
    [dueDate, dueTime]
  )
  const dueLabel = dueAtPreview
    ? format(dueAtPreview, "PPP HH:mm")
    : t.taskDetail.notSet
  // Human-readable goal duration hint for users.
  const goalDurationLabel = useMemo(
    () => formatGoalDuration(selectedGoal),
    [selectedGoal]
  )
  // Time input bounds only apply when selected date falls on goal boundary days.
  const timeBounds = useMemo(
    () => getTimeBounds(dueDate, selectedGoal),
    [dueDate, selectedGoal]
  )

  const flowDependency = useMemo(() => {
    if (!baseDraftDependency) return null
    const effectiveTree = draftTree ?? baseDraftDependency.tree
    return {
      ...baseDraftDependency,
      tree: effectiveTree,
      endIndex: Math.max(effectiveTree.length - 1, 0),
    }
  }, [baseDraftDependency, draftTree])

  const editableNodeIds = useMemo(() => {
    if (!flowDependency) return []
    const index = flowDependency.tree.findIndex(
      (node) => node.data === DRAFT_TASK_NODE_DATA
    )
    return index >= 0 ? [String(index)] : []
  }, [flowDependency])

  const repeatPreviewFallbackStart = useMemo(() => new Date(), [])

  const {
    rule: repeatRuleForPreview,
    validation: repeatValidation,
    explicitRange: explicitRepeatRange,
    periodDraftValue: repeatPeriodDraftValue,
    periodMessage: repeatPeriodMessage,
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
    goal: selectedGoal,
    fallbackStart: repeatPreviewFallbackStart,
    dependency: flowDependency,
    currentNodeData: DRAFT_TASK_NODE_DATA,
    tasksById: tasksRaw,
    messages: {
      periodRequired: t.createTask.repeatPeriodRequired,
      pickBothDates: t.createTask.pickBothDates,
    },
    resolveError: (error) => translateScheduleValidationError(error, t),
  })

  const { message: taskTriggerPeriodMessage } = useTriggerWindowDraft({
    enabled: taskEnableTrigger,
    startsAt: taskTriggerStartsAt,
    endsAt: taskTriggerEndsAt,
    goal: selectedGoal,
    fallbackStart: repeatPreviewFallbackStart,
    dependency: flowDependency,
    currentNodeData: DRAFT_TASK_NODE_DATA,
    tasksById: tasksRaw,
    pickBothMessage: t.taskDetail.triggerPeriodPickBoth,
    resolveError: (error) => translateScheduleValidationError(error, t),
  })

  // Reactive trigger-rule validity (e.g. custom mode with no dates picked) so the
  // submit button can be disabled and the error shown inline, not just on submit.
  const taskTriggerValidationMessage = taskEnableTrigger
    ? validateTriggerDraft(taskTriggerDraft, t)
    : null

  // Keep goalId synchronized when fixed goal is provided or option disappears.
  useEffect(() => {
    if (normalizedFixedGoalId) {
      setValue("goalId", normalizedFixedGoalId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      })
      return
    }

    if (
      selectedGoalId !== NO_GOAL_VALUE &&
      !goalsRaw[selectedGoalId as GoalID]
    ) {
      setValue("goalId", NO_GOAL_VALUE, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true,
      })
    }
  }, [goalsRaw, normalizedFixedGoalId, selectedGoalId, setValue])

  // Standalone tasks must always have a due date; default to today when empty.
  useEffect(() => {
    if (!isStandaloneTask || dueDate) {
      return
    }

    setValue("dueDate", startOfDay(new Date()), {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    })
  }, [dueDate, isStandaloneTask, setValue])

  // Standalone tasks and trigger-goal tasks cannot use repeat rules.
  useEffect(() => {
    const shouldClearRepeat = isStandaloneTask || isTriggerGoal
    if (!shouldClearRepeat) {
      return
    }

    if (
      repeatMode === "none" &&
      repeatInterval == null &&
      repeatDaysOfWeek == null &&
      repeatStartsAt == null &&
      repeatEndsAt == null
    ) {
      return
    }

    setValue("repeatMode", "none", {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    setValue("repeatInterval", undefined, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    setValue("repeatDaysOfWeek", undefined, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    setValue("repeatStartsAt", undefined, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    setValue("repeatEndsAt", undefined, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }, [
    isStandaloneTask,
    isTriggerGoal,
    repeatDaysOfWeek,
    repeatEndsAt,
    repeatInterval,
    repeatMode,
    repeatStartsAt,
    setValue,
  ])

  // Standalone tasks and tasks under a trigger-goal always have exactly one occurrence.
  useEffect(() => {
    if (!isStandaloneTask && !isTriggerGoal) {
      return
    }

    setValue("plannedTotal", 1, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }, [isStandaloneTask, isTriggerGoal, setValue])

  useEffect(() => {
    if (!baseDraftDependency) {
      queueMicrotask(() => setDraftTree(null))
      return
    }
    queueMicrotask(() => setDraftTree(baseDraftDependency.tree))
  }, [baseDraftDependency, selectedGoal?.id])

  useEffect(() => {
    const normalizedTitle = draftTaskTitle.trim() || DEFAULT_DRAFT_TASK_TITLE
    queueMicrotask(() => {
      setDraftTree((prev) => {
        if (!prev) return prev
        return prev.map((node) =>
          node.data === DRAFT_TASK_NODE_DATA
            ? { ...node, title: normalizedTitle }
            : node
        )
      })
    })
  }, [draftTaskTitle])

  const fillEstimatedOccurrences = () => {
    if (
      !repeatRuleForPreview ||
      !explicitRepeatRange ||
      repeatValidation.error
    ) {
      return
    }

    const calculated = computeProjectedConductedCount(
      explicitRepeatRange.start,
      explicitRepeatRange.end,
      repeatRuleForPreview
    )

    setValue("plannedTotal", calculated, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }

  // Reactively seed the occurrence count from the repeat rule + window. Runs
  // whenever the rule/window changes (not when plannedTotal changes), so the
  // auto estimate is the default and the user's manual edits survive until the
  // next rule/window change.
  useEffect(() => {
    if (
      !repeatRuleForPreview ||
      !explicitRepeatRange ||
      repeatValidation.error
    ) {
      return
    }

    const calculated = computeProjectedConductedCount(
      explicitRepeatRange.start,
      explicitRepeatRange.end,
      repeatRuleForPreview
    )

    setValue("plannedTotal", calculated, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }, [explicitRepeatRange, repeatRuleForPreview, repeatValidation.error, setValue])

  // Enforce goal window continuously so invalid datetime cannot be submitted.
  useEffect(() => {
    const message = getDueConstraintMessage(
      dueAtPreview,
      selectedGoal,
      t.createTask.dueTooLate
    )

    if (message) {
      setError("dueDate", { type: "validate", message })
      return
    }

    clearErrors("dueDate")
  }, [
    clearErrors,
    dueAtPreview,
    selectedGoal,
    setError,
    t.createTask.dueTooLate,
  ])

  useEffect(() => {
    if (!repeatPeriodMessage) {
      clearErrors("repeatStartsAt")
      return
    }

    setError("repeatStartsAt", {
      type: "validate",
      message: repeatPeriodMessage,
    })
  }, [clearErrors, repeatPeriodMessage, setError])

  const addStep = () => {
    const trimmed = stepInput.trim()
    if (!trimmed) return
    setSteps((prev) => [...prev, createStep(trimmed)])
    setStepInput("")
  }

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const updateStep = (index: number, nextTitle: string) => {
    setSteps((prev) =>
      prev.map((step, i) =>
        i === index ? { ...step, title: nextTitle } : step
      )
    )
  }

  const resetForm = () => {
    reset(getDefaultValues(normalizedFixedGoalId))
    setSteps([])
    setStepInput("")
    setTaskEnableTrigger(false)
    setTaskTriggerOption(null)
    setTaskTriggerDraft(null)
    setTaskAllowCrossDay(false)
    setTaskTriggerStartsAt(undefined)
    setTaskTriggerEndsAt(undefined)
    setDraftTree(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }

    onOpenChange(nextOpen)
  }

  const onSubmit = handleSubmit(async (values: CreateTaskFormValues) => {
    const dueAt = buildDueAt(values.dueDate, values.dueTime)

    const dueConstraintMessage = getDueConstraintMessage(
      dueAt,
      selectedGoal,
      t.createTask.dueTooLate
    )

    if (dueConstraintMessage) {
      setError("dueDate", {
        type: "validate",
        message: dueConstraintMessage,
      })
      return
    }

    const createdAt = new Date()
    const submitRepeatRule = buildRepeatRule(values)
    if (selectedGoal?.trigger != null && submitRepeatRule != null) {
      setError("repeatMode", {
        type: "validate",
        message: t.createTask.repeatDisabledByTriggerGoal,
      })
      return
    }

    const wantsTaskTrigger =
      taskEnableTrigger && selectedGoal != null && !isTriggerGoal
    if (wantsTaskTrigger) {
      if (submitRepeatRule != null) {
        setError("repeatMode", {
          type: "validate",
          message: t.taskDetail.triggerDisabledByRepeat,
        })
        return
      }

      const triggerMessage = validateTriggerDraft(taskTriggerDraft, t)
      if (triggerMessage) {
        toast.error(triggerMessage)
        return
      }

      if (taskTriggerPeriodMessage) {
        toast.error(taskTriggerPeriodMessage)
        return
      }
    }

    const submitRepeatConfig = submitRepeatRule
      ? {
          rule: submitRepeatRule,
          startsAt: values.repeatStartsAt,
          endsAt: values.repeatEndsAt,
        }
      : undefined

    const submitRepeatValidation = validateRepeatConfiguration({
      repeat: submitRepeatConfig,
      goal: selectedGoal,
      fallbackStart: createdAt,
      dependency: flowDependency,
      currentNodeData: DRAFT_TASK_NODE_DATA,
      tasksById: tasksRaw,
    })

    if (submitRepeatValidation.error) {
      setError("repeatStartsAt", {
        type: "validate",
        message: translateScheduleValidationError(
          submitRepeatValidation.error,
          t
        ),
      })
      return
    }

    if (
      submitRepeatConfig != null &&
      (!values.repeatStartsAt || !values.repeatEndsAt)
    ) {
      setError("repeatStartsAt", {
        type: "validate",
        message: t.createTask.repeatPeriodRequired,
      })
      return
    }

    const taskId = crypto.randomUUID() as TaskID
    const minutes = values.estimatedMinutes
    const estimatedDuration =
      typeof minutes === "number" && !Number.isNaN(minutes) && minutes > 0
        ? (minutes as DurationInMinutes)
        : undefined

    const task = {
      id: taskId,
      goalId:
        values.goalId === NO_GOAL_VALUE ? undefined : (values.goalId as GoalID),
      title: values.title,
      description: values.description || undefined,
      createdAt,
      dueAt,
      steps: steps.length > 0 ? steps : undefined,
      estimatedDuration,
      repeat: submitRepeatConfig,
      trigger: wantsTaskTrigger
        ? {
            rule: taskTriggerDraft!,
            startsAt: taskTriggerStartsAt,
            endsAt: taskTriggerEndsAt,
          }
        : undefined,
      // Cross-day carry-over is a task-level setting; repeat tasks never use it.
      allowCrossDay: submitRepeatConfig == null ? taskAllowCrossDay : false,
      total: clampMinOne(values.plannedTotal),
      completedCount: 0,
    }

    const created = await createTask(task, t.commands.taskCreateFailed)
    if (!created) {
      return
    }

    // Due-today tasks are imported by the planner's replan cycle (duePolicy source),
    // so there is no auto-enroll here: it would create a sourceless runtime that defaults to "manual".

    if (values.goalId !== NO_GOAL_VALUE && selectedGoal && flowDependency) {
      const persistedTree = flowDependency.tree.map((node) =>
        node.data === DRAFT_TASK_NODE_DATA
          ? {
              ...node,
              data: taskId,
              title: values.title.trim() || node.title,
            }
          : node
      )

      const dependencySaved = selectedGoalDependency
        ? await updateDependency(
            selectedGoalDependency.id,
            {
              tree: persistedTree,
            },
            t.commands.dependencyUpdateFailed
          )
        : await createDependency(
            {
              id: crypto.randomUUID() as DependencyEntityID,
              belongTo: selectedGoal.id,
              tree: persistedTree,
            },
            t.commands.dependencyUpdateFailed
          )

      if (!dependencySaved) {
        await deleteTask(taskId, t.commands.taskDeleteFailed)
        return
      }
    }

    toast.success(t.createTask.taskCreated)
    resetForm()
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 p-0",
          selectedGoal ? "sm:max-w-6xl" : "sm:max-w-4xl"
        )}
      >
        <ScrollArea className="max-h-[85vh] rounded-[inherit]">
          <div className="flex flex-col gap-6 px-6 pt-6">
            <DialogTitle>{t.createTask.title}</DialogTitle>
            <div
              className={cn(
                "flex flex-col gap-6",
                selectedGoal && "lg:grid lg:grid-cols-12 lg:items-stretch"
              )}
            >
              <div className={cn(selectedGoal && "lg:col-span-4")}>
                <div className="flex flex-col gap-6">
                  <section className="flex flex-col gap-3">
                    <h3 className="heading-4">{t.createTask.information}</h3>
                    <SettingField>
                      <SettingFieldTitle>
                        {t.createTask.taskName}
                      </SettingFieldTitle>
                      <Input
                        {...register("title")}
                        data-testid="create-task-title"
                        placeholder={t.createTask.taskNamePlaceholder}
                      />
                      {errors.title && (
                        <SettingFieldError>
                          {resolveCreateTaskError(t, errors.title.message)}
                        </SettingFieldError>
                      )}
                    </SettingField>

                    <SettingField>
                      <SettingFieldTitle>
                        {t.createTask.descriptionOptional}
                      </SettingFieldTitle>
                      <Textarea
                        {...register("description")}
                        placeholder={t.createTask.descriptionPlaceholder}
                        className="min-h-20"
                      />
                    </SettingField>

                    <SettingField>
                      <SettingFieldTitle>{t.createTask.goal}</SettingFieldTitle>
                      <Controller
                        name="goalId"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value)
                              if (value !== NO_GOAL_VALUE) {
                                setValue("dueDate", undefined, {
                                  shouldDirty: true,
                                  shouldTouch: true,
                                  shouldValidate: true,
                                })
                              }
                              setValue("repeatStartsAt", undefined, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              })
                              setValue("repeatEndsAt", undefined, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              })
                            }}
                            disabled={Boolean(normalizedFixedGoalId)}
                          >
                            <SelectTrigger
                              data-testid="create-task-goal-select"
                              className="h-9 w-full"
                            >
                              <SelectValue
                                placeholder={t.createTask.noGoalStandalone}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_GOAL_VALUE}>
                                {t.createTask.noGoalStandalone}
                              </SelectItem>
                              {goalOptions.map((goal) => (
                                <SelectItem key={goal.id} value={goal.id}>
                                  {goal.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </SettingField>
                  </section>

                  <Separator />

                  <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="heading-4">{t.createTask.steps}</h3>
                      <AiStepsButton
                        phase={stepsAiPhase}
                        onClick={handleAutofillSteps}
                        disabled={!(draftTaskTitle ?? "").trim()}
                      />
                    </div>
                    {stepsAiPhase !== "idle" ? (
                      <StepsSkeletonList
                        count={stepsAiPhase === "counting" ? 3 : stepsAiCount}
                      />
                    ) : (
                      <StepsEditor
                        steps={steps}
                        stepInput={stepInput}
                        onStepInputChange={setStepInput}
                        onAddStep={addStep}
                        onUpdateStep={updateStep}
                        onRemoveStep={removeStep}
                        onReorderSteps={setSteps}
                        placeholder={t.createTask.addStepPlaceholder}
                        addStepAriaLabel={t.createTask.addStep}
                        scrollClassName="h-24 w-full"
                      />
                    )}
                  </section>

                  <Separator />

                  <section className="flex flex-col gap-3">
                    {/* Cross-day carry-over: task-level; unavailable for repeat tasks. */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="create-task-allow-cross-day"
                          className="paragraph-small-medium"
                        >
                          {t.taskDetail.allowCrossDay}
                        </label>
                        <Switch
                          id="create-task-allow-cross-day"
                          checked={taskAllowCrossDay}
                          disabled={repeatMode !== "none"}
                          onCheckedChange={setTaskAllowCrossDay}
                        />
                        <HelpTooltip
                          content={t.taskDetail.allowCrossDayHelp}
                          label={t.taskDetail.allowCrossDayHelpLabel}
                        />
                      </div>
                      {repeatMode !== "none" && (
                        <p className="paragraph-small text-muted-foreground">
                          {t.taskDetail.crossDayDisabledByRepeat}
                        </p>
                      )}
                    </div>

                    <Separator />

                    <h3 className="heading-4">{t.createTask.schedule}</h3>

                    {isTriggerGoal && (
                      <>
                        <RepeatOccurrencesField
                          label={t.createTask.plannedOccurrences}
                          total={1}
                          onTotalChange={() => {}}
                          disabled
                          message={null}
                        />
                        <p className="paragraph-small text-muted-foreground">
                          {t.createTask.scheduleLockedByTriggerGoal}
                        </p>
                      </>
                    )}

                    {!isTriggerGoal &&
                      repeatMode === "none" &&
                      taskEnableTrigger && (
                        <SettingField>
                          <SettingFieldTitle>
                            {t.createTask.dueDate}
                          </SettingFieldTitle>
                          <SettingFieldDescription>
                            {t.taskDetail.dueDisabledByTrigger}
                          </SettingFieldDescription>
                        </SettingField>
                      )}
                    {!isTriggerGoal &&
                      repeatMode === "none" &&
                      !taskEnableTrigger && (
                        <SettingField>
                          <SettingFieldTitle>
                            {t.createTask.dueDate}
                          </SettingFieldTitle>
                          <div className="flex items-center gap-2">
                            <Controller
                              name="dueDate"
                              control={control}
                              render={({ field }) => (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "h-9 flex-1 justify-start text-left font-normal",
                                        !field.value && "text-muted-foreground"
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
                                      selected={field.value}
                                      onSelect={(date) => {
                                        field.onChange(date)
                                        setValue("repeatMode", "none", {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true,
                                        })
                                        setValue("repeatInterval", undefined, {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true,
                                        })
                                        setValue(
                                          "repeatDaysOfWeek",
                                          undefined,
                                          {
                                            shouldDirty: true,
                                            shouldTouch: true,
                                            shouldValidate: true,
                                          }
                                        )
                                        setValue("repeatStartsAt", undefined, {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true,
                                        })
                                        setValue("repeatEndsAt", undefined, {
                                          shouldDirty: true,
                                          shouldTouch: true,
                                          shouldValidate: true,
                                        })
                                      }}
                                      disabled={(date) =>
                                        isDateOutsideGoalRange(
                                          date,
                                          selectedGoal
                                        )
                                      }
                                      initialFocus
                                    />
                                    <Separator />
                                    <div className="flex flex-col gap-3 p-3">
                                      <SettingField>
                                        <SettingFieldTitle>
                                          {t.createTask.latestFinishTime}
                                        </SettingFieldTitle>
                                        <Input
                                          type="time"
                                          step="60"
                                          value={dueTime}
                                          min={timeBounds.min}
                                          max={timeBounds.max}
                                          onChange={(e) =>
                                            setValue(
                                              "dueTime",
                                              e.target.value,
                                              {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                                shouldValidate: true,
                                              }
                                            )
                                          }
                                        />
                                      </SettingField>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            />
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive disabled:text-muted-foreground disabled:opacity-100 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                              onClick={() => {
                                setValue("dueDate", undefined, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                                setValue("dueTime", DEFAULT_DUE_TIME, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }}
                              disabled={!dueDate || isStandaloneTask}
                              aria-label={t.createTask.clearDueDate}
                            >
                              <Trash />
                            </Button>
                          </div>
                          {goalDurationLabel && (
                            <SettingFieldDescription>
                              {t.createTask.dueWithinGoal}
                            </SettingFieldDescription>
                          )}
                          {isStandaloneTask && (
                            <SettingFieldDescription>
                              {t.createTask.dueRequiredStandalone}
                            </SettingFieldDescription>
                          )}
                          {!isStandaloneTask && !goalDurationLabel && (
                            <SettingFieldDescription>
                              {t.createTask.dueOptionalGoal}
                            </SettingFieldDescription>
                          )}
                          {errors.dueDate && (
                            <SettingFieldError>
                              {resolveCreateTaskError(
                                t,
                                errors.dueDate.message
                              )}
                            </SettingFieldError>
                          )}
                        </SettingField>
                      )}

                    <SettingField>
                      <SettingFieldTitle>
                        {t.createTask.estimatedDuration}
                      </SettingFieldTitle>
                      <Controller
                        name="estimatedMinutes"
                        control={control}
                        render={({ field }) => (
                          <DurationInput
                            value={field.value}
                            onChange={field.onChange}
                          />
                        )}
                      />
                      {errors.estimatedMinutes && (
                        <SettingFieldError>
                          {resolveCreateTaskError(
                            t,
                            errors.estimatedMinutes.message
                          )}
                        </SettingFieldError>
                      )}
                    </SettingField>

                    {!isStandaloneTask && !isTriggerGoal && (
                      <TaskTriggerRepeatCards
                        repeat={{
                          mode: repeatMode,
                          onModeChange: (mode) => {
                            setValue("repeatMode", mode, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                            if (mode !== "none") {
                              setValue("dueDate", undefined, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                              // Repeat tasks can't carry over; keep the (disabled)
                              // cross-day draft consistent. Pure draft state, so
                              // there is nothing to lose if repeat is undone.
                              setTaskAllowCrossDay(false)
                            } else {
                              setValue("repeatStartsAt", undefined, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              })
                              setValue("repeatEndsAt", undefined, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              })
                            }
                          },
                          interval: repeatInterval ?? 1,
                          onIntervalChange: (value) =>
                            setValue("repeatInterval", value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            }),
                          daysOfWeek: repeatDaysOfWeek ?? [],
                          onDaysOfWeekChange: (days) =>
                            setValue("repeatDaysOfWeek", days, {
                              shouldDirty: true,
                              shouldValidate: true,
                            }),
                          extraDisabled: isTriggerGoal,
                          idPrefix: "create-task-repeat",
                          description: t.taskDetail.repeatRuleHelp,
                          labels: {
                            repeat: t.createTask.repeat,
                            daily: t.createTask.daily,
                            weekly: t.createTask.weekly,
                            dailyInterval: t.createTask.interval,
                            daysOfWeek: t.createTask.daysOfWeek,
                            everyNWeeks: t.createTask.everyNWeeks,
                            period: t.createTask.repeatPeriod,
                          },
                          modeFooter: errors.repeatMode ? (
                            <p className="paragraph-small text-destructive">
                              {resolveCreateTaskError(
                                t,
                                errors.repeatMode.message
                              )}
                            </p>
                          ) : undefined,
                          // The repeat period is self-contained (it carries
                          // its own start/end), so the picker always renders —
                          // it does not require the goal to have a due date.
                          period: {
                            value: repeatPeriodDraftValue,
                            onChange: (range) => {
                              setValue("repeatStartsAt", range?.start, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              })
                              setValue("repeatEndsAt", range?.end, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              })
                            },
                            // A goal due date, when present, is an upper bound.
                            isDateDisabled: (date) =>
                              isDateOutsideGoalRange(date, selectedGoal),
                            readOnly: isTriggerGoal,
                            message: repeatPeriodMessage,
                            modifiers: repeatCalendarModifiers,
                            modifiersClassNames:
                              repeatCalendarModifierClassNames,
                          },
                        }}
                        trigger={{
                          id: "create-task-trigger",
                          enabled: taskEnableTrigger,
                          onEnabledChange: (checked) => {
                            setTaskEnableTrigger(checked)
                            if (checked) {
                              const rule =
                                taskTriggerDraft ??
                                buildDefaultTriggerRule("daily")
                              setTaskTriggerOption(rule.mode)
                              setTaskTriggerDraft(rule)
                              setValue("dueDate", undefined, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                              setValue("dueTime", DEFAULT_DUE_TIME, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          },
                          title: t.taskDetail.trigger,
                          description: t.common.triggerHelpTooltip,
                          config: {
                            option: taskTriggerOption,
                            onOptionChange: (mode) => {
                              if (!mode) return
                              const nextRule =
                                taskTriggerDraft?.mode === mode
                                  ? taskTriggerDraft
                                  : buildDefaultTriggerRule(mode)
                              setTaskTriggerOption(mode)
                              setTaskTriggerDraft(nextRule)
                              // Custom fires on explicit dates; a validity
                              // window is redundant and would filter them.
                              if (mode === "custom") {
                                setTaskTriggerStartsAt(undefined)
                                setTaskTriggerEndsAt(undefined)
                              }
                            },
                            draft: taskTriggerDraft,
                            onDraftChange: setTaskTriggerDraft,
                            period: {
                              value:
                                taskTriggerStartsAt && taskTriggerEndsAt
                                  ? {
                                      start: taskTriggerStartsAt,
                                      end: taskTriggerEndsAt,
                                    }
                                  : undefined,
                              onChange: (range) => {
                                setTaskTriggerStartsAt(range?.start)
                                setTaskTriggerEndsAt(range?.end)
                              },
                              isDateDisabled: (date) =>
                                isDateOutsideGoalRange(date, selectedGoal),
                              message: taskTriggerPeriodMessage,
                            },
                          },
                          error: taskTriggerValidationMessage ? (
                            <p className="paragraph-small text-destructive">
                              {taskTriggerValidationMessage}
                            </p>
                          ) : undefined,
                        }}
                      />
                    )}

                    {!isTriggerGoal && (
                      <RepeatOccurrencesField
                        label={t.createTask.plannedOccurrences}
                        total={plannedTotal ?? 1}
                        onTotalChange={(value) =>
                          setValue("plannedTotal", value, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        disabled={isStandaloneTask}
                        message={
                          resolveCreateTaskError(
                            t,
                            errors.plannedTotal?.message
                          ) ?? null
                        }
                        showEstimateActions={Boolean(
                          repeatMode !== "none" &&
                          explicitRepeatRange &&
                          !repeatValidation.error
                        )}
                        estimateActionsDisabled={isTriggerGoal}
                        onAutoEstimate={fillEstimatedOccurrences}
                        autoEstimateLabel={t.createTask.autoEstimate}
                        previewDatesLabel={t.createTask.previewDates}
                        previewModifiers={previewCalendarModifiers}
                        previewModifiersClassNames={
                          previewCalendarModifierClassNames
                        }
                        isPreviewDateDisabled={(date) =>
                          isDateOutsideGoalRange(date, selectedGoal)
                        }
                      />
                    )}
                  </section>
                </div>
              </div>

              {selectedGoal && (
                <aside className="lg:col-span-8 lg:h-full">
                  <div className="flex h-full flex-col gap-4 rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="heading-4">
                        {t.createTask.taskDependencies}
                      </h3>
                    </div>
                    <div className="aspect-video rounded-lg border bg-background p-2 lg:aspect-auto lg:min-h-0 lg:flex-1">
                      {flowDependency ? (
                        <FlowPanelDraft
                          dependency={flowDependency}
                          draftNodeData={DRAFT_TASK_NODE_DATA}
                          editableNodeIds={editableNodeIds}
                          onDraftTreeChange={setDraftTree}
                          className="h-full"
                        />
                      ) : null}
                    </div>
                  </div>
                </aside>
              )}
            </div>

            <DialogFooter sticky className="-mx-6 px-6 sm:justify-between">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t.common.cancel}
              </Button>
              <Button
                data-testid="create-task-submit"
                onClick={onSubmit}
                disabled={
                  !isValid ||
                  Boolean(errors.dueDate) ||
                  Boolean(repeatPeriodMessage) ||
                  Boolean(taskTriggerValidationMessage) ||
                  Boolean(taskTriggerPeriodMessage)
                }
              >
                {t.createTask.createTask}
              </Button>
            </DialogFooter>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
