import type { AiSettings } from "@/store/slices/ai-settings.slice"
import type { Steps, TaskID } from "@/domain/value-objects/types"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import { estimateCount, executeTool } from "./ai"
import type {
  AiGoalDraft,
  AiTaskDraft,
  DecomposeTasksResult,
  DraftSnapshot,
  OptimizeDepsResult,
  RefineStepsResult,
} from "./ai-types"

// Scenario-scoped wrappers over the AI service. Each builds a minimal
// DraftSnapshot and calls a single tool directly (skipping the analyzer, since
// the tool is known), so the callers never deal with snapshots or focus targets.

function minimalGoal(title?: string): AiGoalDraft {
  return { title: title ?? "" }
}

// ── Steps autofill ────────────────────────────────────────

export interface StepAutofillTask {
  id: string
  title: string
  description?: string
  /** Current steps, for context (the result overwrites them). */
  steps?: Steps
  /** Owning goal's title, for context. */
  goalTitle?: string
}

function stepTaskDraft(task: StepAutofillTask): AiTaskDraft {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    steps: task.steps,
    dueAt: undefined,
    estimatedDuration: undefined,
    repeat: undefined,
    trigger: undefined,
    total: 1,
  }
}

/** Phase 1: how many checklist steps this task should have. */
export function estimateStepCount(
  settings: AiSettings,
  task: StepAutofillTask,
  locale?: string,
  signal?: AbortSignal
): Promise<number> {
  const system = `You are a project-planning assistant. Decide how many checklist steps a single task should be broken into. Return JSON: { "count": number }. Typically 3–10, never more than 15.`
  const user = `Task: "${task.title}"${
    task.description ? ` — ${task.description}` : ""
  }${task.goalTitle ? `\nGoal: "${task.goalTitle}"` : ""}\n\nHow many steps should it have?`
  return estimateCount(settings, system, user, signal, locale)
}

/** Phase 2: generate the actual step titles (overwrites existing steps). */
export async function generateTaskSteps(
  settings: AiSettings,
  task: StepAutofillTask,
  instruction: string,
  locale?: string,
  signal?: AbortSignal
): Promise<string[]> {
  const snapshot: DraftSnapshot = {
    goalDraft: minimalGoal(task.goalTitle),
    taskDrafts: [stepTaskDraft(task)],
    depTree: null,
  }
  const result = (await executeTool(
    settings,
    "refineSteps",
    instruction,
    snapshot,
    { kind: "taskField", taskId: task.id, field: "steps" },
    signal,
    locale
  )) as RefineStepsResult

  const refinement =
    result.refinements.find((r) => r.target === task.id) ??
    result.refinements[0]
  return (refinement?.steps ?? []).filter(
    (s) => typeof s === "string" && s.trim().length > 0
  )
}

// ── Task decomposition (append-only) ──────────────────────

export interface DecomposeGoalInput {
  title: string
  description?: string
  /** Titles of tasks already on the goal — AI avoids duplicating them. */
  existingTaskTitles?: string[]
}

function existingNote(titles?: string[]): string {
  if (!titles?.length) return ""
  const list = titles.map((t) => `"${t}"`).join(", ")
  return `\n\nThese tasks already exist — generate NEW, non-duplicate tasks to ADD alongside them: ${list}`
}

/** Phase 1: how many NEW tasks to add to the goal. */
export function estimateTaskCount(
  settings: AiSettings,
  goal: DecomposeGoalInput,
  instruction: string,
  locale?: string,
  signal?: AbortSignal
): Promise<number> {
  const system = `You are a project-planning assistant. Decide how many concrete tasks a goal should be broken into. Return JSON: { "count": number }. Typically 3–8, never more than 20.`
  const user = `Goal: "${goal.title}"${
    goal.description ? ` — ${goal.description}` : ""
  }${instruction ? `\nUser note: ${instruction}` : ""}${existingNote(
    goal.existingTaskTitles
  )}\n\nHow many NEW tasks should be added?`
  return estimateCount(settings, system, user, signal, locale)
}

/**
 * Phase 2: generate the NEW task titles to append. The snapshot has no tasks, so
 * decomposeTasks returns a fresh set (all new); existing titles go in the
 * instruction as "avoid duplicates" context.
 */
export async function decomposeGoalTasks(
  settings: AiSettings,
  goal: DecomposeGoalInput,
  instruction: string,
  locale?: string,
  signal?: AbortSignal,
  /** When set, ask for exactly this many tasks (targeted fill). */
  count?: number
): Promise<string[]> {
  const snapshot: DraftSnapshot = {
    goalDraft: { title: goal.title, description: goal.description },
    taskDrafts: [],
    depTree: null,
  }
  const countNote =
    count && count > 0
      ? `\n\nGenerate EXACTLY ${count} task${count > 1 ? "s" : ""}.`
      : ""
  const result = (await executeTool(
    settings,
    "decomposeTasks",
    instruction + existingNote(goal.existingTaskTitles) + countNote,
    snapshot,
    { kind: "goalField", field: "tasks" },
    signal,
    locale
  )) as DecomposeTasksResult

  return result.tasks
    .map((t) => t.title)
    .filter((title) => typeof title === "string" && title.trim().length > 0)
}

// ── Dependency optimization ───────────────────────────────

/**
 * Ask the AI to reorganize dependencies among the goal's EXISTING tasks. Returns
 * the complete edge list as { from, to } task-id pairs ("from" depends on "to").
 * No tasks are added or removed — only links between the given nodes change.
 */
export async function optimizeDependencies(
  settings: AiSettings,
  goalTitle: string,
  dependency: DependencyEntity,
  instruction: string,
  locale?: string,
  signal?: AbortSignal
): Promise<OptimizeDepsResult["dependencies"]> {
  const taskDrafts: AiTaskDraft[] = dependency.tree.map((node) => ({
    id: node.data as TaskID,
    title: node.title,
    description: undefined,
    steps: undefined,
    dueAt: undefined,
    estimatedDuration: undefined,
    repeat: undefined,
    trigger: undefined,
    total: 1,
  }))
  const snapshot: DraftSnapshot = {
    goalDraft: { title: goalTitle },
    taskDrafts,
    depTree: dependency,
  }
  const result = (await executeTool(
    settings,
    "optimizeDeps",
    instruction,
    snapshot,
    { kind: "dependencies" },
    signal,
    locale
  )) as OptimizeDepsResult

  return result.dependencies.filter(
    (d) => typeof d.from === "string" && typeof d.to === "string"
  )
}
