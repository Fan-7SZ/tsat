import { test, expect } from "./fixtures"
import {
  bootAuto,
  advanceToDay,
  addDays,
  auto,
  SIM_START,
} from "./helpers/harness"
import { checkInvariants } from "./model/invariants"
import { AnomalyLog } from "./helpers/anomaly"

/**
 * Natural-scheduler oracle: advance the calendar with NO user actions and assert
 * the scheduler's own output matches the (verified) semantics over two months:
 *
 *   - task trigger "review" (daily interval 3) fires on days 0,3,6,… (its
 *     lastTriggeredDateKey equals today on those days)
 *   - goal trigger "checkup" (weekly Mondays) fires each Monday
 *   - weekly repeat "class" (Mon/Wed/Fri) materializes a ledger point on each
 *     scheduled day
 *   - the daily-repeat debt set only grows (past planned points never silently
 *     vanish without an explicit done/skip)
 *   - structural invariants hold every single day
 */

const HORIZON = Number(process.env.E2E_DAYS ?? 60)

test("natural scheduling over two months matches expected semantics", async ({
  page,
}) => {
  test.setTimeout(HORIZON * 6000 + 60000)
  const log = new AnomalyLog()
  page.on("pageerror", (e) =>
    log.record({
      day: -1,
      dateKey: "?",
      kind: "pageerror",
      detail: e.message.split("\n")[0],
    })
  )
  await bootAuto(page)
  const h = await auto(page).handles()
  const reviewId = h.tasks["study.review"]
  const checkupId = h.goals["checkup"]
  const classId = h.tasks["study.class"]
  const dailyId = h.tasks["reading.daily"]

  let prevDebt = 0

  for (let day = 0; day < HORIZON; day++) {
    const date = addDays(SIM_START, day)
    const dow = date.getDay()
    const todayKey = await auto(page).currentDateKey()
    const snap = await auto(page).snapshot()

    // Invariants always hold.
    log.recordMany(
      day,
      todayKey,
      "invariant",
      checkInvariants(snap).map((v) => `${v.rule}: ${v.detail}`)
    )

    // Task trigger fires every 3rd day from the start.
    if (day % 3 === 0) {
      const st = snap.taskTriggerStates.find((s) => s.taskId === reviewId)
      if (st?.lastTriggeredDateKey !== todayKey) {
        log.record({
          day,
          dateKey: todayKey,
          kind: "review-trigger-cadence",
          detail: `expected review fired today; lastTriggered=${st?.lastTriggeredDateKey}`,
        })
      }
    }

    // Goal trigger fires each Monday (first fire on the first Monday).
    if (dow === 1) {
      const st = snap.goalTriggerStates.find((s) => s.goalId === checkupId)
      if (st?.lastTriggeredDateKey !== todayKey) {
        log.record({
          day,
          dateKey: todayKey,
          kind: "checkup-trigger-monday",
          detail: `expected checkup goal fired on Monday; lastTriggered=${st?.lastTriggeredDateKey}`,
        })
      }
    }

    // Weekly repeat materializes a ledger point on Mon/Wed/Fri, but only within
    // the repeat window (scenario: class endsAt = start + 55 days).
    const withinClassWindow = day <= 55
    if ((dow === 1 || dow === 3 || dow === 5) && withinClassWindow) {
      const ledger = snap.ledgers.find((l) => l.taskId === classId)
      if (ledger && !(todayKey in ledger.points)) {
        log.record({
          day,
          dateKey: todayKey,
          kind: "class-weekly-point-missing",
          detail: `no class ledger point for scheduled ${todayKey}`,
        })
      }
    }

    // Debt (past planned points) for the daily repeat only grows with no actions.
    const ledger = snap.ledgers.find((l) => l.taskId === dailyId)
    const debt = ledger
      ? Object.entries(ledger.points).filter(
          ([k, s]) => k < todayKey && s === "planned"
        ).length
      : 0
    if (debt < prevDebt) {
      log.record({
        day,
        dateKey: todayKey,
        kind: "debt-regressed",
        detail: `debt dropped from ${prevDebt} to ${debt} with no user action`,
      })
    }
    prevDebt = debt

    await advanceToDay(page, addDays(SIM_START, day + 1))
  }

  const file = log.flush(`natural-${HORIZON}d`)

  console.log(
    `\n=== natural ${HORIZON}-day: ${log.count} anomalies -> ${file} ===`
  )
  for (const a of log.all().slice(0, 25)) {
    console.log(`  [d${a.day} ${a.dateKey}] ${a.kind}: ${a.detail}`)
  }
  expect(log.count, `anomalies recorded in ${file}`).toBe(0)
})
