import type { ComponentProps } from "react"
import { Repeat } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Calendar } from "@/components/ui/calendar"
import { WeekdayPicker } from "@/components/task/WeekdayPicker"
import {
  RepeatPeriodPicker,
  type RepeatPeriodDraftValue,
} from "@/components/task/RepeatPeriodPicker"
import { RepeatPeriodLegend } from "@/components/task/RepeatPeriodLegend"
import {
  SettingField,
  SettingFieldTitle,
  SettingFieldError,
} from "@/components/shared/setting-field"
import { ChoiceCard } from "@/components/shared/choice-card"

export type RepeatMode = "none" | "daily" | "weekly"

export interface RepeatRuleLabels {
  repeat: string
  daily: string
  weekly: string
  dailyInterval: string
  daysOfWeek: string
  everyNWeeks: string
  period: string
}

/** Controlled repeat window (rendered when mode !== "none" and provided). */
export interface RepeatPeriodControl {
  value: RepeatPeriodDraftValue | undefined
  onChange: (range: RepeatPeriodDraftValue | undefined) => void
  isDateDisabled: (date: Date) => boolean
  readOnly?: boolean
  message: string | null
  modifiers?: ComponentProps<typeof Calendar>["modifiers"]
  modifiersClassNames?: ComponentProps<typeof Calendar>["modifiersClassNames"]
}

export interface RepeatRuleFieldsProps {
  mode: RepeatMode
  /** Caller owns side effects (clearing due / period etc.). */
  onModeChange: (mode: RepeatMode) => void
  interval: number
  onIntervalChange: (value: number) => void
  daysOfWeek: number[]
  onDaysOfWeekChange: (days: number[]) => void
  disabled?: boolean
  labels: RepeatRuleLabels
  /** Explanatory text shown as the card description. */
  description?: React.ReactNode
  /** Disabled-reason / error messages rendered under the enable toggle. */
  modeFooter?: React.ReactNode
  period?: RepeatPeriodControl
  /** Prefix for the enable-toggle element id. */
  idPrefix?: string
  /** Extra fields rendered inside the card body (e.g. an occurrences count). */
  extraFields?: React.ReactNode
}

/**
 * Presentational, fully-controlled repeat-rule fields shared by the task and AI
 * draft panels: mode select, daily/weekly interval, weekday picker, and the
 * repeat-period picker. All state binding, validation, mode-change side effects
 * and the surrounding section/occurrences blocks stay in the caller.
 */
export function RepeatRuleFields({
  mode,
  onModeChange,
  interval,
  onIntervalChange,
  daysOfWeek,
  onDaysOfWeekChange,
  disabled = false,
  labels,
  description,
  modeFooter,
  period,
  idPrefix = "repeat-rule",
  extraFields,
}: RepeatRuleFieldsProps) {
  const parseInterval = (raw: string) =>
    onIntervalChange(raw === "" ? 1 : Number(raw))

  return (
    <div className="flex flex-col gap-1.5">
      <ChoiceCard
        id={`${idPrefix}-enabled`}
        checked={mode !== "none"}
        disabled={disabled}
        onCheckedChange={(checked) => onModeChange(checked ? "daily" : "none")}
        title={
          <span className="flex items-center gap-2">
            <Repeat className="size-4 shrink-0" />
            {labels.repeat}
          </span>
        }
        description={description}
      >
        <div className="flex flex-col gap-4">
          <Select
            value={mode}
            disabled={disabled}
            onValueChange={(value) => onModeChange(value as RepeatMode)}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{labels.daily}</SelectItem>
              <SelectItem value="weekly">{labels.weekly}</SelectItem>
            </SelectContent>
          </Select>

          {mode === "daily" && (
            <SettingField>
              <SettingFieldTitle>{labels.dailyInterval}</SettingFieldTitle>
              <Input
                type="number"
                min={1}
                disabled={disabled}
                value={interval}
                onChange={(e) => parseInterval(e.target.value)}
                placeholder="1"
              />
            </SettingField>
          )}

          {mode === "weekly" && (
            <SettingField>
              <SettingFieldTitle>{labels.daysOfWeek}</SettingFieldTitle>
              <WeekdayPicker
                value={daysOfWeek}
                disabled={disabled}
                onChange={onDaysOfWeekChange}
              />
              <SettingField>
                <SettingFieldTitle>{labels.everyNWeeks}</SettingFieldTitle>
                <Input
                  type="number"
                  min={1}
                  disabled={disabled}
                  value={interval}
                  onChange={(e) => parseInterval(e.target.value)}
                  placeholder="1"
                />
              </SettingField>
            </SettingField>
          )}

          {period && (
            <SettingField>
              <SettingFieldTitle>{labels.period}</SettingFieldTitle>
              <div className="flex items-center gap-2">
                <RepeatPeriodPicker
                  value={period.value}
                  onChange={period.onChange}
                  disabled={period.isDateDisabled}
                  readOnly={period.readOnly}
                  modifiers={period.modifiers}
                  modifiersClassNames={period.modifiersClassNames}
                  footer={<RepeatPeriodLegend />}
                />
              </div>
              {period.message && (
                <SettingFieldError>{period.message}</SettingFieldError>
              )}
            </SettingField>
          )}

          {extraFields}
        </div>
      </ChoiceCard>
      {modeFooter}
    </div>
  )
}
