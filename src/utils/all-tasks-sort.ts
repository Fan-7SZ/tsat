import type { AllTasksRowVM } from "@/domain/view-models/AllTasksPageVM"

// ── Status ────────────────────────────────────────────────
// Ascending order: in progress → todo → done → not scheduled (null).
export const STATUS_RANK: Record<string, number> = {
  inProgress: 0,
  todo: 1,
  done: 2,
}

const statusRank = (s: AllTasksRowVM["runtimeStatus"]): number =>
  s == null ? 3 : (STATUS_RANK[s] ?? 3)

export const compareStatus = (a: AllTasksRowVM, b: AllTasksRowVM): number =>
  statusRank(a.runtimeStatus) - statusRank(b.runtimeStatus)

// ── Completion ────────────────────────────────────────────
// Ratio = completedCount / totalCount. Tasks with no steps (totalCount === 0)
// have no ratio and sort last in ascending order (mirrors Due Date's null-last).
export const compareCompletion = (
  a: AllTasksRowVM,
  b: AllTasksRowVM
): number => {
  const ra = a.totalCount > 0 ? a.completedCount / a.totalCount : null
  const rb = b.totalCount > 0 ? b.completedCount / b.totalCount : null
  if (ra != null && rb != null) return ra - rb
  if (ra != null) return -1
  if (rb != null) return 1
  return 0
}

// ── Goal ──────────────────────────────────────────────────
// Sorting by goal clusters a goal's tasks together; titles compare
// locale-aware, and standalone tasks (no goal) sort last in ascending order
// (mirrors Due Date's null-last).
export const compareGoal = (a: AllTasksRowVM, b: AllTasksRowVM): number => {
  const ta = a.goalTitle
  const tb = b.goalTitle
  if (ta != null && tb != null) return ta.localeCompare(tb)
  if (ta != null) return -1
  if (tb != null) return 1
  return 0
}

// ── Duration ──────────────────────────────────────────────
// Estimated duration in minutes; undefined sorts last in ascending order.
export const compareDuration = (a: AllTasksRowVM, b: AllTasksRowVM): number => {
  const a1 = a.estimatedDuration
  const b1 = b.estimatedDuration
  if (a1 != null && b1 != null) return a1 - b1
  if (a1 != null) return -1
  if (b1 != null) return 1
  return 0
}
