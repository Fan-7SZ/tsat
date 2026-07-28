import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { Card } from "@/components/ui/card"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import { useLanguage } from "@/components/shared/language-provider"
import { GanttProvider } from "./GanttProvider"
import { GanttRuler } from "./GanttBar"
import { GanttRow } from "./GanttRow"
import { GanttLabel } from "./GanttLabel"
import {
  TOTAL_MINUTES,
  GANTT_LABEL_W,
  GANTT_LABEL_GAP,
  intervalsOverlap,
  overlapsAny,
} from "./gantt-geometry"
import { useGanttContext } from "./use-gantt-context"
import type { PlannerBlock } from "@/store/planner-state-store"

/** Block length (minutes) for a click-created block when a task has no estimate. */
const DEFAULT_BLOCK_MINUTES = 30

/** One task = one gantt row. Blocks are supplied separately, keyed by runtimeId. */
export interface GanttPanelRow {
  runtimeId: string
  taskId: string
  title: string
  goalTitle?: string
  color?: string
  estimatedDuration?: number
}

export interface GanttPanelProps {
  rows: GanttPanelRow[]
  blocksByRuntime: Record<string, PlannerBlock[]>
  onCreate: (runtimeId: string, from: number, to: number) => void
  /** Commit a block's new span (resize, or same-row move). */
  onResize: (runtimeId: string, blockId: string, from: number, to: number) => void
  onRemove: (runtimeId: string, blockId: string) => void
  /** Optional initial zoom (px per minute). */
  initialPx?: number
}

/** Self-contained gantt: owns its own GanttProvider. On mobile it transposes
 *  to a vertical time axis (tasks become columns) so the panel scrolls
 *  vertically instead of horizontally. */
export function GanttPanel({ initialPx, ...props }: GanttPanelProps) {
  const isMobile = useIsMobile()
  return (
    <GanttProvider
      initialPx={initialPx}
      orientation={isMobile ? "vertical" : "horizontal"}
    >
      <GanttPanelInner {...props} />
    </GanttProvider>
  )
}

function GanttPanelInner({
  rows,
  blocksByRuntime,
  onCreate,
  onResize,
  onRemove,
}: Omit<GanttPanelProps, "initialPx">) {
  const { px, setPx, setMinPx, orientation } = useGanttContext()
  const { t } = useLanguage()
  const isV = orientation === "vertical"
  const isEmpty = rows.length === 0
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pendingAnchor = useRef<{ minute: number; offsetX: number } | null>(null)

  // Raise the zoom floor so the whole day always fills the track viewport.
  // Horizontal only: in vertical mode the day stays tall and scrolls.
  useEffect(() => {
    if (isV) return
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const trackWidth = el.clientWidth - GANTT_LABEL_W - GANTT_LABEL_GAP
      if (trackWidth > 0) setMinPx(trackWidth / TOTAL_MINUTES)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [setMinPx, isV])

  // Ctrl/⌘ + wheel = zoom px (anchored under the cursor); plain vertical wheel
  // is left to native scroll so the rows stay reachable when tasks overflow.
  // Horizontal panning is shift/two-finger sideways (and the middle-drag below).
  useEffect(() => {
    if (isV) return // vertical uses native scroll; no wheel-zoom hijack
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // Zoom only with a modifier (trackpad pinch also arrives as ctrlKey).
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const offsetX =
          e.clientX -
          el.getBoundingClientRect().left -
          GANTT_LABEL_W -
          GANTT_LABEL_GAP
        const factor = Math.pow(1.1, -e.deltaY / 100)
        setPx((prev) => {
          pendingAnchor.current = { minute: (el.scrollLeft + offsetX) / prev, offsetX }
          return prev * factor
        })
        return
      }
      // Horizontal intent (two-finger sideways / shift-wheel) → scroll the
      // timeline left/right, like dragging the ruler.
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        el.scrollLeft += e.deltaX || e.deltaY
        return
      }
      // Plain vertical wheel → let the browser scroll the rows natively.
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [setPx, isV])

  // Re-anchor scroll after a zoom so the cursor stays over the same minute.
  useLayoutEffect(() => {
    const el = scrollRef.current
    const a = pendingAnchor.current
    if (el && a) {
      el.scrollLeft = a.minute * px - a.offsetX
      pendingAnchor.current = null
    }
  }, [px])

  // Middle-button drag pans the view left/right (and vertically).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let start: { x: number; y: number; left: number; top: number } | null = null
    const down = (e: PointerEvent) => {
      if (e.button !== 1) return
      e.preventDefault()
      start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!start) return
      el.scrollLeft = start.left - (e.clientX - start.x)
      el.scrollTop = start.top - (e.clientY - start.y)
    }
    const up = (e: PointerEvent) => {
      if (!start) return
      start = null
      el.releasePointerCapture?.(e.pointerId)
    }
    el.addEventListener("pointerdown", down)
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    return () => {
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
    }
  }, [])

  // Cross-row move (resolved by GanttBlock): re-home the block onto another task.
  // Cancelled if the drop would overlap an existing block on the target row.
  const moveBlock = (
    sourceRuntimeId: string,
    blockId: string,
    targetRuntimeId: string,
    from: number,
    to: number
  ) => {
    if (overlapsAny(blocksByRuntime[targetRuntimeId] ?? [], from, to)) return
    onRemove(sourceRuntimeId, blockId)
    onCreate(targetRuntimeId, from, to)
  }

  // Block ids whose time conflicts with a block on a *different* task
  // (double-booking). Shown with a warning ring; not prevented.
  const conflictIds = useMemo(() => {
    const all: { rid: string; id: string; from: number; to: number }[] = []
    for (const [rid, list] of Object.entries(blocksByRuntime))
      for (const b of list) all.push({ rid, id: b.id, from: b.from, to: b.to })
    const set = new Set<string>()
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]
        const c = all[j]
        if (a.rid !== c.rid && intervalsOverlap(a.from, a.to, c.from, c.to)) {
          set.add(a.id)
          set.add(c.id)
        }
      }
    return set
  }, [blocksByRuntime])

  // Left-drag on the ruler scrolls the timeline horizontally (tracks keep
  // left-drag for block creation, so panning lives on the ruler).
  const startRulerPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    e.preventDefault()
    const startX = e.clientX
    const startLeft = el.scrollLeft
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      el.scrollLeft = startLeft - (ev.clientX - startX)
    }
    const up = (ev: PointerEvent) => {
      target.removeEventListener("pointermove", move)
      target.removeEventListener("pointerup", up)
      target.releasePointerCapture?.(ev.pointerId)
    }
    target.addEventListener("pointermove", move)
    target.addEventListener("pointerup", up)
  }

  const trackFor = (row: GanttPanelRow, rowClassName: string) => {
    const blocks = blocksByRuntime[row.runtimeId] ?? []
    return (
      <GanttRow
        runtimeId={row.runtimeId}
        blocks={blocks}
        color={row.color}
        defaultDuration={row.estimatedDuration ?? DEFAULT_BLOCK_MINUTES}
        onCreate={(from, to) => onCreate(row.runtimeId, from, to)}
        onBlockResize={(id, from, to) => onResize(row.runtimeId, id, from, to)}
        onBlockMove={(id, target, from, to) =>
          moveBlock(row.runtimeId, id, target, from, to)
        }
        onBlockRemove={(id) => onRemove(row.runtimeId, id)}
        conflictIds={conflictIds}
        className={rowClassName}
      />
    )
  }

  const scheduledOf = (row: GanttPanelRow) =>
    (blocksByRuntime[row.runtimeId] ?? []).reduce((s, b) => s + (b.to - b.from), 0)

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="flex h-full flex-col gap-0 py-0 ring-0">
        {isV ? (
          /* Vertical (mobile): time runs top→bottom, tasks are side-by-side
             columns. The ruler is sticky-left, the column headers sticky-top,
             the corner sticky-both. Scrolls vertically only (columns share
             the width via flex-1), so there is no horizontal scroll. */
          <div
            ref={scrollRef}
            className="h-full overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex">
              {/* sticky-left time ruler column */}
              <div className="sticky left-0 z-20 shrink-0 bg-card">
                {/* corner spacer — must match the column-header height below so
                    the ruler and the tracks start at the same y. */}
                <div className="sticky top-0 z-30 h-24 bg-card" />
                <GanttRuler />
              </div>
              {/* one column per task; empty → a single "no to-do tasks" column
                  header with the text set vertically (竖排) to match the
                  top→bottom column layout */}
              {isEmpty && (
                <div className="flex min-w-0 flex-1 flex-col px-0.5">
                  <div className="sticky top-0 z-10 h-24 bg-card pb-1">
                    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border text-center paragraph-mini text-muted-foreground [writing-mode:vertical-rl]">
                      {t.planner.noTodoTasks}
                    </div>
                  </div>
                </div>
              )}
              {rows.map((row) => (
                <div
                  key={row.runtimeId}
                  className="flex min-w-0 flex-1 flex-col px-0.5"
                >
                  <div className="sticky top-0 z-10 h-24 bg-card pb-1">
                    <GanttLabel
                      orientation="vertical"
                      title={row.title}
                      goaltitle={row.goalTitle ?? ""}
                      color={row.color}
                      scheduledMinutes={scheduledOf(row)}
                      estimatedDuration={row.estimatedDuration}
                    />
                  </div>
                  {trackFor(row, "w-full")}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Horizontal (desktop): one card, one scroll surface. The ruler is
             sticky-top, the labels sticky-left, the corner sticky-both — so the
             ruler scrolls natively with the tracks (no JS offset sync) and every
             row shares the same [label | track] columns by construction. */
          <div
            ref={scrollRef}
            className="h-full overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="w-max">
              {/* Ruler header — left-drag here pans the timeline horizontally */}
              <div
                onPointerDown={startRulerPan}
                className="sticky top-0 z-20 flex cursor-grab bg-card active:cursor-grabbing"
              >
                {/* W+GAP wide & opaque so the ruler (like the tracks) keeps a
                    persistent gap to the right of the label column even when
                    scrolled — the timeline never slides under the gap. */}
                <div
                  className="sticky left-0 z-30 shrink-0 bg-card"
                  style={{ width: GANTT_LABEL_W + GANTT_LABEL_GAP }}
                />
                <GanttRuler />
              </div>

              {/* One row per task; empty → a single "no to-do tasks" label in
                  the left label column, text laid out horizontally */}
              <div className="space-y-5 pt-3">
                {isEmpty && (
                  <div className="flex items-center">
                    <div
                      className="sticky left-0 z-10 shrink-0 bg-card"
                      style={{ width: GANTT_LABEL_W + GANTT_LABEL_GAP }}
                    >
                      <div
                        className="flex h-14 items-center justify-center rounded-md border border-dashed border-border px-2 text-center paragraph-mini text-muted-foreground"
                        style={{ width: GANTT_LABEL_W }}
                      >
                        {t.planner.noTodoTasks}
                      </div>
                    </div>
                  </div>
                )}
                {rows.map((row) => (
                  <div key={row.runtimeId} className="flex items-center">
                    {/* W+GAP wide & opaque: GanttLabel keeps width W, the extra
                        GAP on its right is bg-card → a gap that stays put while
                        the track scrolls underneath. */}
                    <div
                      className="sticky left-0 z-10 shrink-0 bg-card"
                      style={{ width: GANTT_LABEL_W + GANTT_LABEL_GAP }}
                    >
                      <GanttLabel
                        title={row.title}
                        goaltitle={row.goalTitle ?? ""}
                        color={row.color}
                        scheduledMinutes={scheduledOf(row)}
                        estimatedDuration={row.estimatedDuration}
                      />
                    </div>
                    {trackFor(row, "h-14")}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </TooltipProvider>
  )
}
