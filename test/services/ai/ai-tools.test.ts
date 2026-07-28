import { describe, expect, it } from "vitest"

import {
  decomposeTasksSchema,
  fillDescriptionSchema,
  getToolDefinition,
  optimizeDepsSchema,
  refineStepsSchema,
  tools,
} from "@/services/ai/ai-tools"
import type {
  AiToolName,
  DraftSnapshot,
  FocusTarget,
} from "@/services/ai/ai-types"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"

const emptySnapshot: DraftSnapshot = {
  goalDraft: { title: "Learn Rust" },
  taskDrafts: [],
  depTree: null,
}

const richSnapshot: DraftSnapshot = {
  goalDraft: {
    title: "Learn Rust",
    description: "Become productive in Rust",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
  },
  taskDrafts: [
    {
      id: "t1" as TaskID,
      title: "Read the book",
      description: "The official Rust book",
      steps: [
        { id: "s1", title: "Ch 1" },
        { id: "s2", title: "Ch 2" },
      ],
      dueAt: new Date("2026-07-01T00:00:00.000Z"),
      estimatedDuration: 120,
      repeat: {
        rule: { mode: "daily", interval: 1 },
        startsAt: new Date("2026-06-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-30T00:00:00.000Z"),
      },
      trigger: undefined,
      total: 1,
    },
  ],
  depTree: {
    id: "dep-1",
    belongTo: "g1" as GoalID,
    tree: [
      { data: "t1" as TaskID, title: "Read the book", parent: null, children: [1] },
      { data: "t2" as TaskID, title: "Write code", parent: [0], children: null },
    ],
  } satisfies DependencyEntity,
}

const allFocus: FocusTarget = { kind: "all" }

describe("getToolDefinition / tools registry", () => {
  it("returns the matching definition for every tool name", () => {
    const names: AiToolName[] = [
      "fillDescription",
      "decomposeTasks",
      "optimizeDeps",
      "refineSteps",
    ]
    for (const name of names) {
      const def = getToolDefinition(name)
      expect(def).toBe(tools[name])
      expect(def.name).toBe(name)
      expect(def.buildSystemPrompt(emptySnapshot, allFocus)).toBeTruthy()
    }
  })
})

describe("output schemas", () => {
  it("fillDescriptionSchema accepts/rejects", () => {
    expect(
      fillDescriptionSchema.safeParse({
        descriptions: [{ target: "goal", text: "hi" }],
      }).success
    ).toBe(true)
    expect(fillDescriptionSchema.safeParse({ descriptions: [{}] }).success).toBe(
      false
    )
  })

  it("decomposeTasksSchema accepts/rejects", () => {
    expect(
      decomposeTasksSchema.safeParse({
        tasks: [{ tempId: "a", title: "T", steps: ["s1"] }],
        dependencies: [{ from: "a", to: "b" }],
      }).success
    ).toBe(true)
    // dependencies required
    expect(
      decomposeTasksSchema.safeParse({ tasks: [] }).success
    ).toBe(false)
  })

  it("optimizeDepsSchema accepts/rejects", () => {
    expect(
      optimizeDepsSchema.safeParse({ dependencies: [] }).success
    ).toBe(true)
    expect(
      optimizeDepsSchema.safeParse({ dependencies: [{ from: 1, to: "b" }] })
        .success
    ).toBe(false)
  })

  it("refineStepsSchema accepts/rejects", () => {
    expect(
      refineStepsSchema.safeParse({
        refinements: [{ target: "t1", steps: ["a", "b"] }],
      }).success
    ).toBe(true)
    expect(refineStepsSchema.safeParse({ refinements: [{ target: "t1" }] }).success).toBe(false)
  })
})

describe("focus hints in user prompts", () => {
  const prompt = (focus: FocusTarget) =>
    tools.fillDescription.buildUserPrompt("do it", emptySnapshot, focus)

  it.each<[FocusTarget, string]>([
    [{ kind: "auto" }, "hasn't specified a focus"],
    [{ kind: "all" }, "Apply changes to all relevant fields."],
    [{ kind: "goal" }, "Focus modifications on the goal only."],
    [
      { kind: "goalField", field: "tasks" },
      "Focus on creating or modifying tasks for the goal.",
    ],
    [
      { kind: "goalField", field: "description" },
      `Focus on the goal's "description" field.`,
    ],
    [{ kind: "task", taskId: "t9" }, `Focus on task ID "t9".`],
    [
      { kind: "taskField", taskId: "t9", field: "steps" },
      `Focus on task "t9" → "steps" field.`,
    ],
    [{ kind: "dependencies" }, "Focus on the dependency tree."],
  ])("focus %j → hint", (focus, expected) => {
    expect(prompt(focus)).toContain(expected)
  })

  it("includes the raw instruction", () => {
    expect(prompt(allFocus)).toContain(`User instruction: "do it"`)
  })
})

describe("snapshot context rendering", () => {
  it("renders placeholders for an empty snapshot", () => {
    const p = tools.decomposeTasks.buildUserPrompt("x", emptySnapshot, allFocus)
    expect(p).toContain(`Goal: "Learn Rust"`)
    expect(p).toContain("No tasks yet.")
    expect(p).toContain("No dependency tree.")
  })

  it("renders goal description/due and all task fields", () => {
    const p = tools.refineSteps.buildUserPrompt("x", richSnapshot, allFocus)
    expect(p).toContain("Description: Become productive in Rust")
    expect(p).toContain("Due: 2026-08-01T00:00:00.000Z")
    expect(p).toContain(`Task [t1]: "Read the book"`)
    expect(p).toContain("Steps: Ch 1; Ch 2")
    expect(p).toContain("Duration: 120min")
    expect(p).toContain(`Repeat: {"mode":"daily","interval":1}`)
    expect(p).toContain("RepeatStart: 2026-06-01T00:00:00.000Z")
    expect(p).toContain("RepeatEnd: 2026-06-30T00:00:00.000Z")
  })

  it("renders the dependency tree with indices, parents and children", () => {
    const p = tools.optimizeDeps.buildUserPrompt("x", richSnapshot, allFocus)
    expect(p).toContain("[0] Read the book (t1) parent=null children=[1]")
    expect(p).toContain("[1] Write code (t2) parent=[0] children=null")
  })

  it("treats a single-node tree as no dependency tree", () => {
    const single: DraftSnapshot = {
      ...richSnapshot,
      depTree: {
        id: "dep-1",
        belongTo: "g1" as GoalID,
        tree: [
          { data: "t1" as TaskID, title: "Only", parent: null, children: null },
        ],
      },
    }
    const p = tools.optimizeDeps.buildUserPrompt("x", single, allFocus)
    expect(p).toContain("No dependency tree.")
  })
})
