import { BellElectric, Flag, Repeat } from "lucide-react"
import { useState, type MouseEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useLanguage } from "@/components/shared/language-provider"

export type PullUpKind = "repeat" | "trigger" | "goalTrigger"

interface PullUpInfoPopoverProps {
  kind: PullUpKind
  /** Localized cadence summary, e.g. "Weekly on Thu" / "Every 3 days". */
  ruleSummary: string
  /** Nearest / planned pull-up date label. */
  pullUpLabel?: string
  /** Validity window label (task triggers with a start–end window). */
  windowLabel?: string
}

function stopTaskLinkEvent(event: MouseEvent) {
  event.stopPropagation()
}

function interceptTaskLinkEvent(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
}

/**
 * Read-only "why / when is this pulled up" popover for repeat- and
 * trigger-scheduled task items. Mirrors {@link RepeatDebtPopover}'s icon +
 * popover shape but carries no overdue concept and no actions — it only
 * explains the schedule (rule, next date, optional validity window).
 */
export function PullUpInfoPopover({
  kind,
  ruleSummary,
  pullUpLabel,
  windowLabel,
}: PullUpInfoPopoverProps) {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()

  // Icon reflects the scheduling mechanism so the kinds are distinguishable.
  const Icon =
    kind === "repeat" ? Repeat : kind === "goalTrigger" ? Flag : BellElectric

  const title =
    kind === "repeat"
      ? t.pullUpInfo.repeatTitle
      : kind === "goalTrigger"
        ? t.pullUpInfo.goalTriggerTitle
        : t.pullUpInfo.triggerTitle

  const description =
    kind === "repeat"
      ? t.pullUpInfo.repeatDescription
      : kind === "goalTrigger"
        ? t.pullUpInfo.goalTriggerDescription
        : t.pullUpInfo.triggerDescription

  const handleTriggerClick = (event: MouseEvent) => {
    interceptTaskLinkEvent(event)
    setOpen((current) => !current)
  }

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t.pullUpInfo.label}
          className="cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={handleTriggerClick}
          onMouseDown={stopTaskLinkEvent}
        >
          <Icon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72"
        onClick={stopTaskLinkEvent}
        onMouseDown={stopTaskLinkEvent}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h4 className="paragraph-small-medium text-foreground">{title}</h4>
            <p className="paragraph-mini text-muted-foreground">
              {description}
            </p>
          </div>

          <dl className="flex flex-col gap-1.5 rounded-md border bg-muted/30 p-2">
            <InfoRow label={t.pullUpInfo.ruleLabel} value={ruleSummary} />
            {pullUpLabel && (
              <InfoRow label={t.pullUpInfo.nextLabel} value={pullUpLabel} />
            )}
            {windowLabel && (
              <InfoRow label={t.pullUpInfo.windowLabel} value={windowLabel} />
            )}
          </dl>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="paragraph-mini text-muted-foreground">{label}</dt>
      <dd className="paragraph-small text-foreground">{value}</dd>
    </div>
  )
}
