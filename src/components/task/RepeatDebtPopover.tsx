import { format } from "date-fns"
import { ClipboardClock } from "lucide-react"
import { useState, type MouseEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useLanguage } from "@/components/shared/language-provider"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { parseDateKey } from "@/utils/date"

interface RepeatDebtPopoverProps {
  plannedForDate: LocalDateKey
  onMarkDone: () => void
  onIgnore: () => void
}

function stopTaskLinkEvent(event: MouseEvent) {
  event.stopPropagation()
}

function interceptTaskLinkEvent(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
}

export function RepeatDebtPopover({
  plannedForDate,
  onMarkDone,
  onIgnore,
}: RepeatDebtPopoverProps) {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()
  const originLabel = format(parseDateKey(plannedForDate), "PP")

  const handleTriggerClick = (event: MouseEvent) => {
    interceptTaskLinkEvent(event)
    setOpen((current) => !current)
  }

  const handleIgnoreClick = (event: MouseEvent) => {
    interceptTaskLinkEvent(event)
    onIgnore()
    setOpen(false)
  }

  const handleMarkDoneClick = (event: MouseEvent) => {
    interceptTaskLinkEvent(event)
    onMarkDone()
    setOpen(false)
  }

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t.repeatDebt.triggerLabel}
          className="cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={handleTriggerClick}
          onMouseDown={stopTaskLinkEvent}
        >
          <ClipboardClock />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80"
        onClick={stopTaskLinkEvent}
        onMouseDown={stopTaskLinkEvent}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h4 className="paragraph-small-medium text-foreground">
              {t.repeatDebt.title}
            </h4>
            <p className="paragraph-mini text-muted-foreground">
              {t.repeatDebt.description}
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-2">
            <p className="paragraph-mini text-muted-foreground">
              {t.repeatDebt.originalPlanLabel}
            </p>
            <p className="paragraph-small text-foreground">{originLabel}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleIgnoreClick}
              onMouseDown={stopTaskLinkEvent}
            >
              {t.repeatDebt.ignoreOne}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleMarkDoneClick}
              onMouseDown={stopTaskLinkEvent}
            >
              {t.repeatDebt.markDone}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
