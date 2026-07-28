import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { useLanguage } from "@/components/shared/language-provider"

export interface DateRangeTimePickerProps {
  /** The currently selected date range. */
  dateRange: DateRange | undefined
  /** Called when the user selects a date range in the calendar. */
  onDateRangeChange: (range: DateRange | undefined) => void
  /** Start time in "HH:mm" format. */
  startTime: string
  /** Called when start time changes. */
  onStartTimeChange: (time: string) => void
  /** End time in "HH:mm" format. */
  endTime: string
  /** Called when end time changes. */
  onEndTimeChange: (time: string) => void
  /** Unique id prefix for accessibility labels. */
  idPrefix?: string
  /** Whether the inputs should show an invalid style. */
  "aria-invalid"?: boolean
  /** Whether the picker is disabled. */
  disabled?: boolean
}

export function DateRangeTimePicker({
  dateRange,
  onDateRangeChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  idPrefix = "drtp",
  "aria-invalid": ariaInvalid,
  disabled,
}: DateRangeTimePickerProps) {
  const { t } = useLanguage()
  //   function DayButton(props: any) {
  //     const { day, ...buttonProps } = props
  //     const isStart = dateRange?.from && isSameDay(day.date, dateRange.from)
  //     const isEnd = dateRange?.to && isSameDay(day.date, dateRange.to)

  //     return (
  //       <div className="relative">
  //         <button {...buttonProps} />
  //         {isStart && (
  //           <Badge variant="outline" className="absolute -top-2 -right-3 paragraph-mini">
  //             start
  //           </Badge>
  //         )}
  //         {isEnd && (
  //           <Badge variant="outline" className="absolute -top-2 -right-3 paragraph-mini">
  //             end
  //           </Badge>
  //         )}
  //       </div>
  //     )
  //   }

  return (
    <>
      <Input
        readOnly
        aria-invalid={ariaInvalid}
        value={
          dateRange?.from
            ? format(dateRange.from, "yyyy-MM-dd")
            : t.repeatPeriod.notSet
        }
        className="flex-1 cursor-default"
        placeholder={t.dateRange.startDate}
      />
      <span className="text-muted-foreground">—</span>
      <Input
        readOnly
        aria-invalid={ariaInvalid}
        value={
          dateRange?.to
            ? format(dateRange.to, "yyyy-MM-dd")
            : t.repeatPeriod.notSet
        }
        className="flex-1 cursor-default"
        placeholder={t.dateRange.endDate}
      />
      <Popover modal>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon-lg" disabled={disabled}>
            <CalendarIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={1}
            captionLayout="dropdown"
          />
          <Separator />
          <div className="border-t bg-card p-3">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${idPrefix}-start-time`}>
                  {t.dateRange.startTime}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={`${idPrefix}-start-time`}
                    type="time"
                    step="1"
                    value={startTime}
                    onChange={(e) => onStartTimeChange(e.target.value)}
                    className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${idPrefix}-end-time`}>
                  {t.dateRange.endTime}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={`${idPrefix}-end-time`}
                    type="time"
                    step="1"
                    value={endTime}
                    onChange={(e) => onEndTimeChange(e.target.value)}
                    className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </InputGroup>
              </Field>
            </FieldGroup>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
