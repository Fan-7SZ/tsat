import { deleteGoal, updateGoal } from "@/commands/goal.commands"
import {
  deleteGoalTrigger,
  saveGoalTrigger,
  saveGoalTriggerWithTaskNormalization,
} from "@/commands/trigger.commands"
import { createTasks, deleteTask, updateTask } from "@/commands/task.commands"
import {
  createDependency,
  updateDependency,
} from "@/commands/dependency.commands"
import {
  TaskDecomposeDialogContainer,
  type DecomposeCommit,
} from "@/components/dialogs/TaskDecomposeDialogContainer"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DependencyEntityID } from "@/domain/value-objects/types"
import { ActivityItem } from "@/components/task/ActivityItem"
import { FlowPanel } from "@/components/flow/FlowPanel"
import { PageHeader } from "@/components/shared/PageHeader"
import { TagPopoverEditor, TagIcon } from "@/components/goal/TagPopoverEditor"
import { Button } from "@/components/ui/button"
import { NavHistoryButtons } from "@/components/shared/NavHistoryButtons"
import { Card, CardContent } from "@/components/ui/card"
import { TriggerChoiceCard } from "@/components/trigger/TriggerChoiceCard"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ExternalLink, Focus, ListPlus, Search, Trash } from "lucide-react"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import { useTagMap } from "@/hooks/use-tags"
import { useLanguage } from "@/components/shared/language-provider"
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useNavigate,
  useParams,
  useRouteError,
} from "react-router"
import type { GoalDetailSource } from "@/hooks/use-entities"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { GoalDetailPageVM } from "@/domain/view-models/GoalDetailPageVM"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import { InLineSwitchEditor } from "@/components/shared/InLineSwitchEditor"
import { DueDatePicker } from "@/components/shared/DueDatePicker"
import type { SelectTriggerMode } from "@/components/trigger/TriggerPanel"
import { mergeDateAndTime, timeStringFromDate } from "@/utils/date"
import { CreateTaskDialog } from "@/components/dialogs/CreateTaskDialog"
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useGoalActivities } from "@/hooks/use-activities"
import { toast } from "sonner"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import { useGoalDetailPageStore } from "@/store/pages/goal-detail-page.store"
import { useGoalDetailPageVM } from "@/hooks/use-page-view-models"
import {
  buildDefaultTriggerRule,
  validateTriggerDraft,
} from "@/utils/trigger-draft"
import { Badge } from "@/components/ui/badge"
import { DueBadge } from "@/components/shared/DueBadge"
import { GoalForcedHoverCard } from "@/components/shared/ForcedReasonHoverCard"
import { useGoalFocusMap } from "@/hooks/use-goal-focus"
import { normalizeGoalFocus } from "@/utils/goal-focus-status"
import type { GoalFocusStatus } from "@/domain/derived/GoalFocus"

/** Stable string of a trigger rule for dirty comparison (no validity window). */
function serializeRule(rule: triggerRule | null): string {
  if (!rule) return "none"
  if (rule.mode === "daily") return `daily:${rule.interval}`
  if (rule.mode === "weekly") {
    return `weekly:${rule.interval}:${[...rule.daysOfWeek]
      .sort((a, b) => a - b)
      .join(",")}`
  }
  if (rule.mode === "monthly") return `monthly:${rule.dayOfMonth}`
  return `custom:${rule.date
    .map((d) => d.getTime())
    .sort((a, b) => a - b)
    .join(",")}`
}

/** Route error UI: 404 from the loader renders the "goal not found" copy. */
export function GoalDetailErrorBoundary() {
  const error = useRouteError()
  const { t } = useLanguage()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="heading-2 text-muted-foreground">
          {t.goalDetail.goalNotFound}
        </p>
      </div>
    )
  }
  throw error
}

//MARK: -View
export function GoalDetail() {
  const { id: goalId = "" } = useParams()
  const { t } = useLanguage()
  const initialSource = useLoaderData<GoalDetailSource>()
  const { vm: goalDetailPageVM } = useGoalDetailPageVM(
    goalId as GoalID | undefined,
    initialSource
  )
  const resetUiState = useGoalDetailPageStore((state) => state.resetUiState)
  const deleteTaskTarget = useGoalDetailPageStore(
    (state) => state.deleteTaskTarget
  )
  const setDeleteTaskTarget = useGoalDetailPageStore(
    (state) => state.setDeleteTaskTarget
  )

  useEffect(() => {
    resetUiState()
    return () => {
      resetUiState()
    }
  }, [goalId, resetUiState])

  useEffect(() => {
    if (
      deleteTaskTarget &&
      !goalDetailPageVM?.createdByGoalTasks.some(
        (task) => task.taskId === deleteTaskTarget
      )
    ) {
      setDeleteTaskTarget(null)
    }
  }, [deleteTaskTarget, goalDetailPageVM, setDeleteTaskTarget])

  // The loader guarantees first-frame data; this only remains reachable if the
  // goal is deleted (locally or by sync) while the page is open.
  if (!goalDetailPageVM) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="heading-2 text-muted-foreground">
          {t.goalDetail.goalNotFound}
        </p>
      </div>
    )
  }

  return (
    <GoalDetailContent key={goalDetailPageVM.goal.id} vm={goalDetailPageVM} />
  )
}

function GoalDetailContent({ vm }: { vm: GoalDetailPageVM }) {
  const tagsById = useTagMap()
  const navigate = useNavigate()
  const activities = useGoalActivities(vm.goal.id)
  const { t } = useLanguage()
  // Header badges: goal focus state (+ reason hover) and due-policy proximity.
  const goalFocusEntry = useGoalFocusMap()[vm.goal.id]
  const { isFocused, focusStatuses } = normalizeGoalFocus(
    vm.goal.id,
    goalFocusEntry
  )
  const goalCompleted =
    vm.progress.totalCount > 0 &&
    vm.progress.completedCount >= vm.progress.totalCount
  const goalDuePolicy = focusStatuses.find(
    (s): s is Extract<GoalFocusStatus, { kind: "goalDuePolicy" }> =>
      s.kind === "goalDuePolicy"
  )
  const currentTab = useGoalDetailPageStore((state) => state.currentTab)
  const setCurrentTab = useGoalDetailPageStore((state) => state.setCurrentTab)
  const isCreateTaskOpen = useGoalDetailPageStore(
    (state) => state.isCreateTaskOpen
  )
  const setIsCreateTaskOpen = useGoalDetailPageStore(
    (state) => state.setCreateTaskOpen
  )
  const isDeleteOpen = useGoalDetailPageStore((state) => state.isDeleteOpen)
  const setIsDeleteOpen = useGoalDetailPageStore((state) => state.setDeleteOpen)
  const deleteTaskTarget = useGoalDetailPageStore(
    (state) => state.deleteTaskTarget
  )
  const setDeleteTaskTarget = useGoalDetailPageStore(
    (state) => state.setDeleteTaskTarget
  )
  const taskFilter = useGoalDetailPageStore((state) => state.taskFilter)
  const setTaskFilter = useGoalDetailPageStore((state) => state.setTaskFilter)
  const [goalNoteDraft, setGoalNoteDraft] = useState(vm.goal.notes ?? "")
  const goalNoteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const goalTrigger = vm.goal.trigger ?? null
  const hasGoalTrigger = goalTrigger != null
  const [triggerEnabledDraft, setTriggerEnabledDraft] = useState(
    () => goalTrigger != null
  )
  const [triggerDraft, setTriggerDraft] = useState<triggerRule | null>(
    () => goalTrigger?.rule ?? null
  )
  // Absent on older configs means true (due was always stamped before).
  const persistedDueOnReset = goalTrigger?.setDueOnReset ?? true
  const [dueOnResetDraft, setDueOnResetDraft] = useState(persistedDueOnReset)
  // Confirm overwriting non-single-run tasks before enabling the goal trigger.
  const [triggerOverwriteOpen, setTriggerOverwriteOpen] = useState(false)

  const commitGoalPatch = useCallback(
    (patch: Parameters<typeof updateGoal>[1]) => {
      void updateGoal(vm.goal.id, patch, t.commands.goalUpdateFailed)
    },
    [vm.goal.id, t]
  )

  // A goal's period is a single optional due date (no start date).
  const [dueDraft, setDueDraft] = useState<Date | undefined>(
    () => vm.goal.dueAt
  )
  const [dueTime, setDueTime] = useState(() =>
    vm.goal.dueAt ? timeStringFromDate(vm.goal.dueAt) : "23:59"
  )
  const [isDurationDirty, setIsDurationDirty] = useState(false)
  const tagMeta = vm.goal.tagId ? tagsById[vm.goal.tagId] : undefined
  const isDurationDisabledByTrigger = triggerEnabledDraft
  const filteredTasks = useMemo(
    () =>
      vm.createdByGoalTasks.filter((task) =>
        task.title.toLowerCase().includes(taskFilter.toLowerCase())
      ),
    [taskFilter, vm.createdByGoalTasks]
  )

  // ── AI bulk task decomposition ──
  const [isDecomposeOpen, setIsDecomposeOpen] = useState(false)

  const handleDecomposeCommit = useCallback(
    async ({
      updated,
      created,
      deleted,
    }: DecomposeCommit): Promise<boolean> => {
      const goalId = vm.goal.id

      // 1. Apply renames to existing tasks.
      for (const u of updated) {
        const ok = await updateTask(
          u.taskId as TaskID,
          { title: u.title },
          t.commands.taskUpdateFailed
        )
        if (!ok) return false
      }

      // 2. Create the new tasks in one batch so they appear together.
      const newTasks: TaskGroupEntity[] = created.map((title) => ({
        id: crypto.randomUUID() as TaskID,
        goalId,
        title,
        createdAt: new Date(),
        total: 1,
        completedCount: 0,
      }))
      if (newTasks.length > 0) {
        const ok = await createTasks(newTasks, t.commands.taskCreateFailed)
        if (!ok) return false
      }

      // 3. Sync the tree: rename touched nodes, append new parallel nodes.
      //    Deleted nodes are still present here — deleteTask (step 4) removes
      //    them and re-indexes the tree afterwards.
      const renameMap = new Map(updated.map((u) => [u.taskId, u.title]))
      const existingTree = vm.dependencyTree?.tree ?? []
      const nextTree = [
        ...existingTree.map((n) =>
          renameMap.has(String(n.data))
            ? { ...n, title: renameMap.get(String(n.data)) as string }
            : n
        ),
        ...newTasks.map((task) => ({
          data: task.id,
          title: task.title,
          parent: null,
          children: null,
        })),
      ]
      if (vm.dependencyTree) {
        const ok = await updateDependency(
          vm.dependencyTree.id,
          { tree: nextTree },
          t.commands.dependencyUpdateFailed
        )
        if (!ok) return false
      } else if (newTasks.length > 0) {
        const ok = await createDependency(
          {
            id: crypto.randomUUID() as DependencyEntityID,
            belongTo: goalId,
            tree: newTasks.map((task) => ({
              data: task.id,
              title: task.title,
              parent: null,
              children: null,
            })),
          },
          t.commands.dependencyUpdateFailed
        )
        if (!ok) return false
      }

      // 4. Delete removed tasks — deleteTask cleans the dependency tree itself.
      for (const id of deleted) {
        const ok = await deleteTask(id as TaskID, t.commands.taskDeleteFailed)
        if (!ok) return false
      }
      return true
    },
    [vm.goal.id, vm.dependencyTree, t]
  )

  // Trigger draft validity / dirtiness (reactive, mirrors TaskDetail). Goal
  // triggers have no validity window, so only the rule needs validating.
  const triggerDraftMessage = triggerEnabledDraft
    ? validateTriggerDraft(triggerDraft, t)
    : null
  const triggerInvalid = triggerDraftMessage != null
  const isTriggerDirty =
    triggerEnabledDraft !== hasGoalTrigger ||
    (triggerEnabledDraft &&
      (serializeRule(triggerDraft) !==
        serializeRule(goalTrigger?.rule ?? null) ||
        dueOnResetDraft !== persistedDueOnReset))

  // Duration and trigger are mutually exclusive and share one Save/Cancel pair
  // (mirrors TaskDetail's unified schedule draft).
  const isScheduleDirty = isDurationDirty || isTriggerDirty
  const scheduleInvalid = triggerInvalid

  useEffect(() => {
    if (goalNoteDebounceRef.current) {
      clearTimeout(goalNoteDebounceRef.current)
      goalNoteDebounceRef.current = null
    }

    const normalizedDraft = goalNoteDraft.trim()
    const normalizedCurrent = (vm.goal.notes ?? "").trim()

    if (normalizedDraft === normalizedCurrent) {
      return
    }

    goalNoteDebounceRef.current = setTimeout(() => {
      commitGoalPatch({
        notes: normalizedDraft.length > 0 ? normalizedDraft : undefined,
      })
      goalNoteDebounceRef.current = null
    }, 300)

    return () => {
      if (goalNoteDebounceRef.current) {
        clearTimeout(goalNoteDebounceRef.current)
        goalNoteDebounceRef.current = null
      }
    }
  }, [commitGoalPatch, goalNoteDraft, vm.goal.id, vm.goal.notes])

  const handleDueSelect = (date: Date | undefined) => {
    setDueDraft(date)
    setIsDurationDirty(true)
  }

  const handleDueTimeChange = (time: string) => {
    setDueTime(time)
    setIsDurationDirty(true)
  }

  const clearDue = () => {
    setDueDraft(undefined)
    setDueTime("23:59")
    setIsDurationDirty(true)
  }

  const commitDuration = async () => {
    const dueAt = dueDraft ? mergeDateAndTime(dueDraft, dueTime) : undefined

    const saved = await updateGoal(
      vm.goal.id,
      { dueAt },
      t.commands.goalUpdateFailed
    )
    if (!saved) {
      return
    }

    toast.success(t.goalDetail.durationUpdated)
    setIsDurationDirty(false)
  }

  const handleTriggerToggle = (checked: boolean) => {
    if (checked) {
      setTriggerEnabledDraft(true)
      if (!triggerDraft) {
        setTriggerDraft(goalTrigger?.rule ?? buildDefaultTriggerRule("daily"))
      }
    } else {
      setTriggerEnabledDraft(false)
    }
  }

  const handleTriggerModeChange = (mode: SelectTriggerMode) => {
    if (!mode) return
    const nextRule =
      triggerDraft?.mode === mode ? triggerDraft : buildDefaultTriggerRule(mode)
    setTriggerDraft(nextRule)
  }

  // Shared post-save cleanup after a goal trigger is persisted: a triggered
  // goal's due date is cleared server-side, so keep the local due draft in sync.
  const afterTriggerSaved = () => {
    setDueDraft(undefined)
    setDueTime("23:59")
    setIsDurationDirty(false)
    toast.success(t.goalDetail.triggerSaved)
  }

  // Enable the trigger after normalizing non-single-run tasks (invoked once the
  // user confirms the overwrite warning).
  const confirmTriggerOverwrite = () => {
    void (async () => {
      const saved = await saveGoalTriggerWithTaskNormalization(vm.goal.id, {
        rule: triggerDraft!,
        setDueOnReset: dueOnResetDraft,
      })
      if (!saved) return
      afterTriggerSaved()
    })()
  }

  // One Save commits the whole schedule draft, routing by the active mode
  // (trigger vs duration — mutually exclusive). One Cancel reverts both.
  const onScheduleSave = () => {
    if (!isScheduleDirty || scheduleInvalid) return
    void (async () => {
      if (triggerEnabledDraft) {
        // Some tasks are not single-run: confirm before overwriting their count
        // and clearing their repeat / trigger rules.
        if (vm.requiresTriggerNormalization) {
          setTriggerOverwriteOpen(true)
          return
        }
        const saved = await saveGoalTrigger(vm.goal.id, {
          rule: triggerDraft!,
          setDueOnReset: dueOnResetDraft,
        })
        if (!saved) {
          return
        }
        afterTriggerSaved()
        return
      }

      // Trigger disabled in the draft: remove a persisted trigger (if any),
      // then persist the duration draft.
      if (isTriggerDirty) {
        const removed = await deleteGoalTrigger(vm.goal.id)
        if (!removed) {
          return
        }
        toast.success(t.goalDetail.triggerRemoved)
      }
      if (isDurationDirty) {
        await commitDuration()
      }
    })()
  }

  const onScheduleCancel = () => {
    setDueDraft(vm.goal.dueAt)
    setDueTime(vm.goal.dueAt ? timeStringFromDate(vm.goal.dueAt) : "23:59")
    setIsDurationDirty(false)
    setTriggerEnabledDraft(hasGoalTrigger)
    setTriggerDraft(goalTrigger?.rule ?? null)
    setDueOnResetDraft(persistedDueOnReset)
  }
  return (
    <div className="flex min-h-full flex-col gap-0 lg:h-full">
      {/* toolbar */}
      <PageHeader>
        <div className="flex w-full">
          <Header
            goalName={vm.goal.title}
            trailing={
              <div className="flex items-center gap-2">
                {/* Focus: only when focused; hover surfaces the reason. */}
                {isFocused && (
                  <GoalForcedHoverCard
                    goalId={vm.goal.id}
                    goalTitle={vm.goal.title}
                    statuses={focusStatuses}
                  >
                    <Badge size="lg">
                      <Focus data-icon="inline-start" />
                      {t.status.focused}
                    </Badge>
                  </GoalForcedHoverCard>
                )}
                {/* Due: only when due-policy forced into today and not finished. */}
                {!goalCompleted && goalDuePolicy && (
                  <DueBadge dueAt={goalDuePolicy.dueAt} />
                )}
              </div>
            }
          />
        </div>
      </PageHeader>

      {/* goal title */}
      <div className="flex p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-baseline-last gap-4">
            <InLineSwitchEditor
              className="max-w-full min-w-0"
              view={<h2 className="heading-2 truncate">{vm.goal.title}</h2>}
              edit={
                <input
                  className="heading-2 w-full truncate border-none bg-transparent p-0 ring-0 outline-none focus:ring-0"
                  value={vm.goal.title}
                  onChange={(e) => {
                    const nextTitle = e.target.value
                    if (nextTitle === vm.goal.title) return
                    commitGoalPatch({ title: nextTitle })
                  }}
                />
              }
            />
          </div>
          <InLineSwitchEditor
            view={
              <p className="paragraph-large text-muted-foreground">
                {vm.goal.description ?? t.goalDetail.doubleClickDescription}
              </p>
            }
            edit={
              <input
                className="paragraph-large w-full truncate border-none bg-transparent p-0 text-muted-foreground ring-0 outline-none focus:ring-0"
                value={vm.goal.description}
                onChange={(e) => {
                  const nextDescription = e.target.value
                  if (nextDescription === vm.goal.description) return
                  commitGoalPatch({ description: nextDescription })
                }}
              />
            }
          />
        </div>
        <div className="m-auto shrink-0 pl-4">
          <Button
            variant="destructive"
            size="icon"
            onClick={() => setIsDeleteOpen(true)}
          >
            <Trash />
          </Button>
          <ConfirmDeleteDialog
            open={isDeleteOpen}
            onOpenChange={setIsDeleteOpen}
            title={t.goalDetail.deleteGoalTitle}
            description={t.goalDetail.deleteGoalDescription}
            onConfirm={() => {
              void (async () => {
                const deleted = await deleteGoal(
                  vm.goal.id,
                  t.commands.goalDeleteFailed
                )
                if (deleted) {
                  navigate("/goals")
                }
              })()
            }}
          />
          <ConfirmDeleteDialog
            open={deleteTaskTarget !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteTaskTarget(null)
            }}
            title={t.goalDetail.deleteTaskTitle}
            description={t.goalDetail.deleteTaskDescription}
            onConfirm={() => {
              if (deleteTaskTarget) {
                void (async () => {
                  const deleted = await deleteTask(
                    deleteTaskTarget,
                    t.commands.taskDeleteFailed
                  )
                  if (deleted) {
                    setDeleteTaskTarget(null)
                  }
                })()
              }
            }}
          />
          <ConfirmDeleteDialog
            open={triggerOverwriteOpen}
            onOpenChange={setTriggerOverwriteOpen}
            title={t.goalDetail.triggerOverwriteTitle}
            description={t.goalDetail.triggerOverwriteDescription}
            confirmLabel={t.common.continue}
            onConfirm={confirmTriggerOverwrite}
          />
        </div>
      </div>
      <Separator />
      {/* MARK: tabs */}

      <Tabs
        className="w-full flex-1 px-4 py-2"
        value={currentTab}
        onValueChange={(nextValue) => {
          if (nextValue === "details" || nextValue === "tasks") {
            setCurrentTab(nextValue)
          }
        }}
      >
        <TabsList className="shadow-sm">
          <TabsTrigger value="details">{t.goalDetail.details}</TabsTrigger>
          <TabsTrigger value="tasks">{t.goalDetail.tasks}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="flex flex-col gap-2 lg:grid lg:h-full lg:grid-cols-12">
            <Card className="shadow lg:col-span-8 lg:h-full">
              <CardContent className="flex flex-col gap-2">
                {/* MARK: Notes */}
                <h4 className="heading-4">{t.goalDetail.notes}</h4>
                <TagPopoverEditor
                  goalId={vm.goal.id}
                  tagMeta={tagMeta}
                  align="start"
                  trigger={
                    <button
                      type="button"
                      aria-label="Edit goal tag"
                      className="paragraph-mini-medium flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors hover:opacity-85"
                      style={
                        tagMeta
                          ? {
                              backgroundColor: tagMeta.color,
                              color: "#fff",
                              borderColor: tagMeta.color,
                            }
                          : undefined
                      }
                    >
                      {tagMeta ? (
                        <>
                          <TagIcon iconKey={tagMeta.iconKey} />
                          {tagMeta.name}
                        </>
                      ) : (
                        t.goalDetail.addTag
                      )}
                    </button>
                  }
                />
                <Textarea
                  placeholder={t.goalDetail.notesPlaceholder}
                  className="min-h-30"
                  value={goalNoteDraft}
                  onChange={(event) => setGoalNoteDraft(event.target.value)}
                  onBlur={() => {
                    if (goalNoteDebounceRef.current) {
                      clearTimeout(goalNoteDebounceRef.current)
                      goalNoteDebounceRef.current = null
                    }
                    const normalized = goalNoteDraft.trim()
                    const nextNotes =
                      normalized.length > 0 ? normalized : undefined
                    if (nextNotes === vm.goal.notes) return
                    commitGoalPatch({ notes: nextNotes })
                    toast.success(t.goalDetail.notesSaved)
                  }}
                />

                {/* MARK: duration */}
                {/* One Save/Cancel pair governs the whole schedule draft
                    (duration + trigger); it appears only when dirty. */}
                <div className="flex min-h-9 items-center justify-between gap-2">
                  <h4
                    className={
                      isDurationDisabledByTrigger
                        ? "heading-4 text-muted-foreground"
                        : "heading-4"
                    }
                  >
                    {t.createGoal.schedule}
                  </h4>
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
                {isDurationDisabledByTrigger ? (
                  <p className="paragraph-small text-muted-foreground">
                    {t.goalDetail.durationDisabledByTrigger}
                  </p>
                ) : (
                  <Item variant="outline">
                    <ItemContent>
                      <ItemTitle>{t.createGoal.goalDue}</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <DueDatePicker
                        id="goal-detail-due"
                        className="w-55"
                        date={dueDraft}
                        onDateChange={handleDueSelect}
                        time={dueTime}
                        onTimeChange={handleDueTimeChange}
                        timeLabel={t.createGoal.dueTimeLabel}
                        selectDateAriaLabel={t.createGoal.selectDate}
                      />
                      {dueDraft && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive disabled:text-muted-foreground disabled:opacity-100 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                          onClick={clearDue}
                        >
                          <Trash />
                        </Button>
                      )}
                    </ItemActions>
                  </Item>
                )}
                {/* MARK: trigger */}
                <TriggerChoiceCard
                  id="goal-detail-trigger"
                  enabled={triggerEnabledDraft}
                  onEnabledChange={handleTriggerToggle}
                  switchAriaLabel={
                    triggerEnabledDraft
                      ? t.goalDetail.closeTriggerSettings
                      : t.goalDetail.openTriggerSettings
                  }
                  title={t.goalDetail.trigger}
                  description={t.common.triggerHelpTooltip}
                  config={{
                    option: triggerDraft?.mode ?? null,
                    onOptionChange: handleTriggerModeChange,
                    draft: triggerDraft,
                    onDraftChange: setTriggerDraft,
                    dueOnReset: {
                      value: dueOnResetDraft,
                      onChange: setDueOnResetDraft,
                    },
                  }}
                  error={
                    triggerDraftMessage ? (
                      <p className="paragraph-small text-destructive">
                        {triggerDraftMessage}
                      </p>
                    ) : undefined
                  }
                />
              </CardContent>
            </Card>
            <Card className="shadow lg:col-span-4 lg:h-full">
              <CardContent className="flex flex-col gap-2">
                <h4 className="heading-4">{t.goalDetail.goalProgress}</h4>
                <GoalProgress
                  current={vm.progress.completedCount}
                  total={vm.progress.totalCount}
                  timeSpent={vm.progress.totalTimeSpentLabel}
                />
                <Separator />
                <h4 className="heading-4">{t.goalDetail.activityLogs}</h4>
                <ScrollArea className="max-h-60">
                  <ol className="flex flex-col gap-2">
                    {activities.length > 0 ? (
                      activities.map((activity) => (
                        <li key={activity.id}>
                          <ActivityItem
                            kind={activity.kind}
                            taskId={activity.taskId}
                            taskTitle={activity.taskTitle}
                            recordedAt={activity.recordedAtLabel}
                          />
                        </li>
                      ))
                    ) : (
                      <li>
                        <p className="paragraph-small text-muted-foreground">
                          {t.goalDetail.noActivity}
                        </p>
                      </li>
                    )}
                  </ol>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* MARK: Tasks */}
        <TabsContent
          value="tasks"
          className="flex flex-col gap-2 lg:grid lg:h-full lg:grid-cols-12"
        >
          <Card className="shadow lg:col-span-4 lg:h-full">
            <CardContent className="flex h-full min-h-0 flex-col gap-2">
              <div className="flex items-center gap-2">
                <h4 className="heading-4">{t.goalDetail.tasksList}</h4>
                <Button
                  size="icon-lg"
                  variant="outline"
                  className="ml-auto"
                  aria-label={t.goalDetail.aiAddTasks}
                  onClick={() => setIsDecomposeOpen(true)}
                >
                  <ListPlus />
                </Button>
                <Button size="lg" onClick={() => setIsCreateTaskOpen(true)}>
                  {t.goalDetail.addTasks}
                </Button>
              </div>
              <CreateTaskDialog
                open={isCreateTaskOpen}
                onOpenChange={setIsCreateTaskOpen}
                fixedGoalId={vm.goal.id}
              />
              <TaskDecomposeDialogContainer
                open={isDecomposeOpen}
                onOpenChange={setIsDecomposeOpen}
                goalTitle={vm.goal.title}
                goalDescription={vm.goal.description}
                existingTasks={vm.createdByGoalTasks.map((task) => ({
                  id: task.taskId,
                  title: task.title,
                }))}
                onCommit={handleDecomposeCommit}
              />
              <InputGroup>
                <InputGroupInput
                  placeholder={t.goalDetail.taskFilter}
                  value={taskFilter}
                  onChange={(e) => setTaskFilter(e.target.value)}
                />
                <InputGroupAddon>
                  <Search className="h-4 w-4" />
                </InputGroupAddon>
              </InputGroup>
              <div className="flex min-h-0 flex-1 flex-col">
                <p className="paragraph-medium">{t.goalDetail.createdByGoal}</p>
                <Separator className="my-1" />
                <ScrollArea className="min-h-0 flex-1">
                  <ol className="flex flex-col gap-1">
                    {filteredTasks.length > 0 ? (
                      filteredTasks.map((task) => (
                        <li key={task.taskId}>
                          <TaskListItem
                            id={task.taskId}
                            title={task.title}
                            current={task.currentComplete}
                            total={task.totalCount}
                            onDelete={setDeleteTaskTarget}
                          />
                        </li>
                      ))
                    ) : (
                      <p className="paragraph-small text-muted-foreground">
                        {t.goalDetail.noTasks}
                      </p>
                    )}
                  </ol>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow lg:col-span-8 lg:h-full">
            <CardContent className="flex h-full min-h-0 flex-col gap-2">
              <h4 className="heading-4">{t.goalDetail.taskDependencyTree}</h4>
              <div className="h-[55vh] overflow-hidden rounded-lg border bg-muted/20 p-2 lg:h-auto lg:min-h-0 lg:flex-1">
                {vm.dependencyTree ? (
                  <FlowPanel
                    {...vm.dependencyTree}
                    goalTitle={vm.goal.title}
                    className="h-full"
                    onNodeDetail={(taskId) => navigate(`/tasks/${taskId}`)}
                    onNodeDelete={(taskId) =>
                      setDeleteTaskTarget(taskId as TaskID)
                    }
                  />
                ) : (
                  <p className="paragraph-small p-3 text-muted-foreground">
                    {t.goalDetail.noDependencyGraph}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
function Header({
  goalName,
  trailing,
}: {
  goalName?: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex w-full items-center px-4">
      <div className="flex items-center gap-2">
        <NavHistoryButtons />
        <span className="paragraph-regular">{goalName}</span>
        {trailing}
      </div>
    </div>
  )
}

function GoalProgress({
  current,
  total,
  timeSpent,
}: {
  current: number
  total: number
  timeSpent: string
}) {
  // Over-completion (e.g. extra repeat completions beyond the planned total)
  // can push the ratio past 1 — the display caps at a full ring.
  const percentage =
    total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  const { t } = useLanguage()

  // Circle progress parameters
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* Circle progress chart */}
      <div className="relative aspect-square w-28 shrink-0">
        <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90">
          {/* Background ring */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted-foreground/20"
          />
          {/* Progress ring */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="stroke-primary transition-all duration-300"
          />
        </svg>
        {/* Center percentage text */}
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <span className="text-2xl leading-none font-bold tabular-nums">
            {percentage}%
          </span>
        </div>
      </div>

      {/* Right info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="heading-3">
          {current}/{total}
        </p>
        <p className="paragraph-large">{t.goalDetail.tasksCompleted}</p>
        <Separator />
        <p className="paragraph-large">{t.goalDetail.totalTimeSpent}</p>
        <p className="heading-3 font-bold">{timeSpent}</p>
      </div>
    </div>
  )
}

function TaskListItem({
  title,
  current,
  total,
  id,
  onDelete,
}: {
  title: string
  current: number
  total: number
  id: TaskID
  onDelete: (id: TaskID) => void
}) {
  const navigate = useNavigate()
  const { t } = useLanguage()
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link to={`/tasks/${id}`} className="block no-underline">
          <Item variant="outline" className="cursor-pointer hover:bg-accent">
            <ItemTitle>{title}</ItemTitle>
            <ItemDescription className="ml-auto">
              {current}/{total}
            </ItemDescription>
          </Item>
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => navigate(`/tasks/${id}`)}>
          <ExternalLink className="mr-2 size-4" />
          {t.allTasks.viewDetails}
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={() => onDelete(id)}>
          <Trash className="mr-2 size-4" />
          {t.common.delete}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
