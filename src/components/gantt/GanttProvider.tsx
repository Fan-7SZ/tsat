import { useCallback, useMemo, useState } from "react"
import { GanttContext, type GanttContextValue } from "./use-gantt-context"
import {
  DEFAULT_PX_PER_MINUTE,
  MAX_PX_PER_MINUTE,
  MIN_PX_PER_MINUTE,
  TOTAL_MINUTES,
  clampZoom,
  pickSnapStep,
  pickTickStep,
  type GanttOrientation,
} from "./gantt-geometry"

export function GanttProvider({
  initialPx = DEFAULT_PX_PER_MINUTE,
  orientation = "horizontal",
  children,
}: {
  initialPx?: number
  orientation?: GanttOrientation
  children: React.ReactNode
}) {
  // The zoom the user asked for. The effective `px` is this clamped to the
  // current floor — derived on render rather than synced back into state, so a
  // rising floor needs no extra render pass, and a falling one restores the
  // user's zoom instead of stranding them at the raised value.
  const [requestedPx, setRequestedPx] = useState(() => clampZoom(initialPx))
  // Dynamic floor: the panel measures its viewport and raises this so the whole
  // day always fills the track (no empty space past 24:00 when zoomed out).
  const [minPx, setMinPxRaw] = useState(MIN_PX_PER_MINUTE)

  const clamp = useCallback(
    (value: number) => {
      const lo = Math.max(MIN_PX_PER_MINUTE, minPx)
      return Math.min(MAX_PX_PER_MINUTE, Math.max(lo, value))
    },
    [minPx]
  )

  const px = clamp(requestedPx)

  const setPx = useCallback(
    (next: number | ((prev: number) => number)) =>
      setRequestedPx((prev) =>
        clamp(typeof next === "function" ? next(clamp(prev)) : next)
      ),
    [clamp]
  )
  const zoomBy = useCallback(
    (factor: number) => setRequestedPx((prev) => clamp(clamp(prev) * factor)),
    [clamp]
  )
  const setMinPx = useCallback((next: number) => setMinPxRaw(next), [])

  const value = useMemo<GanttContextValue>(
    () => ({
      orientation,
      px,
      step: pickSnapStep(px),
      labelStep: pickTickStep(px),
      contentWidthPx: TOTAL_MINUTES * px,
      minuteToX: (m) => m * px,
      xToMinute: (x) => x / px,
      setPx,
      zoomBy,
      minPx,
      setMinPx,
    }),
    [orientation, px, setPx, zoomBy, minPx, setMinPx]
  )

  return <GanttContext.Provider value={value}>{children}</GanttContext.Provider>
}
