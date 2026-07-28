/**
 * Auto-test harness entry.
 *
 * Activated from main.tsx when the URL carries `?auto` (an optional value is a
 * free-text reason, logged only). It initializes a deterministic automated-test
 * environment BEFORE the app bootstraps:
 *
 *   1. open Dexie, wipe every table (clean slate, no cross-run bleed)
 *   2. clear web storage → sync provider + AI key gone (sync/AI disabled)
 *   3. re-seed the preset tag catalog, then inject the default scenario via the
 *      real command layer
 *   4. stamp runtimeValidUntil to end-of-today so the FIRST advanced day sweeps
 *   5. install `window.__auto` and mark the bridge ready
 *
 * Time is owned by Playwright's page.clock (installed before navigation), so all
 * `new Date()` below already resolves to the simulated start day.
 */
import { db, prepareTrackDb } from "@/persistence/db"
import * as repo from "@/persistence/repository"
import { useAppStore } from "@/store/app-store"
import { useSyncStore } from "@/store/sync-store"
import { endOfTodayISO } from "@/utils/date"
import { injectSeed } from "./seed"
import { buildDefaultScenario } from "./scenarios"
import { installAutoBridge, markAutoReady } from "./bridge"

const AUTO_PARAM = "auto"

/** Whether the current URL requests the automated-test environment. */
export function isAutoMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).has(AUTO_PARAM)
  } catch {
    return false
  }
}

async function wipeAllTables(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()))
}

function disableSync(): void {
  // Clearing web storage drops the persisted provider; null the live manager too
  // so no in-flight manager survives module import order.
  useSyncStore.getState().selectSyncProvider(null)
}

export async function runAutoHarness(): Promise<void> {
  const reason =
    new URLSearchParams(window.location.search).get(AUTO_PARAM) || "(none)"

  console.info(`[auto-harness] initializing auto-test env — reason: ${reason}`)

  await prepareTrackDb()

  // Fresh Playwright contexts start empty, but clear defensively so a re-run in
  // a persistent context (or a manual browser) still gets a clean slate.
  await wipeAllTables()
  try {
    localStorage.clear()
  } catch {
    /* ignore */
  }
  disableSync()

  // Preset tags must exist before pages / seed query them.
  await repo.ensureTagCatalogReady()

  const now = new Date()
  const handles = await injectSeed(buildDefaultScenario(now), now)

  // The store's default runtimeValidUntil was computed at module load (also the
  // start day), but stamp it explicitly so day 0 is unambiguous.
  useAppStore.setState({ runtimeValidUntil: endOfTodayISO() })

  // Plan today's list from the freshly seeded data.
  await useAppStore.getState().replan("full")

  installAutoBridge(handles)
  markAutoReady()

  console.info("[auto-harness] ready")
}
