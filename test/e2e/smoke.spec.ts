import { test, expect } from "./fixtures"
import {
  bootAuto,
  advanceToDay,
  addDays,
  auto,
  SIM_START,
} from "./helpers/harness"

/**
 * Phase-1 smoke test: proves the harness chain works end to end —
 * seed injection, the `window.__auto` bridge, and a deterministic day sweep.
 */
test("auto harness seeds data and exposes the bridge", async ({ page }) => {
  await bootAuto(page)

  const snap = await auto(page).snapshot()

  // Start day is the simulated one.
  expect(snap.dateKey).toBe("2026-01-01")

  // All five seeded goals exist.
  expect(snap.goals.length).toBe(5)
  const titles = snap.goals.map((g) => g.title).sort()
  expect(titles).toContain("健身计划")
  expect(titles).toContain("阅读习惯")

  // Tasks were created (9 across all goals).
  expect(snap.tasks.length).toBeGreaterThanOrEqual(8)

  // The daily-repeat task opened its window 5 days before start → its ledger
  // carries overdue "planned" points (debt) with dateKey < today.
  const dailyLedger = snap.ledgers.find((l) =>
    Object.keys(l.points).some((k) => k < "2026-01-01")
  )
  expect(dailyLedger, "daily repeat ledger with past points").toBeTruthy()
  const overduePoints = Object.entries(dailyLedger!.points).filter(
    ([k, v]) => k < "2026-01-01" && v === "planned"
  )
  expect(overduePoints.length).toBeGreaterThan(0)

  // Today's plan produced runs.
  expect(snap.dayRuns.length).toBeGreaterThan(0)
})

test("advancing a day runs the cross-day sweep", async ({ page }) => {
  await bootAuto(page)

  const before = await auto(page).currentDateKey()
  expect(before).toBe("2026-01-01")

  const swept = await advanceToDay(page, addDays(SIM_START, 1))
  expect(swept, "a sweep happened crossing midnight").toBe(true)

  const after = await auto(page).currentDateKey()
  expect(after).toBe("2026-01-02")
})
