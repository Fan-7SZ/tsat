import type { CSSProperties } from "react"

export const TOTAL_HOURS = 24
export const TOTAL_MINUTES = TOTAL_HOURS * 60

//MARK: orientation
/**
 * Gantt axis orientation. "horizontal" = time runs left→right (desktop);
 * "vertical" = time runs top→bottom, tasks become side-by-side columns
 * (mobile, so the panel scrolls vertically instead of horizontally). The time
 * (main) axis maps minutes→pixels identically in both; only which screen axis
 * carries it differs. Gestures keep the same semantics on the main axis.
 */
export type GanttOrientation = "horizontal" | "vertical"

/** Main-axis (time) client coordinate of a pointer event. */
export const mainClient = (
  o: GanttOrientation,
  e: { clientX: number; clientY: number }
): number => (o === "vertical" ? e.clientY : e.clientX)

/** Main-axis start edge of an element's bounding rect. */
export const mainRectStart = (o: GanttOrientation, rect: DOMRect): number =>
  o === "vertical" ? rect.top : rect.left

/** Position+size along the main axis (cross axis handled by classes). */
export const mainSpanStyle = (
  o: GanttOrientation,
  offsetPx: number,
  sizePx: number
): CSSProperties =>
  o === "vertical"
    ? { top: offsetPx, height: sizePx }
    : { left: offsetPx, width: sizePx }

/** Extent of the track/ruler along the main axis. */
export const mainExtentStyle = (
  o: GanttOrientation,
  sizePx: number
): CSSProperties =>
  o === "vertical" ? { height: sizePx } : { width: sizePx }

/**
 * Width (px) of the sticky left label column. Single source of truth shared by
 * `GanttLabel` and the panel's gutter so the ruler and tracks stay aligned.
 */
export const GANTT_LABEL_W = 160

/** Gap (px) between the label column and the track (and the ruler's origin). */
export const GANTT_LABEL_GAP = 12

//MARK: pixels per minute
export const MIN_PX_PER_MINUTE = 0.3
export const MAX_PX_PER_MINUTE = 10
export const DEFAULT_PX_PER_MINUTE = 1

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export const clampZoom = (px: number) =>
  clamp(px, MIN_PX_PER_MINUTE, MAX_PX_PER_MINUTE)
export const minuteToX = (minute: number, px: number) => minute * px
export const xToMinute = (x: number, px: number) => x / px
export const contentWidth = (px: number) => TOTAL_MINUTES * px
export const snapMinute = (minute: number, step: number) =>
  Math.round(minute / step) * step

export interface Interval {
  from: number
  to: number
}

/** Two half-open intervals overlap. */
export const intervalsOverlap = (
  aFrom: number,
  aTo: number,
  bFrom: number,
  bTo: number
): boolean => aFrom < bTo && bFrom < aTo

/** True if `[from, to)` overlaps any occupied interval. */
export const overlapsAny = (
  occupied: Interval[],
  from: number,
  to: number
): boolean => occupied.some((o) => intervalsOverlap(from, to, o.from, o.to))

/**
 * The maximal free gap `[lo, hi]` around a reference span, given occupied
 * intervals the reference does NOT currently overlap. Each occupied interval is
 * either fully left (a wall on `lo`) or fully right (a wall on `hi`). Used to
 * clamp create/resize/move so a row's blocks never overlap.
 */
export function freeGap(
  occupied: Interval[],
  refFrom: number,
  refTo: number
): { lo: number; hi: number } {
  let lo = 0
  let hi = TOTAL_MINUTES
  for (const o of occupied) {
    if (o.to <= refFrom) lo = Math.max(lo, o.to)
    else if (o.from >= refTo) hi = Math.min(hi, o.from)
  }
  return { lo, hi }
}

/** Format a minute-of-day (0..1440) as `HH:MM`. */
export const minutesToLabel = (minute: number): string => {
  const clamped = Math.max(0, Math.min(TOTAL_MINUTES, Math.round(minute)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}
// /** Ensure bar is at least minDur long and doesn't overflow the day. */
// export function clampBar(
//   startMinute: number,
//   durationMinutes: number,
//   minDur = 5
// ) {
//   const start = clamp(startMinute, 0, TOTAL_MINUTES - minDur)
//   const dur = clamp(durationMinutes, minDur, TOTAL_MINUTES - start)
//   return { startMinute: start, durationMinutes: dur }
// }

// Nice step ladders, chosen by zoom (px per minute).
const LABEL_STEPS = [5, 10, 15, 30, 60, 120, 180, 360, 720] // labeled ticks
const SNAP_STEPS = [1, 5, 10, 15, 30, 60] //                   snap / grid cells

/** Finest step in `ladder` whose pixel size (step*px) is at least `minPx`. */
function pickStep(px: number, ladder: number[], minPx: number): number {
  for (const step of ladder) if (step * px >= minPx) return step
  return ladder[ladder.length - 1]
}

/** Labeled-tick step — keeps labels at least `minLabelPx` apart. */
export const pickTickStep = (px: number, minLabelPx = 64): number =>
  pickStep(px, LABEL_STEPS, minLabelPx)

/** Snap / grid-cell step — keeps cells at least `minCellPx` apart, down to 1min. */
export const pickSnapStep = (px: number, minCellPx = 10): number =>
  pickStep(px, SNAP_STEPS, minCellPx)
