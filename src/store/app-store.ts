import { create } from "zustand"
import { persist } from "zustand/middleware"
import { prepareTrackDb } from "@/persistence/db"
import { createRunsSlice } from "./slices/runs.slice"
import { createPlannerSlice } from "./slices/planner.slice"
import { createAiSettingsSlice } from "./slices/ai-settings.slice"
import { useSyncStore } from "./sync-store"
import { type AppStore, type BootStatus } from "./store.types"
import * as repo from "@/persistence/repository"
import {
  endOfLocalDay,
  endOfLocalDateKey,
  endOfTodayISO,
  parseDateKey,
  toLocalDateKey,
} from "@/utils/date"
import {
  getNextTriggerDateKeyAfter,
  getPendingTaskTriggerDateKey,
  getPendingTriggerDateKey,
} from "@/utils/trigger-evaluation"
import { selectCrossDayCarryOver } from "@/utils/cross-day-sweep"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

export type { AppStore, BootStatus } from "./store.types"

export const useAppStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createRunsSlice(...a),
      ...createPlannerSlice(...a),
      ...createAiSettingsSlice(...a),
      // Boot slice initial state
      bootStatus: "idle" as BootStatus,
      bootError: undefined as string | undefined,
    }),
    {
      name: "track-runtime",
      // v2: only the device-local day marker remains — everything else lives
      // in Dexie (dayRuns / appMeta) or is derived. The migrate strips every
      // legacy key from older persisted blobs.
      version: 2,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        return { runtimeValidUntil: p.runtimeValidUntil } as never
      },
      partialize: (state) => ({
        runtimeValidUntil: state.runtimeValidUntil,
      }),
    }
  )
)

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ])
}

async function tryQuickSyncPull(timeoutMs: number) {
  const { syncManager } = useSyncStore.getState()
  if (!syncManager) return
  if (typeof navigator !== "undefined" && navigator.onLine === false) return
  // Bootstrap must only do the "get access token + pull data" flow, never the
  // authorization flow: connect() triggers interactive OAuth when unbound, which
  // — under a full-page redirect (e.g. popup blocked) — re-enters bootstrap on
  // the /auth/callback page and loops forever. A bound provider boots as
  // "connected" and syncNow() refreshes the token silently via getAccessToken().
  if (syncManager.getConnectionStatus() !== "connected") return
  try {
    // A pull will actually run now: surface it as "syncing" on the boot screen
    // (the caller reverts to "loading" for the remaining replan work).
    useAppStore.setState({ bootStatus: "syncing" })
    await withTimeout(syncManager.syncNow(), timeoutMs)
  } catch (e) {
    console.warn("[bootstrap] sync pull failed or timed out", e)
  }
}

export async function runTriggerResetIfNeeded(now: Date): Promise<boolean> {
  try {
    const snapshot = await repo.queryEntitySnapshot()
    // Read once before any state mutation: task-trigger evaluation
    // (allowCrossDay) inspects the current runtime entries.
    const currentTaskRuntime = Object.fromEntries(
      (await repo.queryDayRuns()).map((row) => [row.id, row])
    )

    // Task ids are collected only for the dayRuns cleanup; the reset itself
    // re-derives the goal's tasks inside the transaction.
    const resetTaskIds = new Set<TaskID>()
    const triggerResets: Array<{
      goalId: GoalID
      dueAt: Date | undefined
      lastTriggeredDateKey: LocalDateKey
    }> = []

    for (const goal of Object.values(snapshot.goals)) {
      if (goal.trigger == null) {
        continue
      }

      const pendingDateKey = getPendingTriggerDateKey({
        goal,
        lastTriggeredDateKey:
          snapshot.goalTriggerStates[goal.id]?.lastTriggeredDateKey,
        now,
      })
      if (!pendingDateKey) {
        continue
      }

      Object.values(snapshot.tasks)
        .filter((task) => task.goalId === goal.id)
        .forEach((task) => resetTaskIds.add(task.id))
      // The reset also resets the goal's tasks. When the trigger opts into a
      // due date, this round is due 23:59 the day before the next fire (a
      // daily trigger is due the same evening); a one-shot rule with no next
      // fire falls back to the fire day itself. Otherwise any due left by an
      // earlier reset is cleared.
      let dueAt: Date | undefined
      if (goal.trigger.setDueOnReset ?? true) {
        const nextFireDateKey = getNextTriggerDateKeyAfter({
          rule: goal.trigger.rule,
          anchor: goal.createdAt,
          afterDateKey: pendingDateKey,
        })
        if (nextFireDateKey) {
          const dayBeforeNextFire = parseDateKey(nextFireDateKey)
          dayBeforeNextFire.setDate(dayBeforeNextFire.getDate() - 1)
          dueAt = endOfLocalDay(dayBeforeNextFire)
        } else {
          dueAt = endOfLocalDateKey(pendingDateKey)
        }
      }
      triggerResets.push({
        goalId: goal.id,
        dueAt,
        lastTriggeredDateKey: pendingDateKey,
      })
    }

    const taskTriggerResets: Array<{
      taskId: TaskID
      lastTriggeredDateKey: LocalDateKey
    }> = []

    for (const task of Object.values(snapshot.tasks)) {
      if (task.trigger == null) {
        continue
      }

      const pendingDateKey = getPendingTaskTriggerDateKey({
        task,
        lastTriggeredDateKey:
          snapshot.taskTriggerStates[task.id]?.lastTriggeredDateKey,
        taskRuntime: currentTaskRuntime,
        now,
      })
      if (!pendingDateKey) {
        continue
      }

      resetTaskIds.add(task.id)
      taskTriggerResets.push({
        taskId: task.id,
        lastTriggeredDateKey: pendingDateKey,
      })
    }

    if (triggerResets.length === 0 && taskTriggerResets.length === 0) {
      return false
    }

    // Goal resets, task resets and the stale-run deletion (so the next replan
    // re-creates runs under the new dueAt) commit as one transaction.
    await repo.applyDailyTriggerResetsAtomic({
      goalResets: triggerResets,
      taskResets: taskTriggerResets,
      resetTaskIds: [...resetTaskIds],
    })

    return true
  } catch (error) {
    console.error("[trigger] Failed to run startup reset", error)
    return false
  }
}

/**
 * Cross-day sweep: instead of wiping all runtime, keep only the runtimes of
 * tasks that opted into cross-day carry-over AND are currently in progress, plus
 * the goal runtimes those tasks belong to. Everything else is dropped so the
 * scheduler can rebuild today's plan from scratch.
 */
async function sweepDayBoundary() {
  const { setState } = useAppStore

  const tasks = await repo.queryAllTasks()
  const runRows = await repo.queryDayRuns()
  const { taskRuntime: keptRuns, keptGoalIds } = selectCrossDayCarryOver({
    tasks,
    taskRuntime: Object.fromEntries(runRows.map((row) => [row.id, row])),
  })

  const todayKey = toLocalDateKey(new Date())

  // One atomic day-boundary reset: intent tables (manual focus kept only for
  // goals with carry-over runs, dismissals cleared — tombstoned so it
  // propagates) and run rows (carry-overs re-dated to today, the rest dropped)
  // commit together. Goal focus itself is derived, nothing to sweep.
  await repo.sweepDayBoundaryAtomic(
    keptGoalIds,
    new Set(Object.keys(keptRuns) as TaskRuntimeID[]),
    todayKey
  )

  setState({ runtimeValidUntil: endOfTodayISO() })
}

async function expireRuntimeIfNeeded() {
  const { getState } = useAppStore
  const now = new Date()
  const validUntil = new Date(getState().runtimeValidUntil)
  let expired = false

  if (now > validUntil) {
    await sweepDayBoundary()
    expired = true
  }

  return expired
}

// ── Runtime expiration check ──────────────────────────────
/**
 * Awaitable day-boundary refresh: sweep expired runtime, run trigger resets,
 * then full-replan. Returns whether a sweep actually happened. `ensureRuntimeFresh`
 * is the fire-and-forget wrapper the app uses; tests await this directly so the
 * cross-day pipeline settles deterministically after the mocked clock advances.
 */
export async function refreshRuntimeNow(): Promise<boolean> {
  if (await expireRuntimeIfNeeded()) {
    await runTriggerResetIfNeeded(new Date())
    await useAppStore.getState().replan("full")
    return true
  }
  return false
}

export function ensureRuntimeFresh() {
  void refreshRuntimeNow()
}

// ── Bootstrap: call once at app startup ───────────────────
let bootstrapPromise: Promise<void> | null = null

/**
 * Idempotent: repeat calls share the first run's promise. React StrictMode
 * re-runs the boot effect in dev with the same "idle" snapshot, so without
 * this guard two bootstrap flows race — the second skips the (occupied) sync
 * pull and reaches "ready" early, then the first one's timeout path yanks
 * bootStatus back to "loading", unmounting the whole app mid-use.
 */
function bootstrapStore(): Promise<void> {
  bootstrapPromise ??= runBootstrap()
  return bootstrapPromise
}

/**
 * Route-loader entry: awaits bootstrap and converts the state-reported failure
 * (runBootstrap never throws) into a thrown error so the router's ErrorBoundary
 * renders the load-failure screen.
 */
export async function awaitBootReady(): Promise<void> {
  await bootstrapStore()
  const { bootStatus, bootError } = useAppStore.getState()
  if (bootStatus === "error") {
    throw new Error(bootError ?? "bootstrap failed")
  }
}

async function runBootstrap() {
  //Not in react context, so directly use getState and setState
  const { setState, getState } = useAppStore

  // Mark loading
  setState({ bootStatus: "loading" })

  try {
    // 1. Prepare the current Dexie schema.
    await prepareTrackDb()

    // 2. Ensure tag catalog is persisted in Dexie before pages query it.
    await repo.ensureTagCatalogReady()

    // 3. Try to pull remote runtime first so another device's full replan
    //    can be respected (no need to redo step 6 on this device).
    //    Skipped silently if no sync provider, offline, or timeout.
    // Cap, not duration: with the persisted read cache (Dexie syncReadCache),
    // a boot pull whose remote files are unchanged is one folder listing plus
    // at most a token refresh — well under this cap. On a slow network the pull
    // gives up here, boot proceeds from local data, and background sync catches up.
    await tryQuickSyncPull(3000)
    // Sync phase (if any) done; back to generic loading for the remaining work.
    setState({ bootStatus: "loading" })

    // 4. Sweep expired runtime (runtimeValidUntil may have been updated by
    //    sync pull above, so this check sees the freshest value).
    const expired = await expireRuntimeIfNeeded()

    // 5. Run daily trigger resets before planning consumes today's state.
    await runTriggerResetIfNeeded(new Date())

    // 6. Decide replan scope: only do "full" when this device's runtime
    //    was actually expired AND no other device has full-replanned today.
    const todayKey = toLocalDateKey(new Date())
    const alreadyFullReplanned =
      (await repo.queryLastFullReplanDateKey()) === todayKey
    const scope = expired && !alreadyFullReplanned ? "full" : "partial"
    await getState().replan(scope)

    setState({ bootStatus: "ready" })
  } catch (err) {
    console.error("[bootstrap] Failed to load from Dexie:", err)
    setState({
      bootStatus: "error",
      bootError: err instanceof Error ? err.message : String(err),
    })
  }
}
