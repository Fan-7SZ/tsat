import { Clipboard, ClipboardClock, ClipboardCheck } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { TaskRuntimeStatus } from "@/domain/entities/TaskRuntimeEntity"

/**
 * Single icon vocabulary for today's runtime status, shared by every surface
 * that shows it (flow panel nodes, sidebar rows, task detail badge).
 */
export const RUNTIME_STATUS_ICON: Record<TaskRuntimeStatus, LucideIcon> = {
  todo: Clipboard,
  inProgress: ClipboardClock,
  done: ClipboardCheck,
}

/**
 * Tint for a bare (unfilled) runtime icon. The detail badge does not use this —
 * it carries the status in its own fill and lets the icon inherit white.
 */
export const RUNTIME_STATUS_ICON_COLOR: Record<TaskRuntimeStatus, string> = {
  todo: "text-primary",
  inProgress: "text-amber-500",
  done: "text-emerald-600",
}
