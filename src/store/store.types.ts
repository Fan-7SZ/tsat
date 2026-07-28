import type { RunsSlice } from "./slices/runs.slice"
import type { PlannerSlice } from "./slices/planner.slice"
import type { AiSettingsSlice } from "./slices/ai-settings.slice"

// ── Boot slice ────────────────────────────────────────────
export type BootStatus =
  | "idle"
  | "loading"
  | "syncing"
  | "ready"
  | "error"

export interface BootSlice {
  bootStatus: BootStatus
  bootError?: string
}

// ── Full store type ───────────────────────────────────────
export type AppStore = RunsSlice & PlannerSlice & AiSettingsSlice & BootSlice
