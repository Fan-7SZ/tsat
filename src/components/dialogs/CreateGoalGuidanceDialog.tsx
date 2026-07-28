import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { createGoal } from "@/commands/goal.commands"
import { createGoalWithTrigger } from "@/commands/trigger.commands"
import { createTasks } from "@/commands/task.commands"
import { createDependency } from "@/commands/dependency.commands"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import {
  TaskDecomposeDialogContainer,
  type DecomposeCommit,
} from "@/components/dialogs/TaskDecomposeDialogContainer"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type {
  DependencyEntityID,
  GoalID,
  TaskID,
} from "@/domain/value-objects/types"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import { useLanguage } from "@/components/shared/language-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DueDatePicker } from "@/components/shared/DueDatePicker"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item"
import type { SelectTriggerMode } from "@/components/trigger/TriggerPanel"
import { TriggerChoiceCard } from "@/components/trigger/TriggerChoiceCard"
import { mergeDateAndTime } from "@/utils/date"
import { buildDefaultTriggerRule } from "@/utils/trigger-draft"
import {
  SettingField,
  SettingFieldTitle,
  SettingFieldError,
} from "@/components/shared/setting-field"

//MARK: define schema (zod)
const triggerRuleSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("daily"),
    interval: z.number().int().min(1),
  }),
  z.object({
    mode: z.literal("weekly"),
    interval: z.number().int().min(1),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  }),
  z.object({
    mode: z.literal("monthly"),
    dayOfMonth: z.number().int().min(1).max(31),
  }),
  z.object({
    mode: z.literal("custom"),
    date: z.array(z.date()).min(1),
  }),
])

// Error messages are stored as i18n keys (relative to `t.createGoal`) rather
// than translated strings, so the schema does not need to be rebuilt when the
// language changes. The key is resolved to the current language at render time
// via `resolveCreateGoalError`.
const createGoalFormSchema = z
  .object({
    title: z.string().trim().min(1, "goalNameRequired"),
    description: z.string().trim(),
    // A goal's period is now just a single optional due date (no start date).
    dueDate: z.date().optional(),
    trigger: triggerRuleSchema.optional(),
  })
  .superRefine((values, context) => {
    const dueDate = values.dueDate
    const trigger = values.trigger

    if (trigger) {
      if (dueDate != null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dueDate"],
          message: "triggerDateRangeUnavailable",
        })
      }

      if (trigger.mode === "daily" && trigger.interval < 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["trigger"],
          message: "triggerDailyIntervalRequired",
        })
      }

      if (trigger.mode === "weekly") {
        if (trigger.daysOfWeek.length === 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["trigger"],
            message: "triggerWeeklyDaysRequired",
          })
        }

        if (trigger.interval < 1) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["trigger"],
            message: "triggerWeeklyIntervalRequired",
          })
        }
      }

      if (trigger.mode === "custom" && trigger.date.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["trigger"],
          message: "triggerCustomDatesRequired",
        })
      }

      return
    }

    // No further constraints: the due date is entirely optional and, being a
    // single point, needs neither a "both dates" nor an ordering check.
  })

type CreateGoalFormValues = z.infer<typeof createGoalFormSchema>

/** Resolve a zod error message (an i18n key) to the current language. */
function resolveCreateGoalError(
  t: ReturnType<typeof useLanguage>["t"],
  message?: string
): string | undefined {
  if (!message) return undefined
  // createGoal also holds function-valued entries (e.g. triggerDayOfMonthOption),
  // so look the key up loosely and only accept plain-string messages.
  const value = (t.createGoal as Record<string, unknown>)[message]
  return typeof value === "string" ? value : message
}

const defaultValues: CreateGoalFormValues = {
  title: "",
  description: "",
  dueDate: undefined,
  trigger: undefined,
}

type CreateGoalGuidanceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateGoalGuidanceDialog({
  open,
  onOpenChange,
}: CreateGoalGuidanceDialogProps) {
  const { t } = useLanguage()
  // Form setup
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    register,
    reset,
    setValue,
    trigger,
  } = useForm<CreateGoalFormValues>({
    resolver: zodResolver(createGoalFormSchema),
    defaultValues,
    mode: "onChange",
  })

  // Validate on every open, not just on mount: the dialog stays mounted between
  // openings, and closing it resets the form (clearing errors), so a mount-only
  // trigger would leave the second open with no "required field" hints at all.
  useEffect(() => {
    if (open) {
      void trigger()
    }
  }, [open, trigger])

  const dueDate = useWatch({ control, name: "dueDate" })
  const triggerValue = useWatch({ control, name: "trigger" })
  // Local state for the due-time input, defaulting to end of day.
  const [dueTime, setDueTime] = useState("23:59")
  const [triggerSettingOpen, setTriggerSettingOpen] = useState(false)
  const [triggerOption, setTriggerOption] = useState<SelectTriggerMode>(null)
  const [triggerSetDue, setTriggerSetDue] = useState(true)

  const resetForm = () => {
    reset(defaultValues)
    setDueTime("23:59")
    setTriggerSettingOpen(false)
    setTriggerOption(null)
    setTriggerSetDue(true)
  }

  const clearTriggerSetting = useCallback(() => {
    setTriggerSettingOpen(false)
    setTriggerOption(null)
    setValue("trigger", undefined, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }, [setValue])

  const openTriggerSetting = useCallback(() => {
    const nextRule = buildDefaultTriggerRule("daily")
    setTriggerSettingOpen(true)
    setTriggerOption(nextRule.mode)
    setValue("dueDate", undefined, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
    setValue("trigger", nextRule, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }, [setValue])

  const handleTriggerModeChange = useCallback(
    (mode: SelectTriggerMode) => {
      if (!mode) return

      const nextRule =
        triggerValue?.mode === mode
          ? triggerValue
          : buildDefaultTriggerRule(mode)

      setTriggerOption(mode)
      setValue("trigger", nextRule, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
      setValue("dueDate", undefined, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
    },
    [setValue, triggerValue]
  )

  const handleTriggerRuleChange = useCallback(
    (value: triggerRule) => {
      setValue("trigger", value, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
      setValue("dueDate", undefined, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
    },
    [setValue]
  )

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }
  // When submitting, create a new goal with a generated ID and the form values, then reset the form and close the dialog
  // ── AI bulk task decomposition after goal creation ──
  const [isDecomposeOpen, setIsDecomposeOpen] = useState(false)
  const [decomposeGoal, setDecomposeGoal] = useState<{
    id: GoalID
    title: string
    description?: string
  } | null>(null)

  // Create the goal from the current form values; returns it on success so the
  // caller can optionally chain task decomposition.
  const persistGoal = async (
    values: CreateGoalFormValues
  ): Promise<GoalEntity | null> => {
    const goal: GoalEntity = {
      id: crypto.randomUUID() as GoalID,
      title: values.title,
      description: values.description || undefined,
      createdAt: new Date(),
      dueAt:
        !values.trigger && values.dueDate
          ? mergeDateAndTime(values.dueDate, dueTime)
          : undefined,
    }
    const created = values.trigger
      ? await createGoalWithTrigger(
          goal,
          { rule: values.trigger, setDueOnReset: triggerSetDue },
          t.commands.goalCreateFailed
        )
      : await createGoal(goal, t.commands.goalCreateFailed)
    return created ? goal : null
  }

  const onSubmit = handleSubmit(async (values) => {
    const goal = await persistGoal(values)
    if (!goal) return
    toast.success(t.createGoal.goalCreated)
    resetForm()
    onOpenChange(false)
  })

  // "Create & add tasks": make the goal, then open the decompose dialog for it.
  const onSubmitWithTasks = handleSubmit(async (values) => {
    const goal = await persistGoal(values)
    if (!goal) return
    toast.success(t.createGoal.goalCreated)
    setDecomposeGoal({
      id: goal.id,
      title: goal.title,
      description: goal.description,
    })
    resetForm()
    onOpenChange(false)
    setIsDecomposeOpen(true)
  })

  const handleDecomposeCommit = async ({
    created,
  }: DecomposeCommit): Promise<boolean> => {
    if (!decomposeGoal) return false
    // One batch so the new tasks appear together.
    const newTasks: TaskGroupEntity[] = created.map((title) => ({
      id: crypto.randomUUID() as TaskID,
      goalId: decomposeGoal.id,
      title,
      createdAt: new Date(),
      total: 1,
      completedCount: 0,
    }))
    if (newTasks.length > 0) {
      const ok = await createTasks(newTasks, t.commands.taskCreateFailed)
      if (!ok) return false
    }
    // Brand-new goal → no existing tree; all tasks parallel (start→each→end).
    return createDependency(
      {
        id: crypto.randomUUID() as DependencyEntityID,
        belongTo: decomposeGoal.id,
        tree: newTasks.map((task) => ({
          data: task.id,
          title: task.title,
          parent: null,
          children: null,
        })),
      },
      t.commands.dependencyUpdateFailed
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-0 p-0 sm:max-w-4xl">
          <ScrollArea className="max-h-[85vh] rounded-[inherit]">
            <div className="flex flex-col gap-6 px-6 pt-6">
              <div className="flex flex-col gap-6">
                <section className="flex flex-col gap-3">
                  <DialogTitle>{t.createGoal.title}</DialogTitle>

                  <SettingField>
                    <SettingFieldTitle>
                      {t.createGoal.goalName}
                    </SettingFieldTitle>
                    <Input
                      {...register("title")}
                      data-testid="create-goal-title"
                      placeholder={t.createGoal.namePlaceholder}
                      aria-invalid={!!errors.title}
                    />
                    {errors.title && (
                      <SettingFieldError>
                        {resolveCreateGoalError(t, errors.title.message)}
                      </SettingFieldError>
                    )}
                  </SettingField>

                  <SettingField>
                    <SettingFieldTitle>
                      {t.createGoal.descriptionOptional}
                    </SettingFieldTitle>
                    <Textarea
                      {...register("description")}
                      placeholder={t.createGoal.descriptionPlaceholder}
                      className="min-h-24"
                    />
                  </SettingField>
                </section>

                <Separator />

                <section className="flex flex-col gap-3">
                  <span
                    className={
                      triggerSettingOpen
                        ? "paragraph-small-medium text-muted-foreground"
                        : "paragraph-small-medium"
                    }
                  >
                    {t.createGoal.schedule}
                  </span>

                  {!triggerSettingOpen && (
                    <Item variant="outline">
                      <ItemContent>
                        <ItemTitle>{t.createGoal.goalDue}</ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <Controller
                          name="dueDate"
                          control={control}
                          render={({ field }) => (
                            <DueDatePicker
                              id="create-goal-due"
                              className="w-55"
                              date={field.value}
                              onDateChange={field.onChange}
                              time={dueTime}
                              onTimeChange={setDueTime}
                              timeLabel={t.createGoal.dueTimeLabel}
                              selectDateAriaLabel={t.createGoal.selectDate}
                              ariaInvalid={!!errors.dueDate}
                            />
                          )}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive disabled:text-muted-foreground disabled:opacity-100 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                          onClick={() =>
                            setValue("dueDate", undefined, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            })
                          }
                          disabled={!dueDate}
                          aria-label={t.createGoal.clearDue}
                        >
                          <Trash />
                        </Button>
                      </ItemActions>
                    </Item>
                  )}

                  {!triggerSettingOpen && errors.dueDate && (
                    <p className="paragraph-small text-destructive">
                      {resolveCreateGoalError(t, errors.dueDate.message)}
                    </p>
                  )}
                  <TriggerChoiceCard
                    id="create-goal-trigger"
                    enabled={triggerSettingOpen}
                    onEnabledChange={(checked) => {
                      if (checked) {
                        openTriggerSetting()
                      } else {
                        clearTriggerSetting()
                      }
                    }}
                    switchAriaLabel={
                      triggerSettingOpen
                        ? t.createGoal.closeTriggerSettings
                        : t.createGoal.openTriggerSettings
                    }
                    title={t.createGoal.settingTrigger}
                    description={t.common.triggerHelpTooltip}
                    config={{
                      option: triggerOption,
                      onOptionChange: handleTriggerModeChange,
                      draft: triggerValue ?? null,
                      onDraftChange: handleTriggerRuleChange,
                      dueOnReset: {
                        value: triggerSetDue,
                        onChange: setTriggerSetDue,
                      },
                    }}
                    error={
                      errors.trigger ? (
                        <p className="paragraph-small text-destructive">
                          {resolveCreateGoalError(t, errors.trigger.message) ??
                            t.createGoal.invalidTrigger}
                        </p>
                      ) : undefined
                    }
                  />
                </section>
              </div>

              <DialogFooter sticky className="-mx-6 px-6 sm:justify-between">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => handleOpenChange(false)}
                >
                  {t.common.cancel}
                </Button>
                {/* Mirrors DialogFooter's stacking: column-reverse on mobile so
                    the primary action sits on top, one row from sm up. */}
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={onSubmitWithTasks}
                    disabled={!isValid}
                  >
                    {t.createGoal.createWithTasks}
                  </Button>
                  <Button
                    data-testid="create-goal-submit"
                    className="w-full sm:w-auto"
                    onClick={onSubmit}
                    disabled={!isValid}
                  >
                    {t.createGoal.createGoal}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      {decomposeGoal && (
        <TaskDecomposeDialogContainer
          open={isDecomposeOpen}
          onOpenChange={setIsDecomposeOpen}
          goalTitle={decomposeGoal.title}
          goalDescription={decomposeGoal.description}
          onCommit={handleDecomposeCommit}
        />
      )}
    </>
  )
}
