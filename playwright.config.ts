import { defineConfig, devices } from "@playwright/test"

/**
 * E2E config for the auto-test harness. A single worker drives one long
 * simulated timeline; the dev server is reused if already running.
 */
export default defineConfig({
  testDir: "./test/e2e",
  // CI gate (test:e2e:ci) skips the ~10-minute two-months simulation; specs
  // added later are included automatically. Local runs are unaffected.
  testIgnore: process.env.CI_SKIP_HEAVY ? "**/two-months.spec.ts" : [],
  fullyParallel: false,
  workers: 1,
  // One retry absorbs the rare mid-run page reload (which loses window.__auto);
  // the deterministic simulations reproduce identically on retry.
  retries: 1,
  timeout: 10 * 60 * 1000, // the two-month spec is one long test
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    // The app is a PWA (VitePWA autoUpdate); a service-worker update would
    // reload the page mid-run, and with `?auto` still in the URL that re-runs
    // the harness (wiping + reseeding Dexie), losing all simulation progress.
    // Block service workers so the timeline is deterministic.
    serviceWorkers: "block",
    trace: "retain-on-failure",
    // Real mouse movements/clicks are used throughout; keep the viewport stable
    // so boundingBox coordinates are deterministic.
    viewport: { width: 1400, height: 900 },
    headless: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
