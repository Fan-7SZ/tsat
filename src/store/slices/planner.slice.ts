import type { StateCreator } from "zustand"
import type { AppStore } from "../store.types"
import type { TaskRuntimeID } from "@/domain/value-objects/types"
import type {
  DayRunEntity,
  TaskRuntimeEntity,
} from "@/domain/entities/TaskRuntimeEntity"
import * as repo from "@/persistence/repository"
import { createPlannerService } from "@/services/planner/create-planner"
import type { PlannerScope } from "@/services/planner/planner-service"
import {
  readPolicyFromStorage,
  writePolicyToStorage,
} from "@/services/planner/policy-storage"
import type { PlannerPolicy } from "@/services/planner/types"
import { toLocalDateKey } from "@/utils/date"

//MARK: - State
export interface PlannerState {
  policy: PlannerPolicy
}
//MARK: - Actions
export interface PlannerActions {
  updatePolicy: (patch: Partial<PlannerPolicy>) => void
  replan: (scope?: PlannerScope) => Promise<void>
}

export type PlannerSlice = PlannerState & PlannerActions

const plannerService = createPlannerService()

/** Field-wise equality so unchanged derived rows don't churn recordMeta/sync. */
function areDayRunsEqual(a: DayRunEntity, b: DayRunEntity): boolean {
  const stepsA = a.stepsCompleted ?? []
  const stepsB = b.stepsCompleted ?? []
  return (
    a.taskId === b.taskId &&
    a.source === b.source &&
    a.arrangementStatus === b.arrangementStatus &&
    a.dateKey === b.dateKey &&
    (a.source === "repeatPolicy" ? a.plannedForDate : undefined) ===
      (b.source === "repeatPolicy" ? b.plannedForDate : undefined) &&
    stepsA.length === stepsB.length &&
    stepsA.every((step, index) => step === stepsB[index])
  )
}

export const createPlannerSlice: StateCreator<
  AppStore,
  [],
  [],
  PlannerSlice
> = (set, get) => ({
  policy: readPolicyFromStorage(),

  updatePolicy: (patch) => {
    const next = { ...get().policy, ...patch }
    set({ policy: next })
    writePolicyToStorage(next)
    void get().replan("partial")
  },

  replan: async (scope = "full") => {
    const state = get()
    const now = new Date()
    const todayKey = toLocalDateKey(now)

    // The whole replan — snapshot read, pure planner compute, run diff write —
    // runs inside ONE Dexie transaction (applyReplanAtomic). Overlapping
    // replans serialize on the transaction, so a stale-snapshot replan can
    // never commit over a newer one's output. Goal focus is derived at read
    // time (deriveGoalFocus), so the planner's goalFocus output is not
    // stored anywhere.
    await repo.applyReplanAtomic((snapshot, runRows) => {
      const currentTaskRuntime = Object.fromEntries(
        runRows.map((row) => [row.id, row])
      ) as Record<TaskRuntimeID, TaskRuntimeEntity>

      const output = plannerService.replan(
        {
          snapshot,
          currentTaskRuntime,
          policy: state.policy,
          now,
        },
        scope
      )

      // Diff-apply the planner's runtime map back to dayRuns: preserved rows
      // keep their dateKey (allow-cross-day carryovers), new rows are
      // materialized for today, and only actual changes are written.
      const currentById = new Map(runRows.map((row) => [row.id, row]))
      const putRuns: DayRunEntity[] = []
      for (const runtime of Object.values(output.taskRuntime)) {
        const existing = currentById.get(runtime.id)
        const next: DayRunEntity = {
          ...runtime,
          dateKey: existing?.dateKey ?? todayKey,
        }
        if (!existing || !areDayRunsEqual(existing, next)) {
          putRuns.push(next)
        }
      }
      const deleteRunIds = runRows
        .filter((row) => output.taskRuntime[row.id] == null)
        .map((row) => row.id)

      return { putRuns, deleteRunIds, result: undefined }
    })

    if (scope === "full") {
      // Cross-device "already full-replanned today" guard — a synced appMeta
      // scalar (record-level LWW), not a zustand field.
      await repo.putLastFullReplanDateKey(todayKey)
    }
  },
})
