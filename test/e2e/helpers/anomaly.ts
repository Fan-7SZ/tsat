import fs from "node:fs"
import path from "node:path"

/**
 * Anomaly recorder. Mismatches between observed and expected state are appended
 * here (not thrown) so a long simulation collects every deviation; the spec
 * asserts the count is zero at the end and the JSON files drive root-causing.
 */

const DIR = path.join(process.cwd(), "test/e2e/anomalies")

export interface Anomaly {
  day: number
  dateKey: string
  kind: string
  detail: string
  context?: unknown
}

export class AnomalyLog {
  private items: Anomaly[] = []

  record(a: Anomaly): void {
    this.items.push(a)
  }

  recordMany(
    day: number,
    dateKey: string,
    kind: string,
    details: string[]
  ): void {
    for (const detail of details) this.record({ day, dateKey, kind, detail })
  }

  get count(): number {
    return this.items.length
  }

  all(): readonly Anomaly[] {
    return this.items
  }

  /** Persist the full log + a summary grouped by kind/rule. */
  flush(runLabel: string): string {
    fs.mkdirSync(DIR, { recursive: true })
    const file = path.join(DIR, `${runLabel}.json`)
    const byKind: Record<string, number> = {}
    for (const a of this.items) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1
    fs.writeFileSync(
      file,
      JSON.stringify(
        { runLabel, total: this.items.length, byKind, anomalies: this.items },
        null,
        2
      )
    )
    return file
  }
}
