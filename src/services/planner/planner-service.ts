import type { PlannerInput, PlannerOutput } from "./types"

/**
 * - `full`: cross-day / startup discovery — re-derives forced layer and runs the
 *   completion-based goal top-up from scratch.
 * - `partial`: task ops (toggle/skip) — reconcile derived state only, no fill.
 * - `focus`: a focus-set edit — set-diff: drop default todos of de-focused goals
 *   and fill newly-focused goals, without re-running the completion top-up.
 */
export type PlannerScope = "full" | "partial" | "focus"

export interface PlannerService {
  replan(input: PlannerInput, scope?: PlannerScope): PlannerOutput
}
