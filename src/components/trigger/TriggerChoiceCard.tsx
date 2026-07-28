import * as React from "react"
import { BellElectric } from "lucide-react"

import { ChoiceCard } from "@/components/shared/choice-card"
import {
  TriggerConfigFields,
  type TriggerConfigFieldsProps,
} from "@/components/trigger/TriggerConfigFields"

export interface TriggerChoiceCardProps {
  id: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  disabled?: boolean
  title: React.ReactNode
  description?: React.ReactNode
  switchAriaLabel?: string
  /** Trigger config rendered in the card body when enabled. */
  config: TriggerConfigFieldsProps
  /** Validation message rendered under the config. */
  error?: React.ReactNode
}

/**
 * A {@link ChoiceCard} wired for the "enable trigger" toggle: the header carries
 * the title/description/switch, and the body holds {@link TriggerConfigFields}.
 * Used standalone on the goal screens and inside {@link TaskTriggerRepeatCards}.
 */
export function TriggerChoiceCard({
  id,
  enabled,
  onEnabledChange,
  disabled,
  title,
  description,
  switchAriaLabel,
  config,
  error,
}: TriggerChoiceCardProps) {
  return (
    <ChoiceCard
      id={id}
      checked={enabled}
      onCheckedChange={onEnabledChange}
      disabled={disabled}
      title={
        <span className="flex items-center gap-2">
          <BellElectric className="size-4 shrink-0" />
          {title}
        </span>
      }
      description={description}
      switchAriaLabel={switchAriaLabel}
    >
      <div className="flex flex-col gap-3">
        <TriggerConfigFields {...config} />
        {error}
      </div>
    </ChoiceCard>
  )
}
