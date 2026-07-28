import { useEffect, useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useLanguage } from "@/components/shared/language-provider"

export interface RepeatPeriodDraftValue {
  start?: Date
  end?: Date
}

interface RepeatPeriodPickerProps {
  value?: RepeatPeriodDraftValue
  onChange: (range: RepeatPeriodDraftValue | undefined) => void
  disabled?: (date: Date) => boolean
  readOnly?: boolean
  modifiers?: React.ComponentProps<typeof Calendar>["modifiers"]
  modifiersClassNames?: React.ComponentProps<
    typeof Calendar
  >["modifiersClassNames"]
  footer?: React.ReactNode
}

function toDateRange(value?: RepeatPeriodDraftValue): DateRange | undefined {
  if (!value) {
    return undefined
  }

  return {
    from: value.start,
    to: value.end,
  }
}

export function RepeatPeriodPicker({
  value,
  onChange,
  disabled,
  readOnly = false,
  modifiers,
  modifiersClassNames,
  footer,
}: RepeatPeriodPickerProps) {
  const { t } = useLanguage()
  const [draftSelection, setDraftSelection] = useState<DateRange | undefined>(
    () => toDateRange(value)
  )

  useEffect(() => {
    queueMicrotask(() => setDraftSelection(toDateRange(value)))
  }, [value])

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={readOnly}
          className="w-full justify-start px-2.5 font-normal"
        >
          <CalendarIcon />
          {draftSelection?.from ? (
            draftSelection.to ? (
              <>
                {format(draftSelection.from, "yyyy-MM-dd")} -{" "}
                {format(draftSelection.to, "yyyy-MM-dd")}
              </>
            ) : (
              <>
                {format(draftSelection.from, "yyyy-MM-dd")} -{" "}
                <span className="text-muted-foreground">
                  {t.repeatPeriod.pickEndDate}
                </span>
              </>
            )
          ) : (
            <span className="text-muted-foreground">
              {t.repeatPeriod.notSet}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto border-0 bg-transparent p-0 shadow-none"
        align="start"
      >
        <Card size="sm" className="gap-0 py-0 shadow-md">
          <CardContent className="px-0">
            <Calendar
              mode="range"
              defaultMonth={draftSelection?.from}
              selected={draftSelection}
              onSelect={(nextRange) => {
                if (readOnly) {
                  return
                }

                setDraftSelection(nextRange)

                if (!nextRange?.from && !nextRange?.to) {
                  onChange(undefined)
                  return
                }

                onChange({
                  start: nextRange?.from,
                  end: nextRange?.to,
                })
              }}
              disabled={(date) => readOnly || disabled?.(date) === true}
              numberOfMonths={2}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              initialFocus
            />
          </CardContent>
          {footer ? (
            <CardFooter className="items-stretch border-t bg-muted/20 px-3 py-3">
              {footer}
            </CardFooter>
          ) : null}
        </Card>
      </PopoverContent>
    </Popover>
  )
}
