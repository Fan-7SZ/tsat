import type { triggerRule } from "@/domain/value-objects/triggerRule"
import { Field, FieldContent, FieldLabel } from "../ui/field"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Calendar as CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group"
import { Calendar } from "../ui/calendar"
import { WeekdayPicker } from "@/components/task/WeekdayPicker"
import { useLanguage } from "@/components/shared/language-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"

const DAY_OF_MONTH_VALUES = Array.from({ length: 31 }, (_, i) => i + 1)

export type SelectTriggerMode = "daily" | "weekly" | "monthly" | "custom" | null

/**
 * Fully-controlled trigger rule editor. Callers own the draft and must seed a
 * non-null value (via buildDefaultTriggerRule) before showing the panel; when
 * value's mode mismatches triggerOption the inputs fall back to defaults for
 * rendering only.
 */
export function TriggerPanel({
  triggerOption,
  value,
  onValueChange,
}: {
  triggerOption: SelectTriggerMode
  value?: triggerRule | null
  onValueChange: (value: triggerRule) => void
}) {
  const { language, t } = useLanguage()
  const activeDailyInterval = value?.mode === "daily" ? value.interval : 1
  const activeWeeklyInterval = value?.mode === "weekly" ? value.interval : 1
  const activeWeeklyDays = value?.mode === "weekly" ? value.daysOfWeek : []
  const activeMonthlyDay = value?.mode === "monthly" ? value.dayOfMonth : 1
  const activeCustomDates = value?.mode === "custom" ? value.date : []

  return (
    <Field>
      {triggerOption === "daily" && (
        <FieldContent className="gap-3">
          <FieldLabel>{t.createGoal.triggerRepeatEvery}</FieldLabel>
          <Input
            type="number"
            value={activeDailyInterval}
            onChange={(e) =>
              onValueChange({ mode: "daily", interval: Number(e.target.value) })
            }
          ></Input>
        </FieldContent>
      )}

      {triggerOption === "weekly" && (
        <FieldContent className="gap-3">
          <FieldLabel>{t.createGoal.triggerDaysOfWeek}</FieldLabel>
          <WeekdayPicker
            value={activeWeeklyDays}
            onChange={(days) =>
              onValueChange({
                mode: "weekly",
                interval: activeWeeklyInterval,
                daysOfWeek: days,
              })
            }
          />
          <FieldLabel>{t.createGoal.triggerEveryNWeeks}</FieldLabel>
          <Input
            type="number"
            value={activeWeeklyInterval}
            onChange={(e) =>
              onValueChange({
                mode: "weekly",
                interval: Number(e.target.value),
                daysOfWeek: activeWeeklyDays,
              })
            }
          ></Input>
        </FieldContent>
      )}
      {triggerOption === "monthly" && (
        <FieldContent className="gap-3">
          <FieldLabel>{t.createGoal.triggerDayOfMonth}</FieldLabel>
          <Select
            value={String(activeMonthlyDay)}
            onValueChange={(day) =>
              onValueChange({ mode: "monthly", dayOfMonth: Number(day) })
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_OF_MONTH_VALUES.map((day) => (
                <SelectItem key={day} value={String(day)}>
                  {t.createGoal.triggerDayOfMonthOption(day)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeMonthlyDay > 28 && (
            <p className="text-muted-foreground text-xs">
              {t.createGoal.triggerMonthlyClampHint}
            </p>
          )}
        </FieldContent>
      )}
      {triggerOption === "custom" && (
        <FieldContent className="gap-3">
          <FieldLabel>{t.createGoal.triggerCustomDates}</FieldLabel>
          <span className="flex items-center gap-2">
            <InputGroup className="flex-1">
              <InputGroupInput
                value={activeCustomDates
                  .map((date) => date.toLocaleDateString(language))
                  .join(", ")}
              ></InputGroupInput>
              <InputGroupAddon align="inline-end">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <CalendarIcon />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="multiple"
                      selected={activeCustomDates}
                      onSelect={(dates) => {
                        onValueChange({ mode: "custom", date: dates ?? [] })
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </InputGroupAddon>
            </InputGroup>
            <Button
              variant="destructive"
              onClick={() => onValueChange({ mode: "custom", date: [] })}
            >
              {t.createGoal.clearCustomDates}
            </Button>
          </span>
        </FieldContent>
      )}
    </Field>
  )
}
