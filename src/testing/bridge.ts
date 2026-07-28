/**
 * `window.__auto` — the in-browser bridge the Playwright test drives.
 *
 * The test controls the calendar from the Node side (page.clock.setFixedTime),
 * then calls `runDayBoundary()` here so the cross-day sweep pipeline settles
 * deterministically and awaitably (App.tsx's midnight setTimeout is fire-and-
 * forget and not test-observable). `snapshot()` returns the authoritative Dexie
 * state so the test's parallel expectation model can diff it each day.
 */
import * as repo from "@/persistence/repository"
import { refreshRuntimeNow, useAppStore } from "@/store/app-store"
import { toLocalDateKey } from "@/utils/date"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { SeedHandles } from "./seed"

export interface AutoSnapshot {
  dateKey: string
  goals: GoalEntity[]
  tasks: TaskGroupEntity[]
  dayRuns: DayRunEntity[]
  ledgers: RepeatLedgerEntity[]
  activities: ActivityEntity[]
  goalTriggerStates: Array<{ goalId: string; lastTriggeredDateKey?: string }>
  taskTriggerStates: Array<{ taskId: string; lastTriggeredDateKey?: string }>
  /** Day-scoped focus rows, incl. who placed them (user vs goal trigger). */
  manualFocuses: Array<{
    goalId: string
    dateKey: string
    source?: "manual" | "trigger"
  }>
}

export interface AutoBridge {
  /** Resolves once seed injection + first bootstrap replan have completed. */
  whenReady(): Promise<void>
  /** The simulated "today" (mocked-clock local date key). */
  currentDateKey(): string
  /** Run the cross-day sweep pipeline; returns whether a sweep happened. */
  runDayBoundary(): Promise<boolean>
  /** Force a replan (mostly for debugging / intent flushes). */
  replan(scope?: "full" | "partial"): Promise<void>
  /** Authoritative Dexie state for the expectation model to diff. */
  snapshot(): Promise<AutoSnapshot>
  /** Seed handle → generated id maps. */
  handles: SeedHandles
}

let readyResolve: () => void
const readyPromise = new Promise<void>((resolve) => {
  readyResolve = resolve
})

export function markAutoReady(): void {
  readyResolve()
}

async function snapshot(): Promise<AutoSnapshot> {
  const snap = await repo.queryEntitySnapshot()
  const [dayRuns, ledgers, activities] = await Promise.all([
    repo.queryDayRuns(),
    repo.queryAllRepeatLedgers(),
    repo.queryAllActivities(),
  ])

  return {
    dateKey: toLocalDateKey(new Date()),
    goals: Object.values(snap.goals),
    tasks: Object.values(snap.tasks),
    dayRuns,
    ledgers,
    activities,
    goalTriggerStates: Object.values(snap.goalTriggerStates).map((s) => ({
      goalId: s.goalId,
      lastTriggeredDateKey: s.lastTriggeredDateKey,
    })),
    taskTriggerStates: Object.values(snap.taskTriggerStates).map((s) => ({
      taskId: s.taskId,
      lastTriggeredDateKey: s.lastTriggeredDateKey,
    })),
    manualFocuses: Object.values(snap.manualFocuses).map((f) => ({
      goalId: f.goalId,
      dateKey: f.dateKey,
      source: f.source,
    })),
  }
}

export function installAutoBridge(handles: SeedHandles): void {
  const bridge: AutoBridge = {
    whenReady: () => readyPromise,
    currentDateKey: () => toLocalDateKey(new Date()),
    runDayBoundary: () => refreshRuntimeNow(),
    replan: (scope) => useAppStore.getState().replan(scope ?? "partial"),
    snapshot,
    handles,
  }
  ;(window as unknown as { __auto: AutoBridge }).__auto = bridge
}
