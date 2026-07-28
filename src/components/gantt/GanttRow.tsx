import { useState } from "react"
import { cn } from "@/lib/utils"
import type { PlannerBlock } from "@/store/planner-state-store"
import {
  freeGap,
  mainClient,
  mainExtentStyle,
  mainRectStart,
  mainSpanStyle,
  snapMinute,
} from "./gantt-geometry"
import { useGanttContext } from "./use-gantt-context"
import { GanttBlock } from "./GanttBlock"

interface GanttRowProps {
  runtimeId: string
  blocks: PlannerBlock[]
  color?: string
  onCreate: (from: number, to: number) => void
  onBlockResize: (blockId: string, from: number, to: number) => void
  onBlockMove: (blockId: string, targetRuntimeId: string, from: number, to: number) => void
  onBlockRemove: (blockId: string) => void
  /** Block length (minutes) used when a block is created by a plain click. */
  defaultDuration: number
  /** Ids of blocks that double-book another task (shown with a warning ring). */
  conflictIds: Set<string>
  className?: string
}

/**
 * One task's horizontal track. `data-runtime-id` lets a block's move gesture
 * resolve which row the pointer was released over (cross-row move). Create is a
 * plain pointer gesture; move/resize live inside {@link GanttBlock}.
 */
export function GanttRow({
  runtimeId,
  blocks,
  color,
  onCreate,
  onBlockResize,
  onBlockMove,
  onBlockRemove,
  defaultDuration,
  conflictIds,
  className,
}: GanttRowProps) {
  const { px, step, labelStep, xToMinute, contentWidthPx, orientation } =
    useGanttContext()
  const isV = orientation === "vertical"
  const [draft, setDraft] = useState<{ from: number; to: number } | null>(null)

  function startCreate(e: React.PointerEvent) {
    // Left button only; only the empty track starts a create (a block's own
    // pointerdown stops propagation, so it never reaches here).
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    const track = e.currentTarget as HTMLElement
    const start = mainRectStart(orientation, track.getBoundingClientRect())
    const anchor = snapMinute(xToMinute(mainClient(orientation, e) - start), step)

    // Prevent overlap: a create must stay within the free gap around the anchor;
    // starting inside an existing block does nothing.
    if (blocks.some((b) => anchor >= b.from && anchor < b.to)) return
    const { lo, hi } = freeGap(blocks, anchor, anchor)
    if (hi - lo < step) return // no room

    track.setPointerCapture(e.pointerId)
    const spanAt = (mainCoord: number) => {
      const m = snapMinute(xToMinute(mainCoord - start), step)
      return {
        from: Math.max(lo, Math.min(anchor, m)),
        to: Math.min(hi, Math.max(anchor, m)),
      }
    }

    const onMove = (ev: PointerEvent) =>
      setDraft(spanAt(mainClient(orientation, ev)))
    const onUp = (ev: PointerEvent) => {
      track.removeEventListener("pointermove", onMove)
      track.removeEventListener("pointerup", onUp)
      setDraft(null)
      const { from, to } = spanAt(mainClient(orientation, ev))
      if (to - from >= step) {
        onCreate(from, to) // dragged → sized block
      } else {
        // click → a default-duration block, clamped into the free gap
        const dur = Math.min(defaultDuration, hi - lo)
        const start = Math.max(lo, Math.min(anchor, hi - dur))
        onCreate(start, start + dur)
      }
    }
    track.addEventListener("pointermove", onMove)
    track.addEventListener("pointerup", onUp)
  }

  return (
    <div
      data-runtime-id={runtimeId}
      onPointerDown={startCreate}
      className={cn(
        // The trailing border draws the final (24:00) gridline, which the
        // repeating gradient can't paint (it lands exactly on the end edge).
        // `isolate` keeps blocks' z-10 resize handles inside the track's own
        // stacking context, so they slide *under* the sticky label instead of
        // painting over it.
        "relative isolate border-border select-none",
        isV ? "border-x border-b" : "border-y border-r",
        className
      )}
      style={{
        ...mainExtentStyle(orientation, contentWidthPx),
        // Gridlines at the ruler's labeled ticks (labelStep × px), along the
        // time (main) axis.
        backgroundImage: `repeating-linear-gradient(${
          isV ? "to bottom" : "to right"
        }, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${labelStep * px}px)`,
      }}
    >
      {blocks.map((b) => (
        <GanttBlock
          key={b.id}
          runtimeId={runtimeId}
          from={b.from}
          to={b.to}
          color={color}
          neighbors={blocks.filter((x) => x.id !== b.id)}
          conflict={conflictIds.has(b.id)}
          onValueChange={(from, to) => onBlockResize(b.id, from, to)}
          onMoveToRow={(target, from, to) => onBlockMove(b.id, target, from, to)}
          onRemove={() => onBlockRemove(b.id)}
        />
      ))}

      {/* live create preview */}
      {draft && (
        <div
          className={cn(
            "pointer-events-none absolute rounded-md border border-primary/40 bg-primary/15",
            isV ? "right-1 left-1" : "top-1 bottom-1"
          )}
          style={mainSpanStyle(
            orientation,
            draft.from * px,
            (draft.to - draft.from) * px
          )}
        />
      )}
    </div>
  )
}
