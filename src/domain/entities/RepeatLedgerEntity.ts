import type { TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

export type RepeatPointStatus = "planned" | "completed" | "skipped"

/**
 * Persisted repeat ledger: one record per repeat-mode task, with each planned
 * occurrence keyed by its dateKey. Status updates are incremental; existing
 * keys are preserved when the repeat rule changes. Debt is derived at read
 * time (status === "planned" AND dateKey < today).
 */
export interface RepeatLedgerEntity {
  taskId: TaskID
  points: Record<LocalDateKey, RepeatPointStatus>
}
