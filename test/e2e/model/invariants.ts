import type { AutoSnapshot } from "../helpers/harness"

/**
 * Structural invariants that must hold on EVERY simulated day regardless of what
 * the user did. These are the machine-checkable "user expectations" — violations
 * are recorded as anomalies rather than thrown, so a two-month run collects the
 * full picture instead of dying on the first hiccup.
 */

export interface Violation {
  rule: string
  detail: string
}

/** completedCount must equal the authoritative completion source. */
function checkCompletedCountInvariant(snap: AutoSnapshot): Violation[] {
  const v: Violation[] = []
  // Goals whose trigger resets their tasks each fire.
  const triggeredGoalIds = new Set(
    snap.goals.filter((g) => g.trigger).map((g) => g.id)
  )
  for (const task of snap.tasks) {
    // Reset-driven tasks track per-cycle progress, while task-done activities
    // are the cumulative history — so the two legitimately diverge after a
    // reset. Skip tasks that carry a trigger themselves or
    // belong to a triggered goal; strict cumulative equality only holds for
    // non-resetting tasks.
    if (task.trigger || (task.goalId && triggeredGoalIds.has(task.goalId))) {
      continue
    }

    const doneActs = snap.activities.filter(
      (a) => a.taskId === task.id && a.kind === "task-done"
    ).length

    if (task.repeat) {
      const ledger = snap.ledgers.find((l) => l.taskId === task.id)
      const completedPts = ledger
        ? Object.values(ledger.points).filter((p) => p === "completed").length
        : 0
      // Strict equality: a repeat task's completedCount is exactly its
      // completed-ledger-point count. (A3 — due-policy pulling repeat tasks in
      // and desyncing this — is fixed in the planner, so this holds again.)
      if (task.completedCount !== completedPts) {
        v.push({
          rule: "repeat-completedCount==ledger-completed-points",
          detail: `task ${task.title} (${task.id.slice(0, 8)}): completedCount=${task.completedCount} but ledger has ${completedPts} completed points`,
        })
      }
    } else if (task.completedCount !== doneActs) {
      v.push({
        rule: "completedCount==task-done-activities",
        detail: `task ${task.title} (${task.id.slice(0, 8)}): completedCount=${task.completedCount} but ${doneActs} task-done activities`,
      })
    }
  }
  return v
}

/** completedCount can never exceed total. */
function checkCompletedNotOverTotal(snap: AutoSnapshot): Violation[] {
  const v: Violation[] = []
  for (const task of snap.tasks) {
    // Repeat tasks track occurrences via the ledger, not `total`, so skip them.
    if (task.repeat) continue
    if (task.completedCount > task.total) {
      v.push({
        rule: "completedCount<=total",
        detail: `task ${task.title}: completedCount=${task.completedCount} > total=${task.total}`,
      })
    }
  }
  return v
}

/** Every day-run points at a task that still exists. */
function checkRunsReferenceLiveTasks(snap: AutoSnapshot): Violation[] {
  const v: Violation[] = []
  const taskIds = new Set(snap.tasks.map((t) => t.id))
  for (const run of snap.dayRuns) {
    if (!taskIds.has(run.taskId)) {
      v.push({
        rule: "run-references-live-task",
        detail: `run ${run.id} references missing task ${run.taskId.slice(0, 8)}`,
      })
    }
  }
  return v
}

/** A completed ledger point must never regress to planned without an action. */
export function checkInvariants(snap: AutoSnapshot): Violation[] {
  return [
    ...checkCompletedCountInvariant(snap),
    ...checkCompletedNotOverTotal(snap),
    ...checkRunsReferenceLiveTasks(snap),
  ]
}

/** Overdue planned points (debt): planned points whose date is before today. */
export function debtPoints(
  snap: AutoSnapshot,
  taskId: string,
  todayKey: string
): string[] {
  const ledger = snap.ledgers.find((l) => l.taskId === taskId)
  if (!ledger) return []
  return Object.entries(ledger.points)
    .filter(([k, s]) => k < todayKey && s === "planned")
    .map(([k]) => k)
}
