import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TOTAL_MINUTES } from "./gantt-geometry"
import { useGanttContext } from "./use-gantt-context"

export function GanttBar() {
  return (
    <Card className="py-0.5 shadow-sm">
      <CardContent>
        <GanttRuler />
      </CardContent>
    </Card>
  )
}

/**
 * Tick label by scale: whole-hour steps show just the hour (`8:00`); finer
 * steps drill down to minutes (`8:30`).
 */
function formatTickLabel(minute: number, step: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  if (step % 60 === 0) return `${h}:00`
  return `${h}:${String(m).padStart(2, "0")}`
}

/**
 * The day-spanning time ruler. Tick density is driven entirely by the shared
 * zoom (`px`) from {@link useGanttContext}: `labelStep` places labeled major
 * ticks, `step` the faint minor ticks. Positions are absolute px (`minuteToX`)
 * over the whole day `[0, TOTAL_MINUTES]`, so the ruler shares the block layer's
 * coordinate system — there is no from/to window to fit. Exported bare (no Card)
 * so the gantt panel can align it flush with the row tracks at x=0; `GanttBar`
 * is the Card-wrapped standalone variant.
 */
export function GanttRuler() {
  const { labelStep, step, minuteToX, contentWidthPx, orientation } =
    useGanttContext()
  const isV = orientation === "vertical"

  const majorPoints: number[] = []
  for (let m = 0; m <= TOTAL_MINUTES; m += labelStep) majorPoints.push(m)

  const minorPoints: number[] = []
  if (step < labelStep) {
    for (let m = 0; m <= TOTAL_MINUTES; m += step) {
      if (m % labelStep !== 0) minorPoints.push(m) // skip positions held by a major
    }
  }

  // Offset along the time (main) axis → top in vertical, left in horizontal.
  const at = (m: number) => (isV ? { top: minuteToX(m) } : { left: minuteToX(m) })

  return (
    <div
      className={cn("relative select-none", isV ? "w-14" : "h-8")}
      style={isV ? { height: contentWidthPx } : { width: contentWidthPx }}
    >
      {/* minor ticks: short lines */}
      {minorPoints.map((m) => (
        <div
          key={`minor-${m}`}
          className={cn(
            "absolute bg-border",
            isV ? "right-0 h-px w-1.5" : "bottom-0 h-1.5 w-px"
          )}
          style={at(m)}
        />
      ))}

      {/* major ticks: taller line + label */}
      {majorPoints.map((m) => (
        <div
          key={`major-${m}`}
          className={cn("absolute", isV ? "right-0 left-0" : "top-0 bottom-0")}
          style={at(m)}
        >
          <span
            className={cn(
              "absolute text-[11px] text-muted-foreground tabular-nums",
              isV ? "top-0.5 left-1" : "top-1 left-1"
            )}
          >
            {formatTickLabel(m, labelStep)}
          </span>
          <div
            className={cn(
              "absolute bg-muted-foreground/40",
              isV ? "right-0 h-px w-3" : "bottom-0 h-3 w-px"
            )}
          />
        </div>
      ))}
    </div>
  )
}
