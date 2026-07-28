import { useLanguage } from "@/components/shared/language-provider"
import { HelpTooltip } from "@/components/shared/HelpTooltip"

export function TriggerHelpTooltip() {
  const { t } = useLanguage()

  return (
    <HelpTooltip
      content={t.common.triggerHelpTooltip}
      label={t.common.triggerHelpTooltipLabel}
      className="ml-auto"
    />
  )
}
