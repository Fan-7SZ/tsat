import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"

// ── Tool names ────────────────────────────────────────────
export type AiToolName =
  | "fillDescription"
  | "decomposeTasks"
  | "optimizeDeps"
  | "refineSteps"

// ── Focus target ──────────────────────────────────────────
export type FocusTarget =
  | { kind: "auto" }
  | { kind: "all" }
  | { kind: "goal" }
  | { kind: "goalField"; field: "description" | "period" | "tasks" }
  | { kind: "task"; taskId: string }
  | {
      kind: "taskField"
      taskId: string
      field: "description" | "steps" | "schedule"
    }
  | { kind: "dependencies" }

// ── Draft types (same as AiAssistDialog) ──────────────────
export type AiGoalDraft = Pick<
  GoalEntity,
  "title" | "description" | "dueAt"
>

export type AiTaskDraft = Pick<
  TaskGroupEntity,
  | "id"
  | "title"
  | "description"
  | "steps"
  | "dueAt"
  | "estimatedDuration"
  | "repeat"
  | "trigger"
  | "total"
>

// ── Snapshot for undo ─────────────────────────────────────
export interface DraftSnapshot {
  goalDraft: AiGoalDraft
  taskDrafts: AiTaskDraft[]
  depTree: DependencyEntity | null
}

// ── Tool output schemas ───────────────────────────────────

export interface FillDescriptionResult {
  descriptions: Array<{
    /** "goal" or a taskId */
    target: string
    text: string
  }>
}

export interface DecomposeTasksResult {
  tasks: Array<{
    tempId: string
    title: string
    description?: string
    steps?: string[]
  }>
  dependencies: Array<{
    from: string
    to: string
  }>
}

export interface OptimizeDepsResult {
  dependencies: Array<{
    from: string
    to: string
  }>
}

export interface RefineStepsResult {
  refinements: Array<{
    /** taskId */
    target: string
    steps: string[]
  }>
}

export type ToolResult =
  | FillDescriptionResult
  | DecomposeTasksResult
  | OptimizeDepsResult
  | RefineStepsResult
