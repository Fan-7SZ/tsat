/**
 * Merge vitest coverage (coverage/coverage-final.json, istanbul provider)
 * with Playwright e2e coverage dumps (coverage/e2e/*.json, written by
 * test/e2e/fixtures.ts when the dev server runs instrumented).
 *
 * The e2e dumps carry positions in vite-dev-transformed space plus each
 * file's inputSourceMap; istanbul-lib-source-maps (the same remap step nyc
 * runs at report time) brings them back to original-source positions, after
 * which istanbul's own merge lines both sides up exactly.
 *
 * Output:
 *  - terminal: total statement/branch coverage + per-src-subdirectory
 *    statement coverage
 *  - coverage/merged/coverage-final.json (merged istanbul map)
 *  - coverage/merged/html/ (if istanbul-lib-report/istanbul-reports resolve)
 */
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const libCoverage = require("istanbul-lib-coverage")

const sources = []

// vitest coverage, if present
const vitestMap = libCoverage.createCoverageMap({})
const vitestJson = path.join(root, "coverage/coverage-final.json")
if (fs.existsSync(vitestJson)) {
  vitestMap.merge(JSON.parse(fs.readFileSync(vitestJson, "utf8")))
  sources.push("vitest (coverage/coverage-final.json)")
}

// e2e dumps — same vite-plugin-istanbul instrumentation, so these merge exactly
const e2eMap = libCoverage.createCoverageMap({})
const e2eDir = path.join(root, "coverage/e2e")
let e2eCount = 0
if (fs.existsSync(e2eDir)) {
  for (const name of fs.readdirSync(e2eDir).filter((n) => n.endsWith(".json"))) {
    e2eMap.merge(JSON.parse(fs.readFileSync(path.join(e2eDir, name), "utf8")))
    e2eCount++
  }
}
if (e2eCount > 0) sources.push(`e2e (${e2eCount} dumps in coverage/e2e)`)

// Remap e2e positions back to original sources, then a plain istanbul merge.
const libSourceMaps = require("istanbul-lib-source-maps")
const remapResult = await libSourceMaps
  .createSourceMapStore()
  .transformCoverage(e2eMap)
// The remap leaves `Infinity` end columns in memory; the vitest report went
// through JSON (where Infinity becomes null). nyc's pipeline gets this same
// normalisation for free by writing to disk between steps — replicate it, or
// istanbul's location-keyed merge sees every range as distinct and doubles
// the denominator.
const e2eRemapped = JSON.parse(
  JSON.stringify((remapResult.map ?? remapResult).toJSON())
)

const map = libCoverage.createCoverageMap({})
map.merge(vitestMap)
map.merge(e2eRemapped)

if (sources.length === 0) {
  console.error(
    "No coverage inputs found. Run `npm run test:coverage` and/or `npm run test:e2e:coverage` first."
  )
  process.exit(1)
}

// Keep the denominator aligned with the vitest config: src/**/*.{ts,tsx} minus
// stories/testing fixtures.
const srcRoot = path.join(root, "src") + path.sep
map.filter((file) => {
  if (!file.startsWith(srcRoot)) return false
  const rel = path.relative(srcRoot, file)
  if (rel.startsWith("stories" + path.sep)) return false
  if (rel.startsWith("testing" + path.sep)) return false
  if (rel === "vite-env.d.ts") return false
  return true
})

// ---- terminal summary ----
const pct = (s) => `${s.pct === "Unknown" ? "n/a" : s.pct.toFixed(2) + "%"}`
const fmt = (s) => `${pct(s)} (${s.covered}/${s.total})`

const total = map.getCoverageSummary()
console.log(`Merged coverage from: ${sources.join(" + ")}`)
console.log(`  statements: ${fmt(total.statements)}`)
console.log(`  branches:   ${fmt(total.branches)}`)
console.log(`  functions:  ${fmt(total.functions)}`)
console.log(`  lines:      ${fmt(total.lines)}`)

// per top-level src subdirectory (statements)
const byDir = new Map()
for (const file of map.files()) {
  const rel = path.relative(srcRoot, file)
  const sep = rel.indexOf(path.sep)
  const dir = sep === -1 ? "(root)" : rel.slice(0, sep)
  const summary = map.fileCoverageFor(file).toSummary()
  const acc = byDir.get(dir)
  if (acc) acc.merge(summary)
  else byDir.set(dir, libCoverage.createCoverageSummary().merge(summary))
}
console.log("\nStatements by src/ subdirectory:")
const width = Math.max(...[...byDir.keys()].map((d) => d.length))
for (const [dir, summary] of [...byDir.entries()].sort()) {
  console.log(`  ${dir.padEnd(width)}  ${fmt(summary.statements)}`)
}

// ---- write merged json ----
const mergedDir = path.join(root, "coverage/merged")
fs.mkdirSync(mergedDir, { recursive: true })
fs.writeFileSync(
  path.join(mergedDir, "coverage-final.json"),
  JSON.stringify(map.toJSON())
)
console.log("\nWrote coverage/merged/coverage-final.json")

// ---- optional html + lcov reports ----
try {
  const libReport = require("istanbul-lib-report")
  const reports = require("istanbul-reports")
  const htmlContext = libReport.createContext({
    dir: path.join(mergedDir, "html"),
    coverageMap: map,
    defaultSummarizer: "nested",
  })
  reports.create("html").execute(htmlContext)
  const lcovContext = libReport.createContext({
    dir: mergedDir,
    coverageMap: map,
  })
  reports.create("lcovonly").execute(lcovContext)
  console.log("Wrote coverage/merged/html/index.html and coverage/merged/lcov.info")
} catch (err) {
  console.log(`Skipped html/lcov reports (${err.message})`)
}

// ---- threshold gate ----
// Hard floor for CI: fail the job when merged coverage drops below these.
// Calibrated ~2pts under the PR-pipeline numbers (vitest + e2e minus
// two-months). Ratchet upward only.
const THRESHOLDS = { statements: 73, branches: 63 }
const failures = []
for (const [metric, min] of Object.entries(THRESHOLDS)) {
  const pct = total[metric].pct
  if (typeof pct === "number" && pct < min) {
    failures.push(`${metric} ${pct.toFixed(2)}% < required ${min}%`)
  }
}
if (failures.length > 0) {
  console.error(`\nCoverage threshold not met:\n  ${failures.join("\n  ")}`)
  process.exit(1)
}
console.log(
  `\nThresholds met (statements ≥ ${THRESHOLDS.statements}%, branches ≥ ${THRESHOLDS.branches}%)`
)
