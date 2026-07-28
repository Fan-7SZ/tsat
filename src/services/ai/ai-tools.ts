import { z } from "zod"
import type {
  AiGoalDraft,
  AiTaskDraft,
  AiToolName,
  DraftSnapshot,
  FocusTarget,
} from "./ai-types"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"

// ── Context helpers ───────────────────────────────────────

function goalContext(g: AiGoalDraft): string {
  return [
    `Goal: "${g.title}"`,
    g.description ? `Description: ${g.description}` : null,
    g.dueAt ? `Due: ${g.dueAt.toISOString()}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

function taskContext(t: AiTaskDraft): string {
  return [
    `Task [${t.id}]: "${t.title}"`,
    t.description ? `  Description: ${t.description}` : null,
    t.steps?.length
      ? `  Steps: ${t.steps.map((s) => s.title).join("; ")}`
      : null,
    t.dueAt ? `  Due: ${t.dueAt.toISOString()}` : null,
    t.estimatedDuration ? `  Duration: ${t.estimatedDuration}min` : null,
    t.repeat ? `  Repeat: ${JSON.stringify(t.repeat.rule)}` : null,
    t.repeat?.startsAt
      ? `  RepeatStart: ${t.repeat.startsAt.toISOString()}`
      : null,
    t.repeat?.endsAt ? `  RepeatEnd: ${t.repeat.endsAt.toISOString()}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

function allTasksContext(tasks: AiTaskDraft[]): string {
  if (!tasks.length) return "No tasks yet."
  return tasks.map(taskContext).join("\n\n")
}

function depsContext(dep: DependencyEntity | null): string {
  if (!dep || dep.tree.length <= 1) return "No dependency tree."
  return dep.tree
    .map(
      (n, i) =>
        `[${i}] ${n.title} (${n.data}) parent=${JSON.stringify(n.parent)} children=${JSON.stringify(n.children)}`
    )
    .join("\n")
}

function snapshotContext(s: DraftSnapshot): string {
  return [
    goalContext(s.goalDraft),
    "---",
    allTasksContext(s.taskDrafts),
    "---",
    depsContext(s.depTree),
  ].join("\n")
}

// ── Zod output schemas ────────────────────────────────────

export const fillDescriptionSchema = z.object({
  descriptions: z.array(
    z.object({
      target: z.string(),
      text: z.string(),
    })
  ),
})

export const decomposeTasksSchema = z.object({
  tasks: z.array(
    z.object({
      tempId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      steps: z.array(z.string()).optional(),
    })
  ),
  dependencies: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    })
  ),
})

export const optimizeDepsSchema = z.object({
  dependencies: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    })
  ),
})

export const refineStepsSchema = z.object({
  refinements: z.array(
    z.object({
      target: z.string(),
      steps: z.array(z.string()),
    })
  ),
})

// ── Tool definitions ──────────────────────────────────────

export interface ToolDefinition {
  name: AiToolName
  buildSystemPrompt: (snapshot: DraftSnapshot, focus: FocusTarget) => string
  buildUserPrompt: (
    instruction: string,
    snapshot: DraftSnapshot,
    focus: FocusTarget
  ) => string
  schema: z.ZodType
}

function focusHint(focus: FocusTarget): string {
  switch (focus.kind) {
    case "auto":
      return "The user hasn't specified a focus — decide what to modify based on the instruction."
    case "all":
      return "Apply changes to all relevant fields."
    case "goal":
      return "Focus modifications on the goal only."
    case "goalField":
      if (focus.field === "tasks")
        return "Focus on creating or modifying tasks for the goal."
      return `Focus on the goal's "${focus.field}" field.`
    case "task":
      return `Focus on task ID "${focus.taskId}".`
    case "taskField":
      return `Focus on task "${focus.taskId}" → "${focus.field}" field.`
    case "dependencies":
      return "Focus on the dependency tree."
  }
}

export const tools: Record<AiToolName, ToolDefinition> = {
  fillDescription: {
    name: "fillDescription",
    schema: fillDescriptionSchema,
    buildSystemPrompt: () =>
      `You are a project-planning assistant. Generate concise, actionable descriptions for goals and/or tasks.
Return JSON matching: { "descriptions": [{ "target": "goal" | taskId, "text": string }] }
Only include targets that need a description. Keep each description 1–3 sentences.`,
    buildUserPrompt: (instruction, snapshot, focus) =>
      `${focusHint(focus)}

User instruction: "${instruction}"

Current state:
${snapshotContext(snapshot)}

Generate descriptions for the relevant targets.`,
  },

  decomposeTasks: {
    name: "decomposeTasks",
    schema: decomposeTasksSchema,
    buildSystemPrompt: () =>
      `You are a project-planning assistant. Break down a goal into concrete tasks and their dependencies.
Return JSON matching:
{
  "tasks": [{ "tempId": string, "title": string, "description"?: string, "steps"?: string[] }],
  "dependencies": [{ "from": taskTempId, "to": taskTempId }]
}
- "from" depends on "to" (must finish "to" before starting "from").
- Generate UUID-style tempIds for brand-new tasks.
- To ADJUST an existing task, reuse its EXACT ID (shown in brackets, e.g. [abc-123]) as its "tempId" — its schedule (due date, duration, repeat) will be preserved.
- Return the COMPLETE intended task set: tasks you omit will be REMOVED.`,
    buildUserPrompt: (instruction, snapshot, focus) =>
      `${focusHint(focus)}

User instruction: "${instruction}"

Current state:
${snapshotContext(snapshot)}

Decompose the goal into tasks. If tasks already exist, you may add, remove, or adjust them.`,
  },

  optimizeDeps: {
    name: "optimizeDeps",
    schema: optimizeDepsSchema,
    buildSystemPrompt: () =>
      `You are a project-planning assistant. Optimize the dependency graph for the given tasks.
Return JSON: { "dependencies": [{ "from": taskId, "to": taskId }] }
- "from" depends on "to".
- Remove redundant edges. Add missing ones. Ensure no cycles.
- Return the COMPLETE dependency list (not a diff).`,
    buildUserPrompt: (instruction, snapshot, focus) =>
      `${focusHint(focus)}

User instruction: "${instruction}"

Current state:
${snapshotContext(snapshot)}

Return the optimized dependency list.`,
  },


  refineSteps: {
    name: "refineSteps",
    schema: refineStepsSchema,
    buildSystemPrompt: () =>
      `You are a project-planning assistant. Generate step-by-step checklists for tasks.
Return JSON: { "refinements": [{ "target": taskId, "steps": string[] }] }
- Generate steps for EVERY task that currently has no steps or whose steps could be improved.
- Steps should be clear, actionable, and ordered.
- 3–10 steps per task typically.
- Do NOT include a target of "goal" — goals have no steps.`,
    buildUserPrompt: (instruction, snapshot, focus) =>
      `${focusHint(focus)}

User instruction: "${instruction}"

Current state:
${snapshotContext(snapshot)}

Generate step-by-step checklists for the tasks.`,
  },
}

export function getToolDefinition(name: AiToolName): ToolDefinition {
  return tools[name]
}
