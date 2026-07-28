import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { TimeQuotaVM } from "@/domain/view-models/HomePageVM"
import { useLanguage } from "@/components/shared/language-provider"

export function TimeQuotaView({
  usedMinutes,
  dailyCapacityMinutes,
}: TimeQuotaVM) {
  const { t } = useLanguage()
  const isOverLimit = usedMinutes > dailyCapacityMinutes
  const tooltipText = isOverLimit
    ? t.quota.overLimitTooltip(usedMinutes, dailyCapacityMinutes)
    : t.quota.normalTooltip(usedMinutes, dailyCapacityMinutes)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help paragraph-small text-muted-foreground">
            {t.quota.occupiedMins(usedMinutes, dailyCapacityMinutes)}
          </span>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
