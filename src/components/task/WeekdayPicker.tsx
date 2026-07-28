import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/shared/language-provider"

const WEEKDAY_VALUES = [0, 1, 2, 3, 4, 5, 6]

export function WeekdayPicker({
  value,
  onChange,
  disabled,
}: {
  value: number[]
  onChange: (days: number[]) => void
  disabled?: boolean
}) {
  const { t } = useLanguage()
  const toggle = (day: number) => {
    if (value.includes(day)) {
      onChange(value.filter((currentDay) => currentDay !== day))
      return
    }

    onChange([...value, day])
  }

  return (
    <div className="flex flex-wrap gap-1">
      {WEEKDAY_VALUES.map((dayValue) => (
        <Button
          key={dayValue}
          type="button"
          size="sm"
          variant={value.includes(dayValue) ? "default" : "outline"}
          onClick={() => toggle(dayValue)}
          disabled={disabled}
        >
          {t.weekdays[dayValue]}
        </Button>
      ))}
    </div>
  )
}
