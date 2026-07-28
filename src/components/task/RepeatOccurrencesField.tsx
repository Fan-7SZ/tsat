import { useState, type ComponentProps } from "react"
import { Calendar as CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { clampMinOne } from "@/utils/repeat-count"
import {
  SettingField,
  SettingFieldTitle,
  SettingFieldError,
} from "@/components/shared/setting-field"

export interface RepeatOccurrencesFieldProps {
  label: string
  total: number
  /** Receives the already-clamped (>= 1) value. */
  onTotalChange: (value: number) => void
  disabled?: boolean
  message: string | null
  /** Caller computes visibility (goal due + active rule + valid window). */
  showEstimateActions?: boolean
  estimateActionsDisabled?: boolean
  onAutoEstimate?: () => void
  autoEstimateLabel?: string
  previewDatesLabel?: string
  previewModifiers?: ComponentProps<typeof Calendar>["modifiers"]
  previewModifiersClassNames?: ComponentProps<typeof Calendar>["modifiersClassNames"]
  isPreviewDateDisabled?: (date: Date) => boolean
  previewModal?: boolean
}

/**
 * Presentational, fully-controlled occurrences field shared by the task and AI
 * draft panels: the total count input, the auto-estimate button, and the
 * planned-dates preview popover. Validation, persistence and visibility logic
 * stay in the caller.
 */
export function RepeatOccurrencesField({
  label,
  total,
  onTotalChange,
  disabled = false,
  message,
  showEstimateActions = false,
  estimateActionsDisabled = false,
  onAutoEstimate,
  autoEstimateLabel,
  previewDatesLabel,
  previewModifiers,
  previewModifiersClassNames,
  isPreviewDateDisabled,
  previewModal = false,
}: RepeatOccurrencesFieldProps) {
  // Transient edit buffer: while focused the raw text is kept locally so a
  // partially-typed number (e.g. "1" of "15") is not committed; the clamped
  // value is pushed on blur / Enter.
  const [draft, setDraft] = useState<string | null>(null)

  const commitDraft = () => {
    if (draft == null) {
      return
    }

    const next = clampMinOne(Number(draft))
    setDraft(null)
    if (next !== total) {
      onTotalChange(next)
    }
  }

  return (
    <SettingField>
      <SettingFieldTitle>{label}</SettingFieldTitle>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={1}
          className="flex-1"
          disabled={disabled}
          value={draft ?? String(total)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commitDraft()
            }
          }}
          placeholder="1"
        />
        {showEstimateActions && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={estimateActionsDisabled}
            onClick={onAutoEstimate}
          >
            {autoEstimateLabel}
          </Button>
        )}
      </div>
      {message && (
        <SettingFieldError>{message}</SettingFieldError>
      )}
      {showEstimateActions && (
        <Popover modal={previewModal}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={estimateActionsDisabled}
            >
              <CalendarIcon data-icon="inline-start" />
              {previewDatesLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={undefined}
              disabled={isPreviewDateDisabled}
              classNames={{
                day_button: "pointer-events-none cursor-default",
              }}
              modifiers={previewModifiers}
              modifiersClassNames={previewModifiersClassNames}
            />
          </PopoverContent>
        </Popover>
      )}
    </SettingField>
  )
}
