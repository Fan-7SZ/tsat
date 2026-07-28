import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/shared/language-provider"

const MIN_MINUTES = 1
const MAX_MINUTES = 480
const STEP = 30

function clampAndStep(minutes: number): number {
  const clamped = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, minutes))
  return Math.round(clamped / STEP) * STEP || MIN_MINUTES
}

function parseInput(value: string): number | null {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null

  // "2h30m", "1hour30min"
  const compound = normalized.match(
    /^(\d+(?:\.\d+)?)\s*(?:h|hour|hours)\s*(\d+)\s*(?:m|min|mins|minute|minutes)?$/
  )
  if (compound)
    return Math.round(Number(compound[1]) * 60 + Number(compound[2]))

  // "2h", "1.5hour", "3hours"
  const hourMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:h|hour|hours)$/)
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60)

  // "90m", "30min", "45mins", "60minute", "120minutes"
  const minuteMatch = normalized.match(
    /^(\d+)\s*(?:m|min|mins|minute|minutes)$/
  )
  if (minuteMatch) return Number(minuteMatch[1])

  // bare number → treat as minutes
  const bareNumber = normalized.match(/^(\d+)$/)
  if (bareNumber) return Number(bareNumber[1])

  return null
}

function formatDisplay(minutes: number): string {
  return `${minutes} minutes`
}

type DurationInputProps = {
  value: number | undefined
  onChange: (minutes: number | undefined) => void
  disabled?: boolean
  className?: string
}

export function DurationInput({
  value,
  onChange,
  disabled,
  className,
}: DurationInputProps) {
  const { t } = useLanguage()
  const minutes = value ?? 0
  const [textValue, setTextValue] = useState(
    minutes > 0 ? formatDisplay(minutes) : ""
  )

  const syncText = (next: number) => {
    onChange(next)
    setTextValue(formatDisplay(next))
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setTextValue(next)
    const parsed = parseInput(next)
    if (parsed !== null && parsed > 0) {
      onChange(parsed)
    }
  }

  const handleBlur = () => {
    if (textValue.trim() === "") {
      onChange(undefined)
      return
    }
    const parsed = parseInput(textValue)
    if (parsed === null || parsed <= 0) {
      setTextValue(minutes > 0 ? formatDisplay(minutes) : "")
      return
    }
    const clamped = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, parsed))
    onChange(clamped)
    setTextValue(formatDisplay(clamped))
  }

  return (
    <InputGroup className={cn("w-full", className)}>
      <InputGroupAddon align="inline-start">
        <InputGroupButton
          aria-label="Decrease duration"
          disabled={disabled || minutes <= MIN_MINUTES}
          onClick={() => {
            const next = clampAndStep(minutes - STEP)
            syncText(next)
          }}
        >
          <Minus />
        </InputGroupButton>
      </InputGroupAddon>
      <InputGroupInput
        value={textValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur()
          }
        }}
        placeholder={t.durationInput.placeholder}
        className="text-center"
        aria-label="Duration input"
        disabled={disabled}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label="Increase duration"
          disabled={disabled || minutes >= MAX_MINUTES}
          onClick={() => {
            const next = clampAndStep(minutes + STEP)
            syncText(next)
          }}
        >
          <Plus />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
