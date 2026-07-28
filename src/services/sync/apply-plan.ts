import {
  TABLES,
  recordsOfData,
  type SyncRecordData,
  type SyncTable,
} from "./merge-engine"
import type { RecordMetaMap } from "./types"

const TABLE_SET: ReadonlySet<string> = new Set(TABLES)

export interface ApplyMetaPut {
  key: string
  updatedAt: number
  deletedAt: number | null
}

/** Minimal per-record write set to converge the local DB onto a merge result. */
export interface ApplyPlan {
  puts: Record<SyncTable, unknown[]>
  deletes: Record<SyncTable, string[]>
  metaPuts: ApplyMetaPut[]
}

function emptyTableArrays<T>(): Record<SyncTable, T[]> {
  const out = {} as Record<SyncTable, T[]>
  for (const table of TABLES) out[table] = []
  return out
}

/**
 * Diff a merged snapshot against the *current* local record metadata and emit
 * the minimal per-record write set, instead of clear-and-rewrite. This is what
 * makes apply safe against the sync window race: a record the user wrote after
 * the sync's local snapshot was taken carries a newer local `updatedAt` than
 * the merged meta, so it is left untouched (it uploads next cycle).
 *
 * Per merged key `"<table>:<id>"`:
 * - local meta strictly newer than merged ⇒ skip (keep local record + meta);
 * - otherwise merged wins (tie ⇒ merged, matching the merge engine's
 *   tombstone-beats-live-at-tie semantics): tombstone ⇒ delete, live ⇒ put,
 *   and the merged meta is written verbatim (never re-stamped);
 * - live merged meta with no matching record ⇒ skipped defensively.
 *
 * Keys absent from the merged meta — e.g. records created locally while the
 * sync was in flight — are never touched.
 */
export function buildApplyPlan(
  mergedData: SyncRecordData,
  mergedMeta: RecordMetaMap,
  localMeta: RecordMetaMap
): ApplyPlan {
  const plan: ApplyPlan = {
    puts: emptyTableArrays(),
    deletes: emptyTableArrays(),
    metaPuts: [],
  }

  const recordsByTable = new Map<SyncTable, Map<string, unknown>>()
  for (const table of TABLES) {
    recordsByTable.set(table, recordsOfData(mergedData, table))
  }

  for (const [key, meta] of Object.entries(mergedMeta)) {
    // Ids may themselves contain ":" (activity ids do), so split on the first.
    const sep = key.indexOf(":")
    if (sep < 0) continue
    const table = key.slice(0, sep)
    if (!TABLE_SET.has(table)) continue
    const id = key.slice(sep + 1)

    const local = localMeta[key]
    if (local && local.updatedAt > meta.updatedAt) continue

    if (meta.deletedAt != null) {
      plan.deletes[table as SyncTable].push(id)
      plan.metaPuts.push({
        key,
        updatedAt: meta.updatedAt,
        deletedAt: meta.deletedAt,
      })
      continue
    }

    const record = recordsByTable.get(table as SyncTable)?.get(id)
    if (record === undefined) continue
    plan.puts[table as SyncTable].push(record)
    plan.metaPuts.push({ key, updatedAt: meta.updatedAt, deletedAt: null })
  }

  return plan
}
