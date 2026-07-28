import type { triggerRule } from "@/domain/value-objects/triggerRule"
import { useLanguage } from "@/components/shared/language-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  RepeatPeriodPicker,
  type RepeatPeriodDraftValue,
} from "@/components/task/RepeatPeriodPicker"
import { TriggerPanel, type SelectTriggerMode } from "./TriggerPanel"
import {
  SettingField,
  SettingFieldTitle,
  SettingFieldError,
} from "@/components/shared/setting-field"
import { Switch } from "@/components/ui/switch"

/** Controlled trigger window (task-only). */
interface TriggerPeriodControl {
  value: RepeatPeriodDraftValue | undefined
  onChange: (range: RepeatPeriodDraftValue | undefined) => void
  isDateDisabled: (date: Date) => boolean
  message: string | null
}

/** Controlled "stamp a due date on each reset" toggle (goal-only). */
interface TriggerDueOnResetControl {
  value: boolean
  onChange: (value: boolean) => void
}

export interface TriggerConfigFieldsProps {
  option: SelectTriggerMode
  onOptionChange: (mode: SelectTriggerMode) => void
  draft: triggerRule | null
  onDraftChange: (rule: triggerRule) => void
  /** Provided only for task triggers; omitted for goal triggers (subset). */
  period?: TriggerPeriodControl
  /** Provided only for goal triggers: set a due date on each reset. */
  dueOnReset?: TriggerDueOnResetControl
}

/**
 * Presentational, fully-controlled trigger configuration fields shared by the
 * task and goal panels. Renders only the inner fields (mode select, trigger
 * rule, and — for tasks — the validity window and cross-day toggle). All value
 * binding, validation, persistence and the surrounding collapse/save controls
 * stay in the caller.
 */
export function TriggerConfigFields({
  option,
  onOptionChange,
  draft,
  onDraftChange,
  period,
  dueOnReset,
}: TriggerConfigFieldsProps) {
  const { t } = useLanguage()

  return (
    <>
      <Select
        value={option ?? undefined}
        onValueChange={(value) => onOptionChange(value as SelectTriggerMode)}
      >
        <SelectTrigger className="h-9 w-full">
          <SelectValue placeholder={t.createGoal.triggerModePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="daily">{t.createGoal.triggerDaily}</SelectItem>
          <SelectItem value="weekly">{t.createGoal.triggerWeekly}</SelectItem>
          <SelectItem value="monthly">{t.createGoal.triggerMonthly}</SelectItem>
          <SelectItem value="custom">{t.createGoal.triggerCustom}</SelectItem>
        </SelectContent>
      </Select>

      {option && (
        <TriggerPanel
          triggerOption={option}
          value={draft}
          onValueChange={onDraftChange}
        />
      )}

      {period && option !== "custom" && (
        <SettingField>
          <SettingFieldTitle>{t.taskDetail.triggerPeriod}</SettingFieldTitle>
          <div className="flex items-center gap-2">
            <RepeatPeriodPicker
              value={period.value}
              onChange={period.onChange}
              disabled={period.isDateDisabled}
            />
          </div>
          {period.message && (
            <SettingFieldError>{period.message}</SettingFieldError>
          )}
        </SettingField>
      )}

      {dueOnReset && option && (
        <SettingField>
          <div className="flex items-center gap-3">
            <SettingFieldTitle>
              {t.createGoal.triggerSetDueLabel}
            </SettingFieldTitle>
            <Switch
              checked={dueOnReset.value}
              onCheckedChange={dueOnReset.onChange}
              aria-label={t.createGoal.triggerSetDueLabel}
            />
          </div>
          {dueOnReset.value && (
            <p className="text-muted-foreground text-xs">
              {t.createGoal.triggerSetDueHint}
            </p>
          )}
        </SettingField>
      )}
    </>
  )
}
