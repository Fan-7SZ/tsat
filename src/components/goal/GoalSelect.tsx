import { useMemo } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLanguage } from "@/components/shared/language-provider"
import { useAllGoals } from "@/hooks/use-entities"
import type { GoalID } from "@/domain/value-objects/types"
import { cn } from "@/lib/utils"

/** Sentinel for the "no goal / standalone" option (Radix Select forbids ""). */
const NO_GOAL_VALUE = "__none__"

interface GoalSelectProps {
  /** Currently bound goal, or undefined for a standalone task. */
  value: GoalID | undefined
  /** Fires with the chosen goal id, or undefined when "standalone" is picked. */
  onChange: (goalId: GoalID | undefined) => void
  disabled?: boolean
  triggerClassName?: string
  /** Placeholder shown when nothing is selected. Defaults to the standalone label. */
  placeholder?: string
  "aria-label"?: string
}

/**
 * Shared goal picker with a leading "standalone (no goal)" option. Used both to
 * pick a goal when creating a task and to re-bind an existing task's goal.
 */
export function GoalSelect({
  value,
  onChange,
  disabled,
  triggerClassName,
  placeholder,
  "aria-label": ariaLabel,
}: GoalSelectProps) {
  const { t } = useLanguage()
  const goals = useAllGoals()

  const goalOptions = useMemo(
    () => [...goals].sort((left, right) => left.title.localeCompare(right.title)),
    [goals]
  )

  return (
    <Select
      value={value ?? NO_GOAL_VALUE}
      onValueChange={(next) =>
        onChange(next === NO_GOAL_VALUE ? undefined : (next as GoalID))
      }
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn("h-9 w-full", triggerClassName)}
      >
        <SelectValue placeholder={placeholder ?? t.createTask.noGoalStandalone} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_GOAL_VALUE}>
          {t.createTask.noGoalStandalone}
        </SelectItem>
        {goalOptions.map((goal) => (
          <SelectItem key={goal.id} value={goal.id}>
            {goal.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
