import { useMemo, useRef, useState } from "react"
import { addDays, startOfDay, startOfWeek } from "date-fns"
import {
  AlarmClock,
  BellElectric,
  CalendarClock,
  Flag,
  Repeat,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { toLocalDateKey } from "@/utils/date"
import { useLanguage } from "@/components/shared/language-provider"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import type { DayPressure, PressureReason } from "@/utils/planning-pressure"

export type { DayPressure }

/** lucide icon mirroring PullUpInfoPopover so the reasons read consistently. */
const REASON_ICON: Record<PressureReason, LucideIcon> = {
  repeat: Repeat,
  taskTrigger: BellElectric,
  goalTrigger: Flag,
}

export interface PlanningPressureGridProps {
  /** Anchor day; the forecast window starts here. */
  today: Date
  /** Forecast length in days (heat-coloured window). Defaults to 14. */
  days?: number
  /** Per-day pressure keyed by "YYYY-MM-DD". Missing days render empty. */
  pressureByDay: Record<LocalDateKey, DayPressure>
  /** Called when the user clicks a day cell. */
  onSelectDay?: (dateKey: LocalDateKey) => void
}

/** Number of week rows rendered (from the week containing `today`). */
const ROWS = 3
const WEEK_STARTS_ON = 1 // Monday

/** Heat ramp endpoints: amber-500 (low) → orange-600 (high). A warm gradient
 *  that deliberately stops short of the destructive red reserved for the due
 *  emphasis (which lives on the cell border + corner dot — a different visual
 *  channel), so high pressure and due-today never read as the same colour. */
const HEAT_LOW_RGB = [245, 158, 11] as const // amber-500
const HEAT_HIGH_RGB = [234, 88, 12] as const // orange-600

/** Pull-up count treated as "fully hot". At/above this a cell shows the
 *  hottest colour; the ramp below spreads counts across the whole range so e.g.
 *  10 and 15 read as distinct (the previous exp curve saturated by ~8). */
const HEAT_MAX_COUNT = 15

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * 0→1 heat progress for a raw pull-up count, normalised to `HEAT_MAX_COUNT`.
 * The `** 0.75` gives low counts (where most days land) a gentle boost so
 * they're still visible, while keeping the high end (10→15) well separated.
 * `count` 1→0.13, 3→0.29, 6→0.50, 10→0.74, 15→1.
 */
function pressureProgress(count: number): number {
  if (count <= 0) return 0
  return Math.min(1, count / HEAT_MAX_COUNT) ** 0.75
}

/** Background colour for a forecast cell, or undefined when idle. Both hue
 *  (amber→orange) and alpha ramp with the same progress, so higher pressure
 *  reads as warmer *and* more opaque. */
function heatBackground(count: number): string | undefined {
  const p = pressureProgress(count)
  if (p <= 0) return undefined
  const r = Math.round(lerp(HEAT_LOW_RGB[0], HEAT_HIGH_RGB[0], p))
  const g = Math.round(lerp(HEAT_LOW_RGB[1], HEAT_HIGH_RGB[1], p))
  const b = Math.round(lerp(HEAT_LOW_RGB[2], HEAT_HIGH_RGB[2], p))
  const alpha = 0.16 + p * 0.74
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
}

/**
 * "Planning pressure" forecast: a weekday-aligned grid of day cells covering
 * `today` through `today + days - 1`. Cells in that window are heat-coloured by
 * how many tasks the repeat/trigger rules pull up that day; cells outside the
 * window (past or beyond the horizon) are greyed. Hand-rolled (no month grid)
 * so it spans month boundaries naturally. Presentational — driven by props.
 */
export function PlanningPressureGrid({
  today,
  days = 14,
  pressureByDay,
  onSelectDay,
}: PlanningPressureGridProps) {
  const { t, language } = useLanguage()
  const locale = language === "zh" ? "zh-CN" : "en-US"
  // Radix HoverCard ignores touch pointers entirely (and iOS never focuses
  // buttons on tap), so the cards are controlled here: desktop hover drives
  // `onOpenChange` as usual, while a tap toggles the key via pointer events.
  const [openKey, setOpenKey] = useState<LocalDateKey | null>(null)
  // Open-state of the tapped cell captured at pointerdown, before any
  // dismiss/blur from the same tap mutates it — makes the tap a true toggle.
  const tapWasOpenRef = useRef(false)
  const { cells, weekdayLabels, todayKey, horizonKey } = useMemo(() => {
    const weekStart = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON })
    const cells = Array.from({ length: ROWS * 7 }, (_, i) =>
      addDays(weekStart, i)
    )
    const weekdayLabels = cells
      .slice(0, 7)
      .map((date) => date.toLocaleDateString(locale, { weekday: "narrow" }))
    return {
      cells,
      weekdayLabels,
      todayKey: toLocalDateKey(today),
      horizonKey: toLocalDateKey(addDays(startOfDay(today), days - 1)),
    }
  }, [today, days, locale])

  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <div className="grid grid-cols-7 gap-1.5">
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className="pb-0.5 text-center text-[0.7rem] font-normal text-muted-foreground"
          >
            {label}
          </div>
        ))}
        {cells.map((date) => {
          const dateKey = toLocalDateKey(date)
          const inForecast = dateKey >= todayKey && dateKey <= horizonKey
          const pressure = pressureByDay[dateKey]
          const count = inForecast ? (pressure?.count ?? 0) : 0
          const dueCount = inForecast ? (pressure?.due?.length ?? 0) : 0
          const isToday = dateKey === todayKey
          const isFirstOfMonth = date.getDate() === 1

          const hasDetail =
            inForecast && (count > 0 || dueCount > 0)

          const button = (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDay?.(dateKey)}
              onPointerDown={
                hasDetail
                  ? (event) => {
                      if (event.pointerType === "touch")
                        tapWasOpenRef.current = openKey === dateKey
                    }
                  : undefined
              }
              onPointerUp={
                hasDetail
                  ? (event) => {
                      if (event.pointerType !== "touch") return
                      setOpenKey(tapWasOpenRef.current ? null : dateKey)
                    }
                  : undefined
              }
              style={{ backgroundColor: heatBackground(count) }}
              className={cn(
                // sized to the worst case (the two-line month-start cell):
                // a square that never shrinks below `min-h` so a single digit
                // and the stacked month+day always occupy an identical tile
                "relative aspect-square min-h-7 w-full touch-manipulation rounded-lg border border-transparent paragraph-mini-medium transition-colors",
                "hover:ring-2 hover:ring-ring/30",
                inForecast ? "text-foreground" : "text-muted-foreground/40",
                // a due item that day → destructive ring emphasis, independent
                // of the amber pull-up heat behind it
                dueCount > 0 && "border-destructive ring-1 ring-destructive/40",
                isToday && "ring-1 ring-ring ring-inset"
              )}
            >
              {dueCount > 0 && (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-destructive" />
              )}
              <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                {isFirstOfMonth && (
                  <span className="text-[0.5rem] font-normal opacity-70">
                    {date.toLocaleDateString(locale, { month: "short" })}
                  </span>
                )}
                <span>{date.getDate()}</span>
              </span>
            </button>
          )

          if (!hasDetail) return button

          return (
            <HoverCard
              key={dateKey}
              open={openKey === dateKey}
              onOpenChange={(open) =>
                setOpenKey((current) =>
                  open ? dateKey : current === dateKey ? null : current
                )
              }
            >
              <HoverCardTrigger asChild>{button}</HoverCardTrigger>
              <HoverCardContent align="center" className="w-72 p-3">
                <DayHoverContent date={date} pressure={pressure!} />
              </HoverCardContent>
            </HoverCard>
          )
        })}
      </div>
      <div className="flex items-center justify-center gap-2 text-[0.7rem] text-muted-foreground">
        <span>{t.home.pressureLow}</span>
        <span
          className="h-2.5 w-28 rounded-full"
          style={{
            background: `linear-gradient(to right, rgba(${HEAT_LOW_RGB.join(", ")}, 0.25), rgba(${HEAT_HIGH_RGB.join(", ")}, 0.9))`,
          }}
        />
        <span>{t.home.pressureHigh}</span>
      </div>
    </div>
  )
}

/**
 * HoverCard body for a single forecast day, split into two sections:
 *  1. Due — tasks/goals whose own dueAt lands that day (destructive accent).
 *  2. Pulled up — repeat/trigger pull-ups, each an Item tagged with its goal
 *     (truncatable badge) and the reason it was pulled up.
 * Either section is omitted when empty; the header summarises both counts.
 */
function DayHoverContent({
  date,
  pressure,
}: {
  date: Date
  pressure: DayPressure
}) {
  const { t, language } = useLanguage()
  const locale = language === "zh" ? "zh-CN" : "en-US"

  const dateLabel = date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    weekday: "short",
  })
  const reasonLabel: Record<PressureReason, string> = {
    repeat: t.home.pressureReasonRepeat,
    taskTrigger: t.home.pressureReasonTaskTrigger,
    goalTrigger: t.home.pressureReasonGoalTrigger,
  }
  const dueItems = pressure.due ?? []
  const pullups = pressure.count > 0 ? pressure.items : []

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header: date + due/pull-up summary chips */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="paragraph-small-medium text-foreground">
          {dateLabel}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {dueItems.length > 0 && (
            <span className="paragraph-mini-medium text-destructive">
              {t.home.pressureDueSummary(dueItems.length)}
            </span>
          )}
          {pullups.length > 0 && (
            <span className="paragraph-mini text-muted-foreground">
              {t.home.pressureTooltip(pressure.count, pressure.minutes)}
            </span>
          )}
        </span>
      </div>

      <ScrollArea className="max-h-64">
        <div className="flex flex-col gap-3 pr-2.5">
          {/* ── Due section ── */}
          {dueItems.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-destructive">
                <AlarmClock className="size-3.5" />
                <span className="paragraph-small-medium">
                  {t.home.pressureDueTitle}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {dueItems.map((due, index) => (
                  <li
                    key={`due-${due.kind}-${due.id}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1"
                  >
                    <span className="paragraph-mini min-w-0 truncate text-foreground">
                      {due.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                      {due.goalTitle && (
                        <span className="paragraph-mini max-w-24 truncate">
                          {due.goalTitle}
                        </span>
                      )}
                      {due.timeLabel && (
                        <span className="paragraph-mini tabular-nums">
                          {due.timeLabel}
                        </span>
                      )}
                      <span className="paragraph-mini rounded bg-muted px-1">
                        {due.kind === "task"
                          ? t.home.pressureDueTask
                          : t.home.pressureDueGoal}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Planning section: one Item per pull-up contribution ── */}
          {pullups.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarClock className="size-3.5" />
                <span className="paragraph-small-medium text-foreground">
                  {t.home.pressurePullupTitle}
                </span>
              </div>
              {pullups.map((item, index) => {
                const Icon = REASON_ICON[item.reason]
                return (
                  <Item
                    key={`${item.taskId ?? item.goalId ?? "item"}-${index}`}
                    variant="outline"
                    size="sm"
                  >
                    <ItemContent className="min-w-0">
                      <ItemTitle className="text-foreground">
                        {item.title}
                      </ItemTitle>
                      {item.goalTitle && (
                        <ItemDescription className="truncate">
                          {item.goalTitle}
                        </ItemDescription>
                      )}
                    </ItemContent>
                    <ItemActions className="shrink-0 text-muted-foreground">
                      <Icon className="size-3" />
                      <span className="paragraph-mini">
                        {reasonLabel[item.reason]}
                      </span>
                    </ItemActions>
                  </Item>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
