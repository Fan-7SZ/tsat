import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { GoalID, TagID } from "@/domain/value-objects/types"

const mocks = vi.hoisted(() => ({
  putTag: vi.fn(),
  deleteTagAndUnbindGoals: vi.fn(),
  patchGoal: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  putTag: mocks.putTag,
  deleteTagAndUnbindGoals: mocks.deleteTagAndUnbindGoals,
  patchGoal: mocks.patchGoal,
}))

const { createTag, deleteCustomTag, assignGoalTag, clearGoalTag } =
  await import("@/commands/tag.commands")

const goalId = "goal-1" as GoalID
const tagId = "tag-1" as TagID

function tag(): TagDefinition {
  return {
    id: tagId,
    name: "Focus",
    color: "#ff0000",
    iconKey: "Star",
    kind: "custom",
  }
}

describe("tag.commands", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.putTag.mockResolvedValue(tagId)
    mocks.deleteTagAndUnbindGoals.mockResolvedValue(undefined)
    mocks.patchGoal.mockResolvedValue(1)
  })

  it("createTag persists the tag and returns it", async () => {
    const created = await createTag(tag())

    expect(mocks.putTag).toHaveBeenCalledWith(tag())
    expect(created).toEqual(tag())
  })

  it("deleteCustomTag unbinds goals through the repository helper", async () => {
    await deleteCustomTag(tagId)

    expect(mocks.deleteTagAndUnbindGoals).toHaveBeenCalledWith(tagId)
  })

  it("assignGoalTag patches the goal with the tag id", async () => {
    await assignGoalTag(goalId, tagId)

    expect(mocks.patchGoal).toHaveBeenCalledWith(goalId, { tagId })
  })

  it("assignGoalTag throws when the goal is missing", async () => {
    mocks.patchGoal.mockResolvedValue(0)

    await expect(assignGoalTag(goalId, tagId)).rejects.toThrow(
      `Goal ${goalId} was not found`
    )
  })

  it("clearGoalTag patches the goal with tagId undefined", async () => {
    await clearGoalTag(goalId)

    expect(mocks.patchGoal).toHaveBeenCalledWith(goalId, { tagId: undefined })
  })

  it("clearGoalTag throws when the goal is missing", async () => {
    mocks.patchGoal.mockResolvedValue(0)

    await expect(clearGoalTag(goalId)).rejects.toThrow(
      `Goal ${goalId} was not found`
    )
  })
})
