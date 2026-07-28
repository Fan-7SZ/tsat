import { FieldGroup } from "@/components/ui/field"
import {
  RepeatRuleFields,
  type RepeatRuleFieldsProps,
} from "@/components/task/RepeatRuleFields"
import {
  TriggerChoiceCard,
  type TriggerChoiceCardProps,
} from "@/components/trigger/TriggerChoiceCard"

export interface TaskTriggerRepeatCardsProps {
  /** Trigger choice card props. `extraDisabled` adds reasons beyond the mutual lock. */
  trigger: Omit<TriggerChoiceCardProps, "disabled"> & { extraDisabled?: boolean }
  /** Repeat fields props. `extraDisabled` adds reasons beyond the mutual lock. */
  repeat: Omit<RepeatRuleFieldsProps, "disabled"> & { extraDisabled?: boolean }
}

/**
 * The mutually-exclusive "repeat" + "trigger" choice-card pair for task screens
 * (create-task / task-detail / AI-assist). Renders both as a {@link FieldGroup}
 * and computes the cross-disable (enabling one disables the other) internally —
 * the clearing side-effects stay in each parent's `onModeChange`/`onEnabledChange`.
 */
export function TaskTriggerRepeatCards({
  trigger,
  repeat,
}: TaskTriggerRepeatCardsProps) {
  const { extraDisabled: triggerExtraDisabled, ...triggerProps } = trigger
  const { extraDisabled: repeatExtraDisabled, ...repeatProps } = repeat

  const repeatOn = repeat.mode !== "none"
  const triggerDisabled = repeatOn || triggerExtraDisabled
  const repeatDisabled = trigger.enabled || repeatExtraDisabled

  return (
    <FieldGroup>
      <RepeatRuleFields {...repeatProps} disabled={repeatDisabled} />
      <TriggerChoiceCard {...triggerProps} disabled={triggerDisabled} />
    </FieldGroup>
  )
}
