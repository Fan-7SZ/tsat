import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/services/ai/ai", () => ({
  estimateCount: vi.fn(),
  executeTool: vi.fn(),
}))

import { estimateCount, executeTool } from "@/services/ai/ai"
import {
  decomposeGoalTasks,
  estimateStepCount,
  estimateTaskCount,
  generateTaskSteps,
  optimizeDependencies,
  type StepAutofillTask,
} from "@/services/ai/ai-scenarios"
import type { AiSettings } from "@/store/slices/ai-settings.slice"
import type { DraftSnapshot } from "@/services/ai/ai-types"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"

const estimateCountMock = vi.mocked(estimateCount)
const executeToolMock = vi.mocked(executeTool)

const settings: AiSettings = {
  provider: "deepseek",
  openRouterApiKey: "",
  openRouterModel: "x",
  deepseekApiKey: "key",
  deepseekModel: "deepseek-chat",
}

beforeEach(() => {
  estimateCountMock.mockReset()
  executeToolMock.mockReset()
})

describe("estimateStepCount", () => {
  const task: StepAutofillTask = {
    id: "t1",
    title: "Write the report",
    description: "Quarterly numbers",
    goalTitle: "Q3 wrap-up",
  }

  it("forwards a prompt containing task, description and goal context", async () => {
    estimateCountMock.mockResolvedValue(5)
    await expect(
      estimateStepCount(settings, task, "zh")
    ).resolves.toBe(5)

    const [passedSettings, system, user, signal, locale] =
      estimateCountMock.mock.calls[0]
    expect(passedSettings).toBe(settings)
    expect(system).toContain("checklist steps")
    expect(user).toContain(`Task: "Write the report" — Quarterly numbers`)
    expect(user).toContain(`Goal: "Q3 wrap-up"`)
    expect(signal).toBeUndefined()
    expect(locale).toBe("zh")
  })

  it("omits the optional description/goal parts", async () => {
    estimateCountMock.mockResolvedValue(3)
    await estimateStepCount(settings, { id: "t1", title: "Solo" })
    const user = estimateCountMock.mock.calls[0][2]
    expect(user).toContain(`Task: "Solo"`)
    expect(user).not.toContain("Goal:")
    expect(user).not.toContain("—")
  })
})

describe("generateTaskSteps", () => {
  const task: StepAutofillTask = { id: "t1", title: "Write", goalTitle: "G" }

  it("calls the refineSteps tool with a single-task snapshot and steps focus", async () => {
    executeToolMock.mockResolvedValue({
      refinements: [{ target: "t1", steps: ["a", "b"] }],
    })
    const steps = await generateTaskSteps(settings, task, "make steps", "zh")
    expect(steps).toEqual(["a", "b"])

    const [, toolName, instruction, snapshot, focus, , locale] =
      executeToolMock.mock.calls[0]
    expect(toolName).toBe("refineSteps")
    expect(instruction).toBe("make steps")
    expect(locale).toBe("zh")
    expect(focus).toEqual({ kind: "taskField", taskId: "t1", field: "steps" })
    const snap = snapshot as DraftSnapshot
    expect(snap.goalDraft.title).toBe("G")
    expect(snap.taskDrafts).toHaveLength(1)
    expect(snap.taskDrafts[0]).toMatchObject({ id: "t1", title: "Write" })
    expect(snap.depTree).toBeNull()
  })

  it("picks the refinement matching the task id, else falls back to the first", async () => {
    executeToolMock.mockResolvedValue({
      refinements: [
        { target: "other", steps: ["x"] },
        { target: "t1", steps: ["mine"] },
      ],
    })
    await expect(
      generateTaskSteps(settings, task, "i")
    ).resolves.toEqual(["mine"])

    executeToolMock.mockResolvedValue({
      refinements: [{ target: "other", steps: ["fallback"] }],
    })
    await expect(
      generateTaskSteps(settings, task, "i")
    ).resolves.toEqual(["fallback"])
  })

  it("filters blank/whitespace steps and handles empty refinements", async () => {
    executeToolMock.mockResolvedValue({
      refinements: [{ target: "t1", steps: ["ok", "", "  ", "also ok"] }],
    })
    await expect(
      generateTaskSteps(settings, task, "i")
    ).resolves.toEqual(["ok", "also ok"])

    executeToolMock.mockResolvedValue({ refinements: [] })
    await expect(generateTaskSteps(settings, task, "i")).resolves.toEqual([])
  })
})

describe("estimateTaskCount", () => {
  it("mentions existing task titles so the AI avoids duplicates", async () => {
    estimateCountMock.mockResolvedValue(4)
    await estimateTaskCount(
      settings,
      {
        title: "Ship v1",
        description: "First release",
        existingTaskTitles: ["Setup CI", "Write docs"],
      },
      "focus on infra"
    )
    const user = estimateCountMock.mock.calls[0][2]
    expect(user).toContain(`Goal: "Ship v1" — First release`)
    expect(user).toContain("User note: focus on infra")
    expect(user).toContain(`"Setup CI", "Write docs"`)
    expect(user).toContain("How many NEW tasks should be added?")
  })

  it("omits the existing-tasks note when there are none", async () => {
    estimateCountMock.mockResolvedValue(4)
    await estimateTaskCount(settings, { title: "Ship v1" }, "")
    const user = estimateCountMock.mock.calls[0][2]
    expect(user).not.toContain("already exist")
    expect(user).not.toContain("User note:")
  })
})

describe("decomposeGoalTasks", () => {
  it("passes an empty-task snapshot and appends existing/count notes to the instruction", async () => {
    executeToolMock.mockResolvedValue({
      tasks: [
        { tempId: "a", title: "New A" },
        { tempId: "b", title: "  " },
        { tempId: "c", title: "New C" },
      ],
      dependencies: [],
    })
    const titles = await decomposeGoalTasks(
      settings,
      { title: "Goal", existingTaskTitles: ["Old"] },
      "base instruction",
      undefined,
      undefined,
      2
    )
    expect(titles).toEqual(["New A", "New C"])

    const [, toolName, instruction, snapshot, focus] =
      executeToolMock.mock.calls[0]
    expect(toolName).toBe("decomposeTasks")
    expect(instruction).toContain("base instruction")
    expect(instruction).toContain(`"Old"`)
    expect(instruction).toContain("Generate EXACTLY 2 tasks.")
    expect(focus).toEqual({ kind: "goalField", field: "tasks" })
    expect((snapshot as DraftSnapshot).taskDrafts).toEqual([])
  })

  it("uses singular phrasing for count=1 and no note without a count", async () => {
    executeToolMock.mockResolvedValue({ tasks: [], dependencies: [] })
    await decomposeGoalTasks(
      settings,
      { title: "Goal" },
      "i",
      undefined,
      undefined,
      1
    )
    expect(executeToolMock.mock.calls[0][2]).toContain(
      "Generate EXACTLY 1 task."
    )

    await decomposeGoalTasks(settings, { title: "Goal" }, "i")
    expect(executeToolMock.mock.calls[1][2]).not.toContain("EXACTLY")
  })
})

describe("optimizeDependencies", () => {
  const dependency: DependencyEntity = {
    id: "dep-1",
    belongTo: "g1" as GoalID,
    tree: [
      { data: "t1" as TaskID, title: "First", parent: null, children: [1] },
      { data: "t2" as TaskID, title: "Second", parent: [0], children: null },
    ],
  }

  it("builds task drafts from the tree and returns filtered edges", async () => {
    executeToolMock.mockResolvedValue({
      dependencies: [
        { from: "t2", to: "t1" },
        { from: 3 as unknown as string, to: "t1" },
      ],
    })
    const edges = await optimizeDependencies(
      settings,
      "Goal",
      dependency,
      "clean it up"
    )
    expect(edges).toEqual([{ from: "t2", to: "t1" }])

    const [, toolName, instruction, snapshot, focus] =
      executeToolMock.mock.calls[0]
    expect(toolName).toBe("optimizeDeps")
    expect(instruction).toBe("clean it up")
    expect(focus).toEqual({ kind: "dependencies" })
    const snap = snapshot as DraftSnapshot
    expect(snap.depTree).toBe(dependency)
    expect(snap.taskDrafts.map((t) => ({ id: t.id, title: t.title }))).toEqual([
      { id: "t1", title: "First" },
      { id: "t2", title: "Second" },
    ])
  })
})
