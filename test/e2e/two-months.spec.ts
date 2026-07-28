import { test, expect } from "./fixtures"
import {
  bootAuto,
  advanceToDay,
  addDays,
  auto,
  SIM_START,
} from "./helpers/harness"
import { taskAction, type TaskCtxAction } from "./helpers/actions"
import { checkInvariants } from "./model/invariants"
import { AnomalyLog } from "./helpers/anomaly"

/**
 * Two-month user-action simulation. Each simulated day we drive real user
 * actions through the pure-mouse right-click menus, then assert the structural
 * invariants (completedCount == authoritative source, etc.). Invariants are
 * action-independent, so they're a trustworthy oracle regardless of the random
 * action mix.
 */

const HORIZON = Number(process.env.E2E_DAYS ?? 60)

function pick(day: number, id: string, mod: number): number {
  let h = (day + 1) * 2654435761
  for (let i = 0; i < id.length; i++) h = (h ^ id.charCodeAt(i)) >>> 0
  return h % mod
}

interface EnrichedRun {
  runtimeId: string
  taskId: string
  title: string
  source: string
  isRepeat: boolean
  allowCrossDay: boolean
}

function decideAction(day: number, run: EnrichedRun): TaskCtxAction {
  if (run.allowCrossDay) {
    return pick(day, run.runtimeId, 3) === 0 ? "inprogress" : "done"
  }
  if (run.source === "repeatPolicy") {
    return pick(day, run.runtimeId, 7) === 0 ? "skip" : "done"
  }
  return "done"
}

test("two-month user-action simulation upholds every invariant", async ({
  page,
}) => {
  test.setTimeout(HORIZON * 12000 + 60000)
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

  // Every run id we've attempted, tracked GLOBALLY (not per-day). Run ids are
  // intrinsic and date-scoped (repeat: `taskId::date`; counter:
  // `taskId::run::date::N`), so this never blocks tomorrow's work — it only
  // guarantees we never act on the same id twice, which would otherwise race
  // (re-clicking a still-propagating completion) into an over-count.
  const actedIds = new Set<string>()
  let totalActions = 0
  const perDayActions: number[] = []
  let cur = SIM_START
  let lastDay = -1

  try {
    for (let day = 0; day < HORIZON; day++) {
      lastDay = day
      const todayKey = await auto(page).currentDateKey()

      // High-frequency daily driver: drain every actionable todo row on Home.
      // Completing a run replans, so we re-read the DOM each pass; rows that
      // reappear under a new id (a repeat group re-collapsing, a freshly
      // surfaced frontier task) still get driven.
      let dayActions = 0
      for (let guard = 0; guard < 150; guard++) {
        const rowIds: string[] = await page
          .locator('[data-testid^="task-"]')
          .evaluateAll((els) =>
            els.map((e) => (e.getAttribute("data-testid") ?? "").slice(5))
          )
        const rid = rowIds.find((id) => id && !actedIds.has(id))
        if (!rid) break
        actedIds.add(rid)
        const snap = await auto(page).snapshot()
        const run = snap.dayRuns.find((r) => r.id === rid)
        const task = run
          ? snap.tasks.find((t) => t.id === run.taskId)
          : undefined
        const isRepeat = !!task?.repeat
        const action = decideAction(day, {
          runtimeId: rid,
          taskId: run?.taskId ?? "",
          title: task?.title ?? "?",
          source: run?.source ?? "default",
          isRepeat,
          allowCrossDay: !!task?.allowCrossDay,
        })
        try {
          await taskAction(page, rid, action)
          totalActions++
          dayActions++
          // Wait for the completion to settle (run leaves todo) before reading
          // the DOM again. Without this, a still-in-flight replan can leave a
          // transient duplicate row that gets re-clicked, over-counting
          // completedCount by one — a race in the automation, not the app (the
          // clean single-action-per-day repro never diverges).
          await expect
            .poll(
              async () => {
                const s = await auto(page).snapshot()
                const r = s.dayRuns.find((x) => x.id === rid)
                return !r || r.arrangementStatus !== "todo"
              },
              { timeout: 5000 }
            )
            .toBe(true)
        } catch (e) {
          // Several runs of the same task legitimately collapse into ONE row
          // (e.g. a repeat's debt points). If the row we picked is simply gone by
          // the time we act — collapsed away or re-rendered — that is expected UI
          // behaviour, not an anomaly; the remaining runs surface under the
          // collapsed row and get driven on later passes.
          const stillThere = await page
            .locator(`[data-testid="task-${rid}"]`)
            .count()
          if (stillThere > 0) {
            log.record({
              day,
              dateKey: todayKey,
              kind: "action-failed",
              detail: `${action} on ${task?.title ?? rid}: ${(e as Error).message.split("\n")[0]}`,
            })
          }
        }
      }
      perDayActions.push(dayActions)

      const afterSnap = await auto(page).snapshot()
      log.recordMany(
        day,
        todayKey,
        "invariant",
        checkInvariants(afterSnap).map((v) => `${v.rule}: ${v.detail}`)
      )

      cur = addDays(cur, 1)
      await advanceToDay(page, cur)
    }
  } catch (e) {
    log.record({
      day: lastDay,
      dateKey: "?",
      kind: "fatal",
      detail: (e as Error).message.split("\n")[0],
    })
  }

  const file = log.flush(`two-months-${HORIZON}d`)
  const activeDays = perDayActions.filter((n) => n > 0).length
  const avgPerActiveDay =
    activeDays > 0 ? (totalActions / activeDays).toFixed(1) : "0"

  console.log(
    `\n=== ${HORIZON}-day sim: ${totalActions} actions over ${activeDays} active days ` +
      `(avg ${avgPerActiveDay}/active day), ${log.count} anomalies -> ${file} ===`
  )
  for (const a of log.all().slice(0, 25)) {
    console.log(`  [d${a.day} ${a.dateKey}] ${a.kind}: ${a.detail}`)
  }

  // Coverage: the high-frequency driver drains today's list every day, so over
  // two months it performs many actions across most days (roughly one per
  // surfaced run — daily-repeat point, debt, frontier/counter/trigger task).
  expect(
    totalActions,
    "meaningful action volume over two months"
  ).toBeGreaterThan(HORIZON)
  expect(activeDays, "most days saw user activity").toBeGreaterThan(HORIZON / 2)
  expect(log.count, `anomalies recorded in ${file}`).toBe(0)
})
