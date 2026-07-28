import { useContext, createContext } from "react"
import type { GanttOrientation } from "./gantt-geometry"
export interface GanttContextValue {
  /** Which screen axis carries time. Defaults to "horizontal" (desktop). */
  orientation: GanttOrientation
  px: number
  step: number
  labelStep: number
  contentWidthPx: number
  minuteToX: (minute: number) => number
  xToMinute: (x: number) => number
  setPx: (next: number | ((prev: number) => number)) => void
  zoomBy: (factor: number) => void
  /** Dynamic lower bound for px (keeps the whole day filling the viewport). */
  minPx: number
  setMinPx: (next: number) => void
}
export const GanttContext = createContext<GanttContextValue | null>(null)
export function useGanttContext(): GanttContextValue {
  const ctx = useContext(GanttContext)
  if (!ctx) throw new Error("useGanttContext 必须在 <GanttProvider> 内使用")
  return ctx
}
