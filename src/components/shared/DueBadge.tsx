import { AlarmClock } from "lucide-react"
import { differenceInCalendarDays } from "date-fns"

import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/components/shared/language-provider"

export interface DueBadgeProps {
  /** The due datetime. */
  dueAt: Date
  /** Injectable "now" for stories / tests; defaults to the current time. */
  now?: Date
}

/**
 * Destructive "Due" badge for a detail-page header, shown when an entity
 * (task or goal) is forced into today by a due-date policy. Surfaces how close
 * the deadline is in day granularity (overdue / today / tomorrow / in Nd).
 * Presentational — driven by props.
 */
export function DueBadge({ dueAt, now = new Date() }: DueBadgeProps) {
  const { t } = useLanguage()
  const days = differenceInCalendarDays(dueAt, now)

  const relative =
    days < 0
      ? t.dueBadge.overdue
      : days === 0
        ? t.dueBadge.today
        : days === 1
          ? t.dueBadge.tomorrow
          : t.dueBadge.inDays(days)

  return (
    <Badge size="lg" variant="destructive">
      <AlarmClock data-icon="inline-start" />
      {t.dueBadge.prefix}: {relative}
    </Badge>
  )
}
