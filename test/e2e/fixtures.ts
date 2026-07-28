import fs from "node:fs"
import path from "node:path"
import { test as base, expect } from "@playwright/test"

/**
 * Shared e2e `test` that harvests istanbul coverage after each test.
 *
 * When the dev server runs with VITE_COVERAGE=true (see the vite-plugin-
 * istanbul entry in vite.config.ts), instrumented app code populates
 * `window.__coverage__`; the page-fixture teardown below dumps it to
 * coverage/e2e/<unique>.json for scripts/merge-coverage.mjs to pick up.
 * On an uninstrumented run `__coverage__` is absent and this is a no-op.
 *
 * Note: a mid-test page reload resets `__coverage__`, so only the coverage
 * accumulated since the last load is captured — an acceptable loss.
 */

const COVERAGE_DIR = path.join(process.cwd(), "coverage/e2e")

let fileSeq = 0

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page)

    let coverage: unknown = null
    try {
      coverage = await page.evaluate(
        () => (window as { __coverage__?: unknown }).__coverage__ ?? null
      )
    } catch {
      // Page already closed or crashed — losing this test's coverage is fine.
    }
    if (coverage) {
      fs.mkdirSync(COVERAGE_DIR, { recursive: true })
      const name = `${testInfo.workerIndex}-${Date.now()}-${fileSeq++}.json`
      fs.writeFileSync(path.join(COVERAGE_DIR, name), JSON.stringify(coverage))
    }
  },
})

export { expect }
