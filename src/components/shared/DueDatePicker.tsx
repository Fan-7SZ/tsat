import * as React from "react"
import { format, isValid, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  SettingField,
  SettingFieldTitle,
} from "@/components/shared/setting-field"

const INPUT_FORMAT = "yyyy-MM-dd"

function formatDay(date: Date | undefined): string {
  return date ? format(date, INPUT_FORMAT) : ""
}

/** Parse the locale-neutral `yyyy-MM-dd` input in local time. */
function parseDay(text: string): Date | undefined {
  const parsed = parse(text, INPUT_FORMAT, new Date())
  return isValid(parsed) ? parsed : undefined
}

export interface DueDatePickerProps {
  id?: string
  /** The selected due date (date part only; time is carried separately). */
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  /** Due time as `HH:mm`, edited inside the popover. */
  time: string
  onTimeChange: (time: string) => void
  timeLabel: string
  selectDateAriaLabel: string
  placeholder?: string
  ariaInvalid?: boolean
  disabled?: boolean
  className?: string
}

/**
 * A typeable date input paired with an inline calendar-popover button
 * (shadcn "date picker with input" pattern). The text field accepts a
 * locale-neutral `yyyy-MM-dd` string; the calendar and a due-time input live in
 * the popover. Kept controlled by `date`, so a parent "clear" resets the field.
 */
export function DueDatePicker({
  id,
  date,
  onDateChange,
  time,
  onTimeChange,
  timeLabel,
  selectDateAriaLabel,
  placeholder = INPUT_FORMAT,
  ariaInvalid,
  disabled,
  className,
}: DueDatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState(() => formatDay(date))
  const [month, setMonth] = React.useState<Date | undefined>(date)

  // Keep the text field in sync with the canonical date (calendar select,
  // parent clear, external edits).
  const dateKey = date ? date.getTime() : null
  React.useEffect(() => {
    setText(formatDay(date))
    setMonth(date ?? undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey])

  return (
    <InputGroup className={className}>
      <InputGroupInput
        id={id}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        onChange={(e) => {
          setText(e.target.value)
          const parsed = parseDay(e.target.value)
          if (parsed) {
            onDateChange(parsed)
            setMonth(parsed)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setOpen(true)
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <InputGroupButton
              variant="ghost"
              size="icon-xs"
              aria-label={selectDateAriaLabel}
              disabled={disabled}
            >
              <CalendarIcon />
              <span className="sr-only">{selectDateAriaLabel}</span>
            </InputGroupButton>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0"
            align="end"
            alignOffset={-8}
            sideOffset={10}
          >
            <Calendar
              mode="single"
              selected={date}
              month={month}
              onMonthChange={setMonth}
              onSelect={(next) => {
                onDateChange(next)
                setOpen(false)
              }}
              initialFocus
            />
            <Separator />
            <div className="flex flex-col gap-3 p-3">
              <SettingField>
                <SettingFieldTitle>{timeLabel}</SettingFieldTitle>
                <Input
                  type="time"
                  step="60"
                  value={time}
                  onChange={(e) => onTimeChange(e.target.value)}
                />
              </SettingField>
            </div>
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  )
}
