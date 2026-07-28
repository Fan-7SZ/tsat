import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { FocusQuotaVM } from "@/domain/view-models/HomePageVM"
import { useLanguage } from "@/components/shared/language-provider"

export function FocusQuotaView({
  focusedCount,
  forcedFocusedCount,
  maxFocusGoals,
}: FocusQuotaVM) {
  const { t } = useLanguage()
  const isOverLimit = focusedCount > maxFocusGoals
  const tooltipText = isOverLimit
    ? t.quota.focusOverLimit(maxFocusGoals)
    : forcedFocusedCount > 0
      ? t.quota.focusWithForced(forcedFocusedCount)
      : t.quota.focusNormal(maxFocusGoals)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help paragraph-small text-muted-foreground">
            {t.quota.focusedCount(focusedCount, maxFocusGoals)}
          </span>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
