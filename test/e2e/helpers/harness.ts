import type { Page } from "@playwright/test"

/** Simulated calendar start: local 2026-01-01 09:00. */
export const SIM_START = new Date(2026, 0, 1, 9, 0, 0)

/** Shape of the in-browser bridge (mirrors src/testing/bridge.ts). */
export interface AutoSnapshot {
  dateKey: string
  goals: Array<{ id: string; title: string; dueAt?: string; trigger?: unknown }>
  tasks: Array<{
    id: string
    goalId?: string
    title: string
    total: number
    completedCount: number
    allowCrossDay?: boolean
    repeat?: unknown
    trigger?: unknown
  }>
  dayRuns: Array<{
    id: string
    taskId: string
    arrangementStatus: "todo" | "inProgress" | "done"
    source: string
    dateKey: string
    plannedForDate?: string
    stepsCompleted?: string[]
  }>
  ledgers: Array<{
    taskId: string
    points: Record<string, "planned" | "completed" | "skipped">
  }>
  activities: Array<{ id: string; kind: string; taskId?: string }>
  goalTriggerStates: Array<{ goalId: string; lastTriggeredDateKey?: string }>
  taskTriggerStates: Array<{ taskId: string; lastTriggeredDateKey?: string }>
  manualFocuses: Array<{
    goalId: string
    dateKey: string
    source?: "manual" | "trigger"
  }>
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function bridge(page: Page) {
  return {
    whenReady: () => page.evaluate(() => (window as any).__auto.whenReady()),
    currentDateKey: () =>
      page.evaluate(() => (window as any).__auto.currentDateKey() as string),
    runDayBoundary: () =>
      page.evaluate(() => (window as any).__auto.runDayBoundary() as boolean),
    snapshot: () =>
      page.evaluate(() =>
        (window as any).__auto.snapshot()
      ) as Promise<AutoSnapshot>,
    handles: () => page.evaluate(() => (window as any).__auto.handles),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Time takeover WITHOUT Playwright's page.clock.
 *
 * page.clock replaces Date with a fake whose prototype is not fully spec-
 * compliant — date-fns' formatting calls `Date.prototype.toString` on it and
 * throws "incompatible receiver", crashing any page that formats a date
 * (e.g. MyGoals goal-due labels). Its full-fake-timer mode also starves React's
 * scheduler so click-driven updates never flush.
 *
 * Instead we inject a real `Date` subclass via addInitScript: argless
 * `new Date()` / `Date.now()` return the simulated instant (from
 * `window.__mockNow`), every other form and all prototype/static methods defer
 * to the genuine Date. instanceof, toString and date-fns all keep working, and
 * timers run on real wall-clock so the React scheduler is untouched.
 */
async function installMockClock(page: Page, startMs: number): Promise<void> {
  await page.addInitScript((initialMs: number) => {
    const w = window as unknown as { __mockNow: number }
    w.__mockNow = initialMs
    const RealDate = Date
    // mockdate-style wrapper: SHARES RealDate.prototype (identity preserved), so
    // every brand check — instanceof, Date.prototype.toString.call, date-fns'
    // constructFrom — keeps working. A distinct subclass prototype breaks those
    // and crashes any date-formatting render. Argless `new Date()` / `Date.now()`
    // return the simulated instant; every other form defers to the real Date.
    function MockDate(this: unknown, ...args: unknown[]) {
      if (!(this instanceof MockDate)) {
        return RealDate(...(args as []))
      }
      return args.length === 0
        ? new RealDate(w.__mockNow)
        : new (RealDate as unknown as new (...a: unknown[]) => Date)(...args)
    }
    MockDate.prototype = RealDate.prototype
    // Critical for Dexie: its `intrinsicTypes` Set is built from the global
    // `Date` at dexie load — which is MockDate (we override before dexie loads).
    // But IndexedDB deserializes stored dates with the native Date, so their
    // `.constructor` (via the shared prototype) must ALSO be MockDate, or Dexie's
    // deepClone fails the intrinsic check and clones Dates into broken
    // Object.create(Date.prototype) shells (no [[DateValue]]) that throw on
    // toString. Pointing the prototype's constructor at MockDate keeps them
    // recognized as intrinsic and passed through untouched.
    RealDate.prototype.constructor = MockDate as unknown as DateConstructor
    MockDate.now = () => w.__mockNow
    MockDate.parse = RealDate.parse
    MockDate.UTC = RealDate.UTC
    // @ts-expect-error override the global Date with the wrapper
    window.Date = MockDate
  }, startMs)
}

/** Boot the seeded auto env with the clock taken over, wait for readiness. */
export async function bootAuto(page: Page, reason = "e2e"): Promise<void> {
  await installMockClock(page, SIM_START.getTime())
  await page.goto(`/?auto=${encodeURIComponent(reason)}`)
  await page.waitForFunction(
    () => Boolean((window as unknown as { __auto?: unknown }).__auto),
    null,
    { timeout: 30_000 }
  )
  await bridge(page).whenReady()
  // App bootstrap has its own async replan; wait for the main layout to mount.
  await page.waitForSelector("body", { state: "attached" })
}

/** Advance the simulated clock to `nextDay` and run the cross-day pipeline. */
export async function advanceToDay(
  page: Page,
  nextDay: Date
): Promise<boolean> {
  await page.evaluate((ms) => {
    ;(window as unknown as { __mockNow: number }).__mockNow = ms
  }, nextDay.getTime())
  const swept = await bridge(page).runDayBoundary()
  // Let the liveQuery-driven UI re-render against the rebuilt plan.
  await page.waitForTimeout(50)
  return swept
}

/** Advance N whole days from a base date, keeping the 09:00 wall time. */
export function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

export const auto = bridge
