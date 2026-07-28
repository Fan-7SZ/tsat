import { useState } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  type Interval,
  freeGap,
  mainClient,
  mainSpanStyle,
  minutesToLabel,
} from "./gantt-geometry"
import { useGanttContext } from "./use-gantt-context"
interface GanttBlockProps {
  /** This block's current row (used to detect cross-row moves). */
  runtimeId: string
  from: number
  to: number
  color?: string
  /** Other blocks in the same row — walls that resize/move clamp against. */
  neighbors: Interval[]
  /** Time-conflicts with a block on another task → shown with a warning ring. */
  conflict?: boolean
  /** Resize / same-row reposition commit (start/end minutes). */
  onValueChange?: (from: number, to: number) => void
  /** Move to a different task row (resolved by what's under the pointer). */
  onMoveToRow?: (targetRuntimeId: string, from: number, to: number) => void
  /** Remove this block. */
  onRemove?: () => void
}

/**
 * A scheduled block. All gestures are plain pointer gestures (no dnd lib):
 * - body drag → move (same row reposition, or re-home onto the row under the
 *   pointer on release)
 * - edge drag → resize
 * - right-click → remove
 *
 * Going all-React (vs a native-listener dnd lib) is what makes the edge handles'
 * `stopPropagation` actually stop the body's move gesture.
 */
export function GanttBlock({
  runtimeId,
  from,
  to,
  color,
  neighbors,
  conflict,
  onValueChange,
  onMoveToRow,
  onRemove,
}: GanttBlockProps) {
  const [draft, setDraft] = useState<{ from: number; to: number } | null>(null)
  const [hoverOpen, setHoverOpen] = useState(false)
  const { px, step, orientation } = useGanttContext()
  const isV = orientation === "vertical"

  const f = draft?.from ?? from
  const t = draft?.to ?? to
  const w = (t - f) * px

  // Drag the body to move. Horizontal follows the pointer live; the target row
  // is whatever sits under the pointer on release (cross-row = re-home).
  function startMove(e: React.PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const cellPx = step * px
    const origFrom = from
    const dur = to - from
    const startMain = mainClient(orientation, e)
    const live = { from: origFrom, to: origFrom + dur }
    // Neighbours are walls: can't move out of the current free gap.
    const { lo, hi } = freeGap(neighbors, origFrom, to)

    const onMove = (ev: PointerEvent) => {
      const dMin = Math.round((mainClient(orientation, ev) - startMain) / cellPx) * step
      const nf = Math.max(lo, Math.min(origFrom + dMin, hi - dur))
      live.from = nf
      live.to = nf + dur
      setDraft({ ...live })
    }
    const onUp = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      setDraft(null)
      const under = document.elementFromPoint(ev.clientX, ev.clientY)
      const row = under?.closest("[data-runtime-id]") as HTMLElement | null
      const target = row?.dataset.runtimeId
      if (target && target !== runtimeId) {
        onMoveToRow?.(target, live.from, live.to)
      } else if (live.from !== origFrom) {
        onValueChange?.(live.from, live.to)
      }
    }
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
  }

  function startResize(side: "left" | "right", e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const handle = e.currentTarget as HTMLElement
    handle.setPointerCapture(e.pointerId)
    const cellPx = step * px
    const origFrom = from
    const origTo = to
    const latest = { from: origFrom, to: origTo }
    const startMain = mainClient(orientation, e)
    // Neighbours cap how far each edge can grow.
    const { lo, hi } = freeGap(neighbors, origFrom, origTo)

    const onMove = (ev: PointerEvent) => {
      const dMin = Math.round((mainClient(orientation, ev) - startMain) / cellPx) * step
      if (side === "right") {
        latest.from = origFrom
        latest.to = Math.min(hi, Math.max(origFrom + step, origTo + dMin))
      } else {
        latest.from = Math.max(lo, Math.min(origTo - step, origFrom + dMin))
        latest.to = origTo
      }
      setDraft({ ...latest })
    }
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove)
      handle.removeEventListener("pointerup", onUp)
      setDraft(null)
      onValueChange?.(latest.from, latest.to) // Releasing pointer confirms the change
    }
    handle.addEventListener("pointermove", onMove)
    handle.addEventListener("pointerup", onUp)
  }

  // Tooltip forced open during a gesture so the time stays visible; else hover.
  const tipOpen = hoverOpen || draft != null

  return (
    <Tooltip open={tipOpen} onOpenChange={setHoverOpen}>
      <TooltipTrigger asChild>
        <div
          onPointerDown={startMove}
          onContextMenu={(e) => {
            // Right-click removes the block.
            e.preventDefault()
            e.stopPropagation()
            onRemove?.()
          }}
          className={cn(
            "absolute cursor-grab overflow-hidden rounded-md border bg-secondary paragraph-mini select-none active:cursor-grabbing",
            // Cross-axis: fill the lane minus a 1-unit inset on each side.
            isV ? "right-1 left-1" : "top-1 bottom-1",
            // Double-booked with another task → warning ring (not blocked).
            conflict && "ring-2 ring-destructive",
            draft != null && "opacity-60"
          )}
          style={{
            ...mainSpanStyle(orientation, f * px, w),
            ...(color
              ? {
                  backgroundColor: `color-mix(in oklab, ${color} 14%, var(--card))`,
                }
              : undefined),
          }}
        >
          {/* start (left/top) resize handle — stopPropagation keeps the body's
              move off. The grip bar hints that the edge is draggable. */}
          <div
            onPointerDown={(e) => startResize("left", e)}
            className={cn(
              "absolute z-10 flex items-center justify-center hover:bg-foreground/10",
              isV
                ? "inset-x-0 top-0 h-2 cursor-ns-resize"
                : "inset-y-0 left-0 w-2 cursor-ew-resize"
            )}
          >
            <div
              className={cn(
                "rounded-full bg-foreground/40",
                isV ? "h-0.5 w-3" : "h-3 w-0.5"
              )}
            />
          </div>
          {/* end (right/bottom) resize handle */}
          <div
            onPointerDown={(e) => startResize("right", e)}
            className={cn(
              "absolute z-10 flex items-center justify-center hover:bg-foreground/10",
              isV
                ? "inset-x-0 bottom-0 h-2 cursor-ns-resize"
                : "inset-y-0 right-0 w-2 cursor-ew-resize"
            )}
          >
            <div
              className={cn(
                "rounded-full bg-foreground/40",
                isV ? "h-0.5 w-3" : "h-3 w-0.5"
              )}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="tabular-nums">
        {minutesToLabel(f)} – {minutesToLabel(t)}
      </TooltipContent>
    </Tooltip>
  )
}
