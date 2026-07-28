import { cn } from "@/lib/utils"
import { Item, ItemContent } from "@/components/ui/item"
import { GANTT_LABEL_W, type GanttOrientation } from "./gantt-geometry"

export function GanttLabel({
  title,
  goaltitle,
  color,
  scheduledMinutes,
  estimatedDuration,
  orientation = "horizontal",
}: {
  title: string
  goaltitle: string
  /** Optional goal color; when absent, falls back to the default Item style. */
  color?: string
  /** Total minutes already scheduled across this task's blocks. */
  scheduledMinutes: number
  /** Task's estimated duration in minutes; omit to hide the `/ estimated` part. */
  estimatedDuration?: number
  /** Vertical = column header (fills width); horizontal = fixed-width left label. */
  orientation?: GanttOrientation
}) {
  const isV = orientation === "vertical"
  return (
    <Item
      variant="outline"
      className={cn(
        "flex-nowrap gap-2 border-2",
        // Vertical column header: stack title over the scheduled/estimated
        // readout (the column is too narrow for them side by side).
        isV && "h-full w-full flex-col items-start justify-center gap-1"
      )}
      style={{
        ...(isV ? undefined : { width: GANTT_LABEL_W }),
        ...(color
          ? {
              borderColor: color,
              backgroundColor: `color-mix(in oklab, ${color} 14%, var(--card))`,
            }
          : undefined),
      }}
    >
      {/* Plain truncating rows — ItemTitle/Description carry `w-fit`, which
          defeats truncation in this narrow fixed-width column. */}
      <ItemContent className={cn("min-w-0 gap-0.5", isV && "w-full")}>
        <div className="paragraph-medium truncate leading-snug">
          {title}
        </div>
        {/* Non-breaking space keeps the 2nd line's height when there's no goal,
            so rows with and without a goal title stay the same height. */}
        <div className="paragraph-mini truncate leading-snug text-muted-foreground">
          {goaltitle || " "}
        </div>
      </ItemContent>
      <GanttLabelMeta
        scheduledMinutes={scheduledMinutes}
        estimatedDuration={estimatedDuration}
        compact={isV}
      />
    </Item>
  )
}

/**
 * Numeric readout pinned to the label's right edge, vertically centered:
 * `scheduled / estimated` (e.g. `90m / 120m`). Drops the `/ estimated` segment
 * when the task has no estimate, and renders nothing when there's neither a
 * schedule nor an estimate.
 */
function GanttLabelMeta({
  scheduledMinutes,
  estimatedDuration,
  compact,
}: {
  scheduledMinutes: number
  estimatedDuration?: number
  /** Vertical column header: smaller text + tighter padding (narrow column). */
  compact?: boolean
}) {
  if (scheduledMinutes === 0 && estimatedDuration == null) return null
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm border whitespace-nowrap text-muted-foreground tabular-nums",
        compact ? "px-1 py-0.5 text-[10px]/none" : "paragraph-mini-medium p-1"
      )}
    >
      {scheduledMinutes}m
      {estimatedDuration != null && ` / ${estimatedDuration}m`}
    </span>
  )
}
